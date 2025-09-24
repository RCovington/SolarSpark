// Mod Bay panel: allows upgrading ship systems
 (function(){

    // Diagnostic overlay helper - visible marker so the user can see retries even if console is interrupted
    function _modBayShowDiag(attempt) {
        try {
            let id = 'mod-bay-diagnostic';
            let el = document.getElementById(id);
            if (!el) {
                el = document.createElement('div');
                el.id = id;
                el.style.position = 'fixed';
                el.style.right = '12px';
                el.style.top = '12px';
                el.style.zIndex = 12000;
                el.style.padding = '6px 8px';
                el.style.background = 'rgba(255,0,0,0.85)';
                el.style.color = '#fff';
                el.style.fontFamily = 'monospace';
                el.style.fontSize = '12px';
                el.style.borderRadius = '4px';
                el.style.pointerEvents = 'none';
                document.body.appendChild(el);
            }
            el.textContent = 'mod-bay: retry ' + (typeof attempt === 'number' ? attempt : '?') + ' @ ' + (new Date()).toLocaleTimeString();
            // auto-clear after a short period
            try { clearTimeout(el.__mb_clear); } catch (e) {}
            el.__mb_clear = setTimeout(() => { try { el.remove(); } catch (e) {} }, 3000);
        } catch (e) { /* ignore diagnostics failure */ }
    }

    try { console.debug && console.debug('mod-bay:module-init'); } catch (e) {}

    // Utility: calculate upgrade cost for next level (levels start at 1, cost for level N -> N+1 is 50 * 2^(N-1))
    function nextLevelCost(level) {
        // level is current level, cost to reach level+1
        return 50 * Math.pow(2, Math.max(0, level - 1));
    }

    // Utility: calculate attribute multiplier for applying an upgrade of a given level
    // The increase applied when moving from level N to N+1 is:
    // 1->2 : +75% of base
    // 2->3 : +50% of base
    // 3->4 : +25% of base
    // 4->5+ : +20% of base each
    function incrementPercentForLevel(level) {
        const next = level + 1;
        if (next === 2) return 0.75;
        if (next === 3) return 0.5;
        if (next === 4) return 0.25;
        return 0.2;
    }

    // Default list of mod areas and the ship attribute they map to
    const MOD_AREAS = [
        {key: 'hull', label: nomangle('Hull'), attr: 'maxHullPoints'},
        {key: 'shield', label: nomangle('Shield'), attr: 'maxShieldPoints'},
        {key: 'phasers', label: nomangle('Phasers'), attr: 'phaserShots'},
        {key: 'torpedos', label: nomangle('Torpedos'), attr: 'torpedoShots'},
        {key: 'thermal', label: nomangle('Thermal Vent'), attr: 'thermalRecovery'},
        {key: 'cargo', label: nomangle('Cargo Storage'), attr: 'cargoCapacity'}
    ];

    // Ensure player ship has an upgrades object with default levels (1)
    function ensureShipUpgrades(ship) {
        if (!ship.upgrades) ship.upgrades = {};
        MOD_AREAS.forEach(m => { if (typeof ship.upgrades[m.key] !== 'number') ship.upgrades[m.key] = 1; });
    }

    // Apply upgrades to ship stats. We store base values on the ship (baseStats) so we can reapply deterministically.
    function ensureBaseStats(ship) {
                if (!ship.baseStats) {
            ship.baseStats = {
                maxHullPoints: ship.maxHullPoints || 100,
                maxShieldPoints: ship.maxShieldPoints || 100,
                phaserShots: ship.phaserShots || 1,
                torpedoShots: ship.torpedoShots || 1,
                thermalRecovery: ship.thermalRecovery || 1, // lower is faster; we treat as cooldown multiplier
                // Use 200 as the game-default cargo capacity to match trading UI and expectations
                cargoCapacity: (typeof ship.cargoCapacity === 'number' && ship.cargoCapacity > 0) ? ship.cargoCapacity : 200
            };
        }
    }

    function applyUpgradesToShip(ship) {
        ensureShipUpgrades(ship);
        ensureBaseStats(ship);

        // Reset to base
        ship.maxHullPoints = ship.baseStats.maxHullPoints;
        ship.maxShieldPoints = ship.baseStats.maxShieldPoints;
        ship.phaserShots = ship.baseStats.phaserShots;
        ship.torpedoShots = ship.baseStats.torpedoShots;
        ship.thermalRecovery = ship.baseStats.thermalRecovery;
        ship.cargoCapacity = ship.baseStats.cargoCapacity;

        // For each mod area, compute cumulative increases up to current level
        MOD_AREAS.forEach(area => {
            const level = ship.upgrades[area.key] || 1;
            // For each increment from 1..(level-1) apply corresponding percent of base
            const base = ship.baseStats[area.attr] || 0;

            // Special-case Hull and Shield: each level increase grants +20% of the base value per level
            if (area.key === 'hull' || area.key === 'shield') {
                const added = base * 0.2 * Math.max(0, (level - 1));
                // Use rounding for hitpoint-like stats
                ship[area.attr] = Math.max(base, Math.round(ship[area.attr] + added));
            } else if (area.key === 'cargo') {
                // Cargo should follow the 75%/50%/25%/20% pattern per level (cumulative)
                let cumulativeIncrease = 0;
                for (let l = 1; l < level; l++) cumulativeIncrease += incrementPercentForLevel(l);
                const total = Math.round(base * (1 + cumulativeIncrease));
                ship[area.attr] = Math.max(base, total);
            } else {
                // For other areas keep existing cumulative-percent behavior
                let cumulativeIncrease = 0;
                for (let l = 1; l < level; l++) {
                    cumulativeIncrease += incrementPercentForLevel(l);
                }
                const added = base * cumulativeIncrease;

                // Apply addition differently depending on attribute semantics
                if (area.key === 'thermal') {
                    // thermalRecovery is a cooldown; improving vent should reduce cooldown by added percent
                    // We'll treat added as percent of base to subtract
                    ship.thermalRecovery = Math.max(0.01, ship.thermalRecovery - added);
                } else if (area.key === 'phasers' || area.key === 'torpedos') {
                    // Shot counts are integers; round down after applying
                    ship[area.attr] = Math.max(1, Math.floor(ship[area.attr] + added + 0.0001));
                } else {
                    // cargo and others increases directly
                    ship[area.attr] = Math.max(base, ship[area.attr] + added);
                }
            }
        });
    }
    

    // Expose helper to apply upgrades without opening UI (used by restore paths)
    window.applyShipUpgrades = function(ship) {
        try {
            applyUpgradesToShip(ship || U.playerShip);
        } catch (e) { console.error('applyShipUpgrades error', e); }
    };

    // Show the Mod Bay panel for the given station (station is optional, we care about player ship)
    function doOpenModBay(station) {
        try {
            console.debug('doOpenModBay executing for station', station && station.star && station.star.name);
            const ship = U.playerShip;
            ensureShipUpgrades(ship);
            applyUpgradesToShip(ship);

            const sections = [];

            // Top section: credits display
            const credits = ship.credits || 0;
            sections.push({ title: '', html: `<div style="text-align:center;font-weight:bold;margin-bottom:8px;">Credits: <span id="mod-bay-credits">${credits}</span></div>` });

            // Build rows with inline upgrade placeholders
            const rows = MOD_AREAS.map(area => {
                const level = ship.upgrades[area.key] || 1;
                const cost = nextLevelCost(level);
                // For cargo, include a numeric capacity display element we can update
                if (area.key === 'cargo') {
                    return {
                        label: `${area.label} (Level ${level})`,
                        value: `<span class="mod-bay-cost" data-area="${area.key}">${cost} cr</span> <span style="margin-left:8px;"><button type="button" class="mod-bay-upgrade-btn" data-area="${area.key}">Upgrade</button></span>`
                    };
                }

                return {
                    label: `${area.label} (Level ${level})`,
                    // value will be replaced by a span that contains cost and an inline button
                    value: `<span class="mod-bay-cost" data-area="${area.key}">${cost} cr</span> <span style=\"margin-left:8px;\"><button type=\"button\" class=\"mod-bay-upgrade-btn\" data-area=\"${area.key}\">Upgrade</button></span>`
                };
            });

            sections.push({ title: nomangle('Available Upgrades'), rows });

            // Create the panel (no separate buttons)
            const panel = window.createMenuPanel({
                id: 'mod-bay-panel',
                title: nomangle('Mod Bay'),
                sections,
                noClose: false,
                buttons: [],
                onClose: () => {
                    try { applyUpgradesToShip(U.playerShip); } catch (e) {}
                }
            });

            // Attach click handlers to inline Upgrade buttons
            try {
                const attachHandler = (btn) => {
                    btn.addEventListener('click', (ev) => {
                        try {
                            const areaKey = btn.getAttribute('data-area');
                            const current = ship.upgrades[areaKey] || 1;
                            const cost = nextLevelCost(current);
                            const preCredits = ship.credits || 0;
                            if (preCredits < cost) {
                                G.showMessage(nomangle('Not enough credits'));
                                return;
                            }

                            // Pre-values for logging
                            const preVals = {
                                maxHullPoints: ship.maxHullPoints,
                                maxShieldPoints: ship.maxShieldPoints,
                                phaserShots: ship.phaserShots,
                                torpedoShots: ship.torpedoShots,
                                thermalRecovery: ship.thermalRecovery,
                                cargoCapacity: ship.cargoCapacity
                            };

                            // Apply purchase
                            ship.credits -= cost;
                            ship.upgrades[areaKey] = current + 1;
                            applyUpgradesToShip(ship);

                            // Scoring: award points for an upgrade purchase
                            try { if (window.Score) Score.add(20, 'upgrade'); } catch (e) {}

                            // Update credits display
                            try {
                                const credEl = document.getElementById('mod-bay-credits');
                                if (credEl) credEl.textContent = ship.credits || 0;
                            } catch (e) {}

                            // Update the row's level and cost
                            try {
                                const costEl = panel.querySelector('.mod-bay-cost[data-area="' + areaKey + '"]');
                                if (costEl) {
                                    const newLevel = ship.upgrades[areaKey] || 1;
                                    const newCost = nextLevelCost(newLevel);
                                    costEl.textContent = newCost + ' cr';
                                    // Also update the label text
                                    const rowLabel = costEl.closest('.info-row').querySelector('span');
                                    if (rowLabel) rowLabel.textContent = `${MOD_AREAS.find(a=>a.key===areaKey).label} (Level ${newLevel})`;
                                }
                            } catch (e) {}

                            // If cargo was updated, nothing to refresh in the inline row (capacity badge removed)

                            // Log changes
                            try {
                                const postCredits = ship.credits || 0;
                                const postLevel = ship.upgrades[areaKey] || (current + 1);
                                console.debug('mod-bay: upgrade purchased for', areaKey, 'level', current, '->', postLevel, 'credits', preCredits, '->', postCredits);
                                Object.keys(preVals).forEach(k => {
                                    const before = preVals[k];
                                    const after = ship[k];
                                    if (before !== after) console.debug('mod-bay:', k, 'changed', before, '->', after);
                                    else console.debug('mod-bay:', k, 'unchanged', before);
                                });

                                // Additional explicit debug for Shield, Hull, and Cargo per request
                                try {
                                    if (areaKey === 'shield') {
                                        const beforeShield = preVals.maxShieldPoints;
                                        const afterShield = ship.maxShieldPoints;
                                        console.debug('mod-bay: Shield before -> after:', beforeShield, '->', afterShield);
                                    } else if (areaKey === 'hull') {
                                        const beforeHull = preVals.maxHullPoints;
                                        const afterHull = ship.maxHullPoints;
                                        console.debug('mod-bay: Hull before -> after:', beforeHull, '->', afterHull);
                                    } else if (areaKey === 'cargo') {
                                        const beforeCargo = preVals.cargoCapacity;
                                        const afterCargo = ship.cargoCapacity;
                                        console.debug('mod-bay: Cargo before -> after:', beforeCargo, '->', afterCargo);
                                    }
                                } catch (e) {}
                            } catch (e) {}

                            // Persist state
                            try { if (typeof U !== 'undefined' && typeof U.saveState === 'function') U.saveState(); } catch (e) {}

                        } catch (e) { console.error(e); }
                    });
                };

                const btns = panel.querySelectorAll('.mod-bay-upgrade-btn');
                btns.forEach(b => attachHandler(b));

                // Helper to refresh upgrade button enabled/disabled state based on current credits
                const refreshUpgradeButtons = () => {
                    try {
                        const currentCredits = ship.credits || 0;
                        const btns = panel.querySelectorAll('.mod-bay-upgrade-btn');
                        btns.forEach(b => {
                            try {
                                const areaKey = b.getAttribute('data-area');
                                const level = ship.upgrades[areaKey] || 1;
                                const cost = nextLevelCost(level);
                                if (currentCredits < cost) {
                                    b.setAttribute('disabled', 'disabled');
                                    b.title = 'Not enough credits (' + cost + ' required)';
                                } else {
                                    b.removeAttribute('disabled');
                                    b.title = 'Upgrade for ' + cost + ' credits';
                                }
                            } catch (e) {}
                        });
                        // Also refresh displayed cargo capacity if present
                        // capacity badge removed; no-op
                    } catch (e) {}
                };

                // Initial refresh
                refreshUpgradeButtons();

                // Keep buttons refreshed while panel is open. Prefer event-driven updates via G.eventHub
                // but fall back to a poll interval if the hub isn't available.
                let __mb_refresh_interval;
                const originalOnClose = panel.onClose || (() => {});

                // Style and tooltip for cargo capacity badge (small, faded, and show next-level capacity/cost)
                // capacity badge removed; no tooltip to set

                // Use event listeners where possible
                let creditsListener = null;
                let cargoListener = null;
                try {
                    if (window.G && G.eventHub && typeof G.eventHub.listen === 'function') {
                        creditsListener = function() { try { refreshUpgradeButtons(); } catch (e) {} };
                        cargoListener = function() { try { refreshUpgradeButtons(); } catch (e) {} };
                        try { G.eventHub.listen('player:creditsChanged', creditsListener); } catch (e) {}
                        try { G.eventHub.listen('player:cargoCapacityChanged', cargoListener); } catch (e) {}
                    } else {
                        // fallback to polling
                        __mb_refresh_interval = setInterval(refreshUpgradeButtons, 500);
                    }
                } catch (e) {
                    __mb_refresh_interval = setInterval(refreshUpgradeButtons, 500);
                }

                // Ensure listeners/interval are cleared when panel is closed
                panel.onClose = () => {
                    try { if (creditsListener && G.eventHub && typeof G.eventHub.ignore === 'function') G.eventHub.ignore('player:creditsChanged', creditsListener); } catch (e) {}
                    try { if (cargoListener && G.eventHub && typeof G.eventHub.ignore === 'function') G.eventHub.ignore('player:cargoCapacityChanged', cargoListener); } catch (e) {}
                    try { clearInterval(__mb_refresh_interval); } catch (e) {}
                    try { originalOnClose(); } catch (e) {}
                };
            } catch (e) { /* ignore UI attach errors */ }

            // Make the panel wide so buttons can fit (and visually consistent with request)
            try { panel.style.minWidth = '640px'; panel.style.maxWidth = '80%'; } catch (e) {}

            return true;
        } catch (e) { console.error('doOpenModBay error', e); return false; }
    }

    // Try opening mod bay with retries to survive occasional synchronous extension errors
    function tryOpenModBay(station, attempt) {
        try {
            try { console.debug('mod-bay: tryOpenModBay', attempt); } catch (e) {}
            _modBayShowDiag(attempt);
            if (doOpenModBay(station)) {
                try { console.debug('mod-bay: opened on attempt', attempt); } catch (e) {}
                return;
            }
        } catch (e) {
            try { console.error('mod-bay: tryOpenModBay caught', e && e.stack ? e.stack : e); } catch (e2) {}
        }
        if (attempt >= 4) return;
        setTimeout(() => tryOpenModBay(station, attempt + 1), 60 * (attempt + 1));
    }

    window.openModBay = function(station) {
        try {
            console.debug('mod-bay: window.openModBay called');
            _modBayShowDiag(0);
            setTimeout(() => tryOpenModBay(station, 0), 0);
        } catch (e) {
            try { console.error('mod-bay: openModBay fallback error', e && e.stack ? e.stack : e); } catch (e2) {}
            tryOpenModBay(station, 0);
        }
    };

    // Also listen for a CustomEvent dispatched by UI wrappers (decoupled open)
    try {
        // Mark module as loaded
        try { window.__SS_modBayLoaded = true; } catch (e) {}

        window.addEventListener('solarspark:openModBay', (ev) => {
            try { console.debug('solarspark:openModBay event received', ev && ev.detail); } catch (e) {}
            try { _modBayShowDiag(0); } catch (e) {}
            tryOpenModBay(ev && ev.detail && ev.detail.station, 0);
        });

        // If a station dispatched the open event before this module loaded, handle it
        try {
            if (window.__SS_pendingModBayStation) {
                try { console.debug('mod-bay: found pending station on load', window.__SS_pendingModBayStation); } catch (e) {}
                const st = window.__SS_pendingModBayStation;
                try { delete window.__SS_pendingModBayStation; } catch (e) { window.__SS_pendingModBayStation = null; }
                tryOpenModBay(st, 0);
            }
        } catch (e) { /* ignore */ }
    } catch (e) {}

})();
