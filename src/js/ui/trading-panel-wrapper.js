// Thin wrapper to preserve the old createTradingPanel signature while leveraging createMenuPanel
(function(){
    window.createTradingPanel = function(title, playerResources, playerCredits, resourcesPerCredit, tradeValue, repairCost, canRepair) {
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
        buttons.push({
            label: `[L] Leave Station`,
            onClick: function() { if (U.playerShip && U.playerShip.dockedStation) U.playerShip.dockedStation.undock(); }
        });

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
