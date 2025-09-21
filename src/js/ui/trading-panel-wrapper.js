// Thin wrapper to preserve the old createTradingPanel signature while leveraging createMenuPanel
(function(){
    window.createTradingPanel = function(title, playerResources, playerCredits, resourcesPerCredit, tradeValue, repairCost, canRepair, options) {
        try { console.debug('createTradingPanel wrapper called', title); } catch(e) {}
        const sections = [];

        sections.push({
            title: 'INVENTORY',
            rows: [
                {label: 'Resources:', value: `${playerResources} units`},
                {label: 'Credits:', value: `${playerCredits}`}
            ]
        });

        sections.push({
            title: 'TRADE RATES',
            rows: [
                {label: 'Exchange Rate:', value: `${resourcesPerCredit.toFixed(1)} resources/credit`},
                {label: 'Sell Value:', value: `${tradeValue} credits`}
            ]
        });

        sections.push({
            title: 'SERVICES',
            rows: [
                {label: 'Ship Repair:', value: `${repairCost} credits`}
            ],
            extraHtml: '<div style="text-align:center;color:#888;font-size:12px;margin-top:8px;">Ship upgrades and cargo coming soon...</div>'
        });

        const buttons = [];
        if (playerResources > 0) {
            buttons.push({
                label: `[S] Sell Resources (${tradeValue} credits)`,
                onClick: function() { if (U.playerShip && U.playerShip.dockedStation) U.playerShip.dockedStation.sellResources(); }
            });
        }
        if (canRepair) {
            buttons.push({
                label: `[R] Repair Ship (${repairCost} credits)`,
                onClick: function() { if (U.playerShip && U.playerShip.dockedStation) U.playerShip.dockedStation.repairShip(); }
            });
        }
        // Append any extra buttons provided via options (e.g., Mod Bay)
        try {
            if (options && Array.isArray(options.extraButtons)) {
                options.extraButtons.forEach((b, idx) => {
                    const orig = b.onClick || b.action || function() {};
                    const wrapped = function(ev) {
                        try { console.debug('trading-panel: extra button invoked', idx, b && b.label); } catch (e) {}
                        // Immediately dispatch the openModBay event and set a pending station marker
                        try {
                            try { window.__SS_pendingModBayStation = (U && U.playerShip && U.playerShip.dockedStation) || null; } catch (e) {}
                            try { window.dispatchEvent(new CustomEvent('solarspark:openModBay', { detail: { station: (U && U.playerShip && U.playerShip.dockedStation) || null } })); } catch (e) {}
                        } catch (e) {}
                        // Still call the original handler (deferred) in case it contains other logic
                        try { setTimeout(() => { try { orig(ev); } catch (e) { console.error('extraButton handler error', e); } }, 25); } catch (e) { try { orig(ev); } catch (e2) { console.error('extraButton handler fallback error', e2); } }
                    };

                    buttons.push({
                        label: b.label || b.labelText || 'Extra',
                        onClick: wrapped,
                        // Ensure these extra UI hooks do not auto-close the trading panel
                        autoClose: (typeof b.autoClose !== 'undefined') ? b.autoClose : false
                    });
                });
            }
        } catch (e) { /* ignore */ }
        buttons.push({
            label: `[L] Leave Station`,
            onClick: function() { if (U.playerShip && U.playerShip.dockedStation) U.playerShip.dockedStation.undock(); }
        });

        try {
            const dbgButtons = buttons.map(b => ({ label: b.label, autoClose: b.autoClose, hasOnClick: (typeof b.onClick === 'function') }));
            try { console.debug('createTradingPanel: final buttons', dbgButtons); } catch (e) { console.log('createTradingPanel: final buttons', dbgButtons); }
        } catch (e) {}

        return window.createMenuPanel({
            id: 'trading-panel',
            title: title,
            sections: sections,
            buttons: buttons,
                noClose: true,
            onClose: function() {
                // Ensure dock state is cleared if trading-panel closed with no undock
                if (U.playerShip && U.playerShip.inTradingInterface && U.playerShip.dockedStation) {
                    // Keep the ship docked but clear the inTradingInterface flag
                    U.playerShip.inTradingInterface = false;
                }
            }
        });
    };
})();
