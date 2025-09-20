w.down = {};
onkeydown = e => {
    w.down[e.keyCode] = true;
};
onkeyup = e => {
    w.down[e.keyCode] = false;
    const character = String.fromCharCode(e.keyCode).toLowerCase();
    if (isNaN(character)) {
        G.selectPromptOption(character);
    }

    // Docking / trading shortcut: press 'D' to dock to a nearby orbital station or open planetary trade when in range
    try {
    if (character === 'd' && typeof U !== 'undefined' && U && U.playerShip) {
            // First try orbital stations (within 120 units)
            if (U.orbitalStations) {
                const nearbyStation = U.orbitalStations.find(station => dist(station, U.playerShip) < 120);
                if (nearbyStation) {
                    nearbyStation.dock();
                    return;
                }
            }

            // Next, check planets (within planet.reachRadius)
            if (U.bodies) {
                const nearbyPlanet = U.bodies.find(body => body instanceof Planet && dist(body, U.playerShip) < body.reachRadius && body.civilization && body.civilization.relationshipType && body.civilization.relationshipType() === RELATIONSHIP_ALLY);
                if (nearbyPlanet) {
                    if (window.createPlanetaryTradePanel) {
                        window.createPlanetaryTradePanel(nearbyPlanet, U.playerShip);
                    } else {
                        G.showPrompt((nearbyPlanet.name || 'Unknown') + '\nPlanetary trade unavailable');
                    }
                }
            }
        }

        // Allow Leave (L) and Escape to undock from planetary trade when docked to a planet
        try {
            if ((character === 'l' || e.keyCode === 27) && U.playerShip && U.playerShip.inTradingInterface && U.playerShip.dockedPlanet) {
                if (window.planetaryUndock) window.planetaryUndock();
            }
        } catch (err) {
            console.log('Undock attempt error:', err && err.message);
        }
    } catch (err) {
        // Fail silently - keyboard shouldn't break the game
        console.log('Dock/Trade attempt error:', err && err.message);
    }
};
