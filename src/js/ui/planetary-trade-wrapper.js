// Wrapper to create a Planetary Trade panel using createMenuPanel
(function(){
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
                let price = Math.max(1, Math.floor(3 + (Math.random() * 5)));
                try {
                    if (planet) {
                        price = getPlanetPrice(planet, k);
                    }
                } catch (e) {}
                entries.push({ name: k, units: ship.cargo[k], price });
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
        const CAP = 200;
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
        const invRows = [];
        playerEntries.forEach(pe => {
            invRows.push({ label: pe.name, value: `${pe.units} units @ ${pe.price} cr` });
        });
        sections.push({ title: 'INVENTORY', rows: invRows });

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
                    headerMsg.style.color = '#f88';
                    headerMsg.style.marginTop = '6px';
                    headerMsg.style.minHeight = '18px';
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

        // Attach Buy buttons for planet offerings and Sell buttons for player inventory
        try {
            const firstSection = panel.querySelector('.section'); // planet offerings
            const invSection = panel.querySelector('.section + .section'); // second section is inventory

            // Add remaining cargo capacity indicator in the header area
            const capacityIndicator = document.createElement('div');
            capacityIndicator.style.margin = '6px 0 12px 0';
            capacityIndicator.style.fontWeight = 'bold';
            capacityIndicator.style.color = '#ffd';
            const remainingSpaceVal = getShipRemainingSpace(ship);
            capacityIndicator.textContent = `Ship cargo remaining: ${remainingSpaceVal} units`;
            // Also show ship credits above the listings
            const creditsIndicator = document.createElement('div');
            creditsIndicator.style.margin = '6px 0 6px 0';
            creditsIndicator.style.fontWeight = 'bold';
            creditsIndicator.style.color = '#ffd';
            creditsIndicator.textContent = `Ship credits: ${ship && ship.credits ? ship.credits : 0} cr`;
            if (firstSection) {
                firstSection.insertBefore(creditsIndicator, firstSection.firstChild);
                firstSection.insertBefore(capacityIndicator, creditsIndicator.nextSibling);
            }

            // Attach Buy controls next to each market row
            if (firstSection) {
                const rows = firstSection.querySelectorAll('.info-row');
                rows.forEach(row => {
                    const idx = parseInt(row.getAttribute('data-market-index'), 10);

                    const controls = document.createElement('span');
                    controls.style.marginLeft = '8px';

                    const buyBtn = document.createElement('button');
                    // Ensure button does not act as a form submit and avoid bubbling to page-level handlers/extensions
                    buyBtn.type = 'button';
                    buyBtn.textContent = 'Buy';
                    buyBtn.style.marginRight = '6px';

                    // Inline quantity UI (hidden initially)
                    const qtyWrapper = document.createElement('span');
                    qtyWrapper.style.display = 'none';
                    qtyWrapper.style.alignItems = 'center';

                    const minus = document.createElement('button');
                    minus.textContent = '-';
                    minus.style.marginRight = '4px';
                    const qtyInput = document.createElement('input');
                    qtyInput.type = 'number';
                    qtyInput.value = '1';
                    qtyInput.min = '1';
                    qtyInput.style.width = '48px';
                    qtyInput.style.marginRight = '4px';
                    const plus = document.createElement('button');
                    plus.textContent = '+';
                    plus.style.marginRight = '8px';

                    const maxBtn = document.createElement('button');
                    maxBtn.textContent = 'Max';
                    maxBtn.style.marginRight = '8px';

                    const confirmBtn = document.createElement('button');
                    confirmBtn.textContent = 'Confirm';
                    confirmBtn.style.marginRight = '4px';
                    const cancelBtn = document.createElement('button');
                    cancelBtn.textContent = 'Cancel';

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
                            if (typeof setPanelMessage === 'function') setPanelMessage('Not enough credits or cargo space'); else { const panelMsg = panel.querySelector('.panel-message'); if (panelMsg) { panelMsg.textContent = 'Not enough credits or cargo space'; } else { G.showMessage('Not enough credits or cargo space'); } }
                            return;
                        }

                        // Show quantity controls and set limits
                        qtyInput.max = String(maxAllowed);
                        qtyInput.value = '1';
                        qtyWrapper.style.display = 'inline-flex';
                        buyBtn.style.display = 'none';

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
                            qtyWrapper.style.display = 'none';
                            buyBtn.style.display = 'inline-block';
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

                            // Refresh the panel
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
                entries.forEach((pe, i) => {
                    const sellBtn = document.createElement('button');
                    sellBtn.type = 'button';
                    sellBtn.textContent = `Sell ${pe.name}`;
                    sellBtn.style.marginLeft = '8px';
                    sellBtn.addEventListener('click', (ev) => {
                        try { ev.preventDefault(); ev.stopPropagation(); ev.stopImmediatePropagation(); } catch(e) {}
                        // Simple sell logic: remove all units and add credits = units * price
                        const units = pe.units || 0;
                        const total = units * pe.price;
                        if (units > 0) {
                            // Deduct from ship
                            if (ship.cargo && ship.cargo[pe.name] !== undefined) {
                                ship.cargo[pe.name] = 0;
                            } else if (ship.civilization && ship.civilization.resources) {
                                ship.civilization.resources = 0;
                            }
                            ship.credits = (ship.credits || 0) + total;
                            G.showMessage('Sold ' + units + ' ' + pe.name + ' for ' + total + ' credits');

                            // Refresh the panel: remove and recreate (keep dock state)
                            panel.remove();
                            window.createPlanetaryTradePanel(planet, ship);
                        }
                    });
                    invSection.appendChild(sellBtn);
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
