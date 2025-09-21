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
        
        // Debug shortcut: SHIFT + Q grants 10000 credits while in a station/planet trading interface
        try {
            if (character === 'q' && e.shiftKey && U && U.playerShip && U.playerShip.inTradingInterface) {
                U.playerShip.credits = (U.playerShip.credits || 0) + 10000;
                try { G.showMessage && G.showMessage('Granted 10000 credits (debug)'); } catch (e2) { console.log('Granted 10000 credits (debug)'); }
            }
        } catch (err) { /* ignore debug key errors */ }
    } catch (err) {
        // Fail silently - keyboard shouldn't break the game
        console.log('Dock/Trade attempt error:', err && err.message);
    }
    try {
        // Access Incoming Communications with the 'A' key
        if (character === 'a' && typeof U !== 'undefined' && U && U.playerShip) {
            // Find a visible planet that currently has an offer (prefer closest)
            const visibleOffers = (U.bodies || []).filter(body => body instanceof Planet && body.hasOffer && V.isVisible(body, body.radius + 50));
            if (!visibleOffers.length) return;

            // pick the closest visible offered planet
            let chosen = visibleOffers.reduce((best, p) => {
                if (!best) return p;
                return dist(p, U.playerShip) < dist(best, U.playerShip) ? p : best;
            }, null);

            if (!chosen) return;

            // If planet is friendly and player is in reach, show a combined prompt with Dock (D) and Accept (A)
            const isFriendly = chosen.civilization && chosen.civilization.relationshipType && chosen.civilization.relationshipType() === RELATIONSHIP_ALLY;
            const playerDistance = dist(chosen, U.playerShip);
            if (isFriendly && playerDistance < chosen.reachRadius) {
                const title = (chosen.name || 'Unknown');
                G.showPrompt(title + '\nPress [D] to dock\nPress [A] to accept incoming communication', [{
                    'label': nomangle('Dock'),
                    'action': () => {
                        if (window.createPlanetaryTradePanel) {
                            window.createPlanetaryTradePanel(chosen, U.playerShip);
                        } else {
                            G.showPrompt((chosen.name || 'Unknown') + '\nPlanetary trade unavailable');
                        }
                    }
                }, {
                    'label': nomangle('Accept'),
                    'action': () => { if (G && typeof G.promptMissionFromPlanet === 'function') G.promptMissionFromPlanet(chosen); }
                }, {
                    'label': nomangle('Ignore'),
                    'action': () => G.showPrompt()
                }]);
            } else {
                // Otherwise, directly start the mission prompt flow for that planet
                if (G && typeof G.promptMissionFromPlanet === 'function') G.promptMissionFromPlanet(chosen);
            }
        }
    } catch (err) {
        console.log('Access offers (A) error:', err && err.message);
    }
};
