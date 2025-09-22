// Wrapper to create a Planetary Trade panel using createMenuPanel
(function(){
    // Clean, shared message constants to avoid accidental hidden characters in literals
    const NO_CARGO_SPACE_MSG = 'Not enough credits or cargo space';
    // Compute and persist a price for a cargo item on a per-planet basis (base value +/-20%)
    function getPlanetPrice(planet, cargoName) {
        try {
            if (!planet) return 1;
            if (!planet.prices) planet.prices = {};
            if (planet.prices[cargoName] !== undefined) return planet.prices[cargoName];

            // Lookup the cargo base value from CARGO_DATA
            let base = 1;
            try {
                if (typeof CARGO_DATA !== 'undefined' && Array.isArray(CARGO_DATA)) {
                    const def = CARGO_DATA.find(d => d.cargo === cargoName || String(d.id) === String(cargoName));
                    if (def && def.value) base = def.value;
                }
            } catch (e) {}

            const variance = 0.8 + Math.random() * 0.4; // 0.8 - 1.2
            const price = Math.max(1, Math.round(base * variance));
            planet.prices[cargoName] = price;
            return price;
        } catch (e) { return 1; }
    }

    // Helper to create sample planet cargo offerings
    function samplePlanetCargo(planet) {
        // If CARGO_DATA is available, pick 3 unique random entries and generate units/price
        const picks = [];
        try {
            if (typeof CARGO_DATA !== 'undefined' && Array.isArray(CARGO_DATA) && CARGO_DATA.length) {
                // Shuffle indexes and take first 3
                const idx = CARGO_DATA.map((_, i) => i);
                for (let i = idx.length - 1; i > 0; i--) {
                    const j = Math.floor(Math.random() * (i + 1));
                    const t = idx[i]; idx[i] = idx[j]; idx[j] = t;
                }

                    // Replace a specific market slot on a planet with a new random cargo offering
                    function replaceMarketItem(planet, index) {
                        try {
                            if (!planet) return;
                            if (!planet.market || !Array.isArray(planet.market)) planet.market = samplePlanetCargo(planet || {});
                            const old = planet.market[index];

                            // Build candidate list excluding the old cargo name (if present)
                            let candidates = CARGO_DATA && Array.isArray(CARGO_DATA) ? CARGO_DATA.slice() : null;
                            if (!candidates) {
                                // Fallback: resample the whole market
                                planet.market[index] = samplePlanetCargo(planet || {})[0] || { name: 'Unknown', units: 100, price: 1 };
                                if (typeof U !== 'undefined' && U.saveState) try { U.saveState(); } catch (e) {}
                                return;
                            }

                            if (old && old.name) {
                                candidates = candidates.filter(c => c && c.cargo !== old.name && String(c.id) !== String(old.name));
                            }

                            if (!candidates.length) candidates = CARGO_DATA.slice();

                            // Pick a random candidate
                            const pick = candidates[Math.floor(Math.random() * candidates.length)];
                            const units = 100 + Math.floor(Math.random() * 901); // 100-1000
                            const price = getPlanetPrice(planet, pick.cargo);
                            planet.market[index] = { name: pick.cargo, units, price };

                            // Persist planet markets if Universe save is available
                            if (typeof U !== 'undefined' && U.saveState) {
                                try { U.saveState(); } catch (e) { /* ignore */ }
                            }
                        } catch (e) { console.error('replaceMarketItem error', e); }
                    }
                const take = Math.min(3, idx.length);
                for (let k = 0; k < take; k++) {
                    const item = CARGO_DATA[idx[k]];
                    const units = 100 + Math.floor(Math.random() * 901); // 100-1000
                    const price = getPlanetPrice(planet, item.cargo);
                    picks.push({ name: item.cargo, units, price });
                }
                return picks;
            }
        } catch (e) {
            console.error('samplePlanetCargo using fallback due to error', e);
        }

        // Fallback simple sample
        const cargoTypes = ['Food', 'Minerals', 'Medicine', 'Textiles', 'Electronics', 'Spices'];
        for (let i = 0; i < 3; i++) {
            const name = cargoTypes[(i + (planet.name ? planet.name.length : 0)) % cargoTypes.length];
            const units = 100 + Math.floor(Math.random() * 901);
            const price = Math.max(1, Math.floor(5 + i * 3 + (Math.random() * 5)));
            picks.push({ name, units, price });
        }
        return picks;
    }

    // Compute player's inventory entries (if ship.cargo map exists), otherwise fall back to generic resources
    function playerInventoryEntries(ship, planet) {
        const entries = [];
        if (!ship) return entries;

        if (ship.cargo && typeof ship.cargo === 'object' && Object.keys(ship.cargo).length) {
            Object.keys(ship.cargo).forEach(k => {
                const units = ship.cargo[k] || 0;
                if (!units || units <= 0) return; // skip zero-unit entries
                let price = Math.max(1, Math.floor(3 + (Math.random() * 5)));
                try {
                    if (planet) {
                        price = getPlanetPrice(planet, k);
                    }
                } catch (e) {}
                entries.push({ name: k, units: units, price });
            });
        } else if (ship.civilization && ship.civilization.resources) {
            entries.push({ name: 'Raw Materials', units: ship.civilization.resources, price: 1 });
        }

        return entries;
    }

    function getCargoDefByName(name) {
        try {
            if (typeof CARGO_DATA !== 'undefined' && Array.isArray(CARGO_DATA)) {
                return CARGO_DATA.find(i => i.cargo === name || i.id === name || String(i.id) === String(name));
            }
        } catch (e) {}
        return null;
    }

    function getShipUsedSpace(ship) {
        if (!ship) return 0;
        if (!ship.cargo) return 0;
        let used = 0;
        Object.keys(ship.cargo).forEach(name => {
            const def = getCargoDefByName(name);
            const units = ship.cargo[name] || 0;
            const per = def && def.storage_units ? def.storage_units : 1;
            used += units * per;
        });
        return used;
    }

    function getShipRemainingSpace(ship) {
        const CAP = (ship && typeof ship.cargoCapacity === 'number' && ship.cargoCapacity > 0) ? ship.cargoCapacity : 200;
        return Math.max(0, CAP - getShipUsedSpace(ship));
    }

    window.createPlanetaryTradePanel = function(planet, ship) {
        try { console.debug('createPlanetaryTradePanel called', planet && planet.name); } catch(e) {}

        ensureCreateMenuPanelExists();

        // If a ship is provided, set docking-like state so the ship locks to the planet and becomes invulnerable
        try {
            if (ship && planet) {
                // mark as docked to planet
                ship.dockedPlanet = planet;
                ship.isDocked = true;
                ship.inTradingInterface = true;
                // compute dock offset based on current angle from planet to ship
                const angleToShip = angleBetween(planet, ship);
                const dockDistance = planet.radius + 15;
                ship.dockOffset = { x: Math.cos(angleToShip) * dockDistance, y: Math.sin(angleToShip) * dockDistance };
                // ensure credits present
                if (ship.credits === undefined) ship.credits = 0;
            }
        } catch (e) { console.error('planetary-trade: failed to set dock state', e); }

        // Persist market on planet
        if (!planet.market) {
            planet.market = samplePlanetCargo(planet || {});
        }
    const planetOfferings = planet.market;
    const playerEntries = playerInventoryEntries(ship || {}, planet);

        // Build sections: Cargo (planet offerings) then Inventory (player)
        const sections = [];

        // Planet Cargo section (big list)
        // Include an inline message placeholder (.panel-message) so we can display errors inside the panel
        let cargoHtml = '<div class="section">';
    cargoHtml += '<h3>CARGO FOR SALE</h3>';
        planetOfferings.forEach((c, i) => {
            cargoHtml += `<div class="info-row" data-market-index="${i}"><span>${c.name} (${c.units} units)</span><span>${c.price} cr/unit</span></div>`;
        });
        cargoHtml += '</div>';
        sections.push({ html: cargoHtml });

        // Player inventory section
        // Inventory section will be populated dynamically after panel creation so we can attach
        // interactive Sell buttons and tooltips. Start with an empty section placeholder.
        sections.push({ title: 'INVENTORY', rows: [] });

        // Buttons: Leave button
        const buttons = [];
        buttons.push({
            label: '[L] Leave',
            onClick: function() { if (window.planetaryUndock) window.planetaryUndock(); }
        });

        // Create panel
        const panel = window.createMenuPanel({
            id: 'planetary-trade-panel',
            title: (planet && planet.name ? planet.name : 'Unknown') + ' - Planetary Trade',
            sections: sections,
            buttons: buttons,
            noClose: true,
            onClose: function() { if (window.planetaryUndock) window.planetaryUndock(); }
        });

        // Insert a header-level panel message element under the title for inline messages
        try {
                    if (panel) {
                const titleEl = panel.querySelector('h2');
                if (titleEl && !panel.querySelector('.panel-message')) {
                    const headerMsg = document.createElement('div');
                    headerMsg.className = 'panel-message';
                    titleEl.insertAdjacentElement('afterend', headerMsg);
                }
            }
        } catch (e) { /* ignore */ }

        // Helper to set panel header message and auto-clear it on timeout or interaction
        let panelMsgTimeout = null;
        function setPanelMessage(text) {
            try {
                if (!panel) return;
                const pm = panel.querySelector('.panel-message');
                if (!pm) return;
                pm.textContent = text || '';

                // Clear any previous timer
                if (panelMsgTimeout) {
                    clearTimeout(panelMsgTimeout);
                    panelMsgTimeout = null;
                }

                if (text) {
                    // Auto-clear after 3.5 seconds
                    panelMsgTimeout = setTimeout(() => {
                        try { pm.textContent = ''; } catch (e) {}
                        panelMsgTimeout = null;
                    }, 3500);
                }
            } catch (e) { /* ignore */ }
        }

        // Clear panel message when user interacts inside the panel (click or keydown)
        try {
            if (panel) {
                panel.addEventListener('click', () => { if (panelMsgTimeout) { clearTimeout(panelMsgTimeout); panelMsgTimeout = null; } const pm = panel.querySelector('.panel-message'); if (pm) pm.textContent = ''; });
                panel.addEventListener('keydown', () => { if (panelMsgTimeout) { clearTimeout(panelMsgTimeout); panelMsgTimeout = null; } const pm = panel.querySelector('.panel-message'); if (pm) pm.textContent = ''; });
            }
        } catch (e) { /* ignore */ }

        // Create a single shared price tooltip element attached to the panel. Using one shared tooltip
        // avoids tooltip elements lingering when moving between price elements.
        try {
            if (panel && !panel.querySelector('.price-tooltip')) {
                const sharedTooltip = document.createElement('div');
                sharedTooltip.className = 'price-tooltip';
                panel.appendChild(sharedTooltip);
            }
        } catch (e) { /* ignore */ }

        // Attach Buy buttons for planet offerings and Sell buttons for player inventory
        try {
            const firstSection = panel.querySelector('.section'); // planet offerings
            const invSection = panel.querySelector('.section + .section'); // second section is inventory

            // Add remaining cargo capacity indicator in the header area
            const capacityIndicator = document.createElement('div');
            capacityIndicator.className = 'capacity-indicator';
            const remainingSpaceVal = getShipRemainingSpace(ship);
            // Show the ship's total capacity as well to make upgrades obvious
            const totalCap = (ship && typeof ship.cargoCapacity === 'number' && ship.cargoCapacity > 0) ? ship.cargoCapacity : 200;
            capacityIndicator.textContent = `Ship cargo remaining: ${remainingSpaceVal} / ${totalCap} units`;
            // Also show ship credits above the listings
            const creditsIndicator = document.createElement('div');
            creditsIndicator.className = 'credits-indicator';
            creditsIndicator.textContent = `Ship credits: ${ship && ship.credits ? ship.credits : 0} cr`;
            // Show reputation with this planet if available
            const reputationIndicator = document.createElement('div');
            reputationIndicator.className = 'reputation-indicator';
            try {
                const rep = planet && planet.civilization && typeof planet.civilization.reputation === 'number' ? planet.civilization.reputation : 0;
                const sign = rep > 0 ? '+' : '';
                reputationIndicator.textContent = `Reputation: ${sign}${rep}`;
            } catch (e) { reputationIndicator.textContent = 'Reputation: 0'; }
            if (firstSection) {
                firstSection.insertBefore(creditsIndicator, firstSection.firstChild);
                firstSection.insertBefore(capacityIndicator, creditsIndicator.nextSibling);
                firstSection.insertBefore(reputationIndicator, capacityIndicator.nextSibling);
            }

            // Attach Buy controls next to each market row
            if (firstSection) {
                const rows = firstSection.querySelectorAll('.info-row');
                rows.forEach(row => {
                    const idx = parseInt(row.getAttribute('data-market-index'), 10);

                    // Replace the price text with a price element that shows a tooltip on hover
                    try {
                        const spans = row.querySelectorAll('span');
                        const priceSpan = spans && spans[1];
                        if (priceSpan) {
                            const marketItem = planetOfferings[idx];
                            const priceEl = document.createElement('span');
                            priceEl.className = 'price-el';
                            priceEl.style.marginLeft = '8px';
                            priceEl.style.fontWeight = 'bold';
                            priceEl.textContent = (marketItem && marketItem.price ? marketItem.price : 0) + ' cr/unit';

                            function formatTooltip(cargoName, price) {
                                const def = getCargoDefByName(cargoName) || {};
                                const base = def.value || price || 1;
                                const pct = Math.round((price - base) / base * 100);
                                let pctText = '';
                                if (pct === 0) {
                                    pctText = '';
                                } else if (pct > 0) {
                                    pctText = '+' + pct + '%';
                                } else {
                                    pctText = pct + '%';
                                }

                                // Build tooltip DOM with colored percent span
                                // For planet offerings: a lower price (negative pct) is good for the player,
                                // so negative percentages should be blue/green. Positive pct (more expensive)
                                // should be highlighted as yellow/orange.
                                let color = '#fff';
                                if (pct < 0) {
                                    if (pct <= -11) color = '#66ff66'; // green (very cheap)
                                    else color = '#66c2ff'; // blue (cheap)
                                } else if (pct > 0) {
                                    if (pct >= 11) color = '#ff9900'; // orange (very expensive)
                                    else color = '#ffd700'; // yellow (expensive)
                                }

                                if (pct === 0) {
                                    return `${base} = ${price}`;
                                }

                                // Example: "45+19%=54" with percent colored
                                // We'll wrap the percent in a span so we can color it
                                return `<span>${base}</span><span style=\"margin:0 6px;color:${color};\">${pctText}</span><span>=${price}</span>`;
                            }

                            // Mouse handlers
                            let hideTimer = null;
                            priceEl.addEventListener('mouseenter', (ev) => {
                                try { ev.stopPropagation(); } catch (e) {}
                                if (hideTimer) { clearTimeout(hideTimer); hideTimer = null; }
                                const marketItemNow = planetOfferings[idx];
                                const price = marketItemNow && marketItemNow.price ? marketItemNow.price : 0;
                                const t = panel.querySelector('.price-tooltip');
                                if (!t) return;
                                t.innerHTML = formatTooltip(marketItemNow && marketItemNow.name, price);
                                t.style.display = 'block';
                                const rect = panel.getBoundingClientRect();
                                t.style.left = Math.min(panel.clientWidth - 10, (ev.pageX - rect.left) + 12) + 'px';
                                t.style.top = Math.max(6, (ev.pageY - rect.top) - 24) + 'px';
                            });
                            priceEl.addEventListener('mousemove', (ev) => {
                                try { ev.stopPropagation(); } catch (e) {}
                                const t = panel.querySelector('.price-tooltip');
                                if (!t) return;
                                const rect = panel.getBoundingClientRect();
                                t.style.left = Math.min(panel.clientWidth - 10, (ev.pageX - rect.left) + 12) + 'px';
                                t.style.top = Math.max(6, (ev.pageY - rect.top) - 24) + 'px';
                            });
                            priceEl.addEventListener('mouseleave', (ev) => {
                                try { ev.stopPropagation(); } catch (e) {}
                                const t = panel.querySelector('.price-tooltip');
                                if (!t) return;
                                if (hideTimer) clearTimeout(hideTimer);
                                hideTimer = setTimeout(() => { t.style.display = 'none'; hideTimer = null; }, 50);
                            });

                            // Replace original price span with interactive one
                            priceSpan.parentNode.replaceChild(priceEl, priceSpan);
                        }
                    } catch (e) { /* ignore tooltip injection errors */ }

                    const controls = document.createElement('span');
                    controls.className = 'controls';

                    const buyBtn = document.createElement('button');
                    // Ensure button does not act as a form submit and avoid bubbling to page-level handlers/extensions
                    buyBtn.type = 'button';
                    buyBtn.textContent = 'Buy';

                    // Inline quantity UI (hidden initially)
                    const qtyWrapper = document.createElement('span');
                    qtyWrapper.className = 'qty-wrapper';

                    const minus = document.createElement('button');
                    minus.textContent = '-';
                    minus.className = 'qty-minus';
                    const qtyInput = document.createElement('input');
                    qtyInput.type = 'number';
                    qtyInput.value = '1';
                    qtyInput.min = '1';
                    qtyInput.className = 'qty-input';
                    const plus = document.createElement('button');
                    plus.textContent = '+';
                    plus.className = 'qty-plus';

                    const maxBtn = document.createElement('button');
                    maxBtn.textContent = 'Max';
                    maxBtn.className = 'qty-max';

                    const confirmBtn = document.createElement('button');
                    confirmBtn.textContent = 'Confirm';
                    confirmBtn.className = 'qty-confirm';
                    const cancelBtn = document.createElement('button');
                    cancelBtn.textContent = 'Cancel';
                    cancelBtn.className = 'qty-cancel';

                    qtyWrapper.appendChild(minus);
                    qtyWrapper.appendChild(qtyInput);
                    qtyWrapper.appendChild(plus);
                    qtyWrapper.appendChild(maxBtn);
                    qtyWrapper.appendChild(confirmBtn);
                    qtyWrapper.appendChild(cancelBtn);

                    // Handlers
                        buyBtn.addEventListener('click', (ev) => {
                            try { ev.preventDefault(); ev.stopPropagation(); ev.stopImmediatePropagation(); } catch (e) {}
                        const marketItem = planetOfferings[idx];
                        if (!marketItem || marketItem.units <= 0) {
                            if (typeof setPanelMessage === 'function') setPanelMessage('Item out of stock'); else { const panelMsg = panel.querySelector('.panel-message'); if (panelMsg) { panelMsg.textContent = 'Item out of stock'; } else { G.showMessage('Item out of stock'); } }
                            return;
                        }

                        const maxByStock = marketItem.units;
                        const maxByCredits = Math.floor((ship.credits || 0) / marketItem.price);
                        const remainingSpace = getShipRemainingSpace(ship);
                        const def = getCargoDefByName(marketItem.name);
                        const perUnitSpace = def && def.storage_units ? def.storage_units : 1;
                        const maxBySpace = Math.floor(remainingSpace / perUnitSpace);
                        const maxAllowed = Math.max(0, Math.min(maxByStock, maxByCredits, maxBySpace));

                        if (maxAllowed <= 0) {
                            if (typeof setPanelMessage === 'function') setPanelMessage(NO_CARGO_SPACE_MSG); else { const panelMsg = panel.querySelector('.panel-message'); if (panelMsg) { panelMsg.textContent = NO_CARGO_SPACE_MSG; } else { G.showMessage(NO_CARGO_SPACE_MSG); } }
                            return;
                        }

                        // Show quantity controls and set limits
                        qtyInput.max = String(maxAllowed);
                        qtyInput.value = '1';
                        qtyWrapper.classList.add('open');
                        buyBtn.classList.add('hidden');

                        // Wire quantity controls with event suppression
                        minus.type = 'button';
                        plus.type = 'button';
                        maxBtn.type = 'button';
                        cancelBtn.type = 'button';
                        confirmBtn.type = 'button';

                        minus.addEventListener('click', (ev) => { try { ev.preventDefault(); ev.stopPropagation(); ev.stopImmediatePropagation(); } catch(e){}; qtyInput.value = String(Math.max(1, parseInt(qtyInput.value || '1', 10) - 1)); });
                        plus.addEventListener('click', (ev) => { try { ev.preventDefault(); ev.stopPropagation(); ev.stopImmediatePropagation(); } catch(e){}; qtyInput.value = String(Math.min(maxAllowed, parseInt(qtyInput.value || '1', 10) + 1)); });
                        maxBtn.addEventListener('click', (ev) => { try { ev.preventDefault(); ev.stopPropagation(); ev.stopImmediatePropagation(); } catch(e){}; qtyInput.value = String(maxAllowed); });

                        cancelBtn.addEventListener('click', (ev) => {
                            try { ev.preventDefault(); ev.stopPropagation(); ev.stopImmediatePropagation(); } catch(e){}
                            qtyWrapper.classList.remove('open');
                            buyBtn.classList.remove('hidden');
                        });

                        confirmBtn.addEventListener('click', (ev) => {
                            try { ev.preventDefault(); ev.stopPropagation(); ev.stopImmediatePropagation(); } catch(e){}
                            const qty = Math.max(0, Math.min(parseInt(qtyInput.value, 10) || 0, parseInt(qtyInput.max, 10) || 0));
                            if (qty <= 0) return;

                            const cost = qty * marketItem.price;
                            ship.credits = (ship.credits || 0) - cost;
                            ship.cargo = ship.cargo || {};
                            ship.cargo[marketItem.name] = (ship.cargo[marketItem.name] || 0) + qty;
                            marketItem.units -= qty;

                            G.showMessage('Purchased ' + qty + ' ' + marketItem.name + ' for ' + cost + ' credits');

                            // If this market slot has been depleted, replace it with a new offering
                            try {
                                if (marketItem.units <= 0) {
                                    if (typeof replaceMarketItem === 'function') {
                                        replaceMarketItem(planet, idx);
                                    }
                                }
                            } catch (e) { /* ignore */ }

                            // Refresh the panel so the UI reflects changed market and ship state
                            panel.remove();
                            window.createPlanetaryTradePanel(planet, ship);
                        });
                    });

                    controls.appendChild(buyBtn);
                    controls.appendChild(qtyWrapper);
                    row.appendChild(controls);
                });
            }

            if (invSection) {
                const entries = playerEntries;

                // Remove any existing informational rows in the inventory section to avoid duplicates
                try {
                    const existingRows = invSection.querySelectorAll('.info-row');
                    existingRows.forEach(r => r.remove());
                } catch (e) { /* ignore */ }
                entries.forEach((pe, i) => {
                    // Create price element with hover tooltip for comparison
                    try {
                        const priceEl = document.createElement('span');
                        priceEl.className = 'inv-price-el';
                        priceEl.textContent = `${pe.price} cr/unit`;

                        // Tooltip handlers (reuse logic similar to market rows)
                        priceEl.addEventListener('mouseenter', (ev) => {
                            try { ev.stopPropagation(); } catch (e) {}
                            const t = panel.querySelector('.price-tooltip') || (function(){
                                const tmp = document.createElement('div');
                                tmp.className = 'price-tooltip';
                                tmp.style.position = 'absolute';
                                tmp.style.pointerEvents = 'none';
                                tmp.style.background = 'rgba(0,0,0,0.85)';
                                tmp.style.color = '#fff';
                                tmp.style.padding = '6px 8px';
                                tmp.style.borderRadius = '4px';
                                tmp.style.fontSize = '12px';
                                tmp.style.zIndex = 9999;
                                tmp.style.display = 'none';
                                tmp.style.whiteSpace = 'nowrap';
                                panel.appendChild(tmp);
                                return tmp;
                            })();
                            const def = getCargoDefByName(pe.name) || {};
                            const base = def.value || pe.price || 1;
                            const pct = Math.round((pe.price - base) / base * 100);
                            let color = '#fff';
                            if (pct < 0) {
                                color = pct <= -11 ? '#ff9900' : '#ffd700';
                            } else if (pct > 0) {
                                color = pct >= 11 ? '#66ff66' : '#66c2ff';
                            }
                            const pctText = pct === 0 ? '' : (pct > 0 ? '+' + pct + '%' : pct + '%');
                            if (pct === 0) {
                                t.innerHTML = `${base} = ${pe.price}`;
                            } else {
                                t.innerHTML = `<span>${base}</span><span style=\"margin:0 6px;color:${color};\">${pctText}</span><span>=${pe.price}</span>`;
                            }
                            t.style.display = 'block';
                            const rect = panel.getBoundingClientRect();
                            t.style.left = Math.min(panel.clientWidth - 10, (ev.pageX - rect.left) + 12) + 'px';
                            t.style.top = Math.max(6, (ev.pageY - rect.top) - 24) + 'px';
                        });
                        priceEl.addEventListener('mousemove', (ev) => {
                            try { ev.stopPropagation(); } catch (e) {}
                            const t = panel.querySelector('.price-tooltip');
                            if (!t) return;
                            const rect = panel.getBoundingClientRect();
                            t.style.left = Math.min(panel.clientWidth - 10, (ev.pageX - rect.left) + 12) + 'px';
                            t.style.top = Math.max(6, (ev.pageY - rect.top) - 24) + 'px';
                        });
                        priceEl.addEventListener('mouseleave', (ev) => {
                            try { ev.stopPropagation(); } catch (e) {}
                            const t = panel.querySelector('.price-tooltip');
                            if (t) t.style.display = 'none';
                        });
                        // Append the price element plus Sell button to the inventory section row
                        const row = document.createElement('div');
                        row.className = 'info-row';
                        row.innerHTML = `<span>${pe.name} (${pe.units} units)</span>`;
                        row.appendChild(priceEl);

                        const sellBtn = document.createElement('button');
                        sellBtn.type = 'button';
                        sellBtn.textContent = `Sell ${pe.name}`;
                        sellBtn.className = 'sell-btn';
                        // Prevent mousedown from bubbling to avoid extension/content-script side effects
                        sellBtn.addEventListener('mousedown', (ev) => { try { ev.preventDefault(); ev.stopPropagation(); ev.stopImmediatePropagation(); } catch(e) {} });
                        sellBtn.addEventListener('click', (ev) => {
                            try { ev.preventDefault(); ev.stopPropagation(); ev.stopImmediatePropagation(); } catch(e) {}
                            const units = pe.units || 0;
                            const total = units * pe.price;
                            if (units > 0) {
                                if (ship.cargo && ship.cargo[pe.name] !== undefined) {
                                    // Remove the cargo key entirely so inventory reflects the removal
                                    try { delete ship.cargo[pe.name]; } catch (e) { ship.cargo[pe.name] = 0; }
                                } else if (ship.civilization && ship.civilization.resources) {
                                    ship.civilization.resources = 0;
                                }
                                ship.credits = (ship.credits || 0) + total;
                                G.showMessage('Sold ' + units + ' ' + pe.name + ' for ' + total + ' credits');
                                panel.remove();
                                window.createPlanetaryTradePanel(planet, ship);
                            }
                        });
                        row.appendChild(sellBtn);
                        invSection.appendChild(row);
                    } catch (e) { /* ignore inventory tooltip/sell UI errors */ }

                });
            }
        } catch (e) { console.error('planetary-trade: failed to attach sell buttons', e); }

        return panel;
    };

    // Provide a global undock function for planetary trade
    window.planetaryUndock = function() {
        try {
            const p = document.getElementById('planetary-trade-panel');
            if (p) p.remove();
            if (U && U.playerShip) {
                U.playerShip.dockedPlanet = null;
                U.playerShip.isDocked = false;
                U.playerShip.inTradingInterface = false;
                U.playerShip.dockOffset = null;
            }
        } catch (e) { console.error('planetaryUndock error', e); }
    };

    // Small helper to ensure createMenuPanel is available; if not, no-op but avoid crash
    function ensureCreateMenuPanelExists() {
        if (!window.createMenuPanel) {
            window.createMenuPanel = function() {
                console.warn('createMenuPanel not found - Planetary trade unavailable');
                return null;
            };
        }
    }

})();
