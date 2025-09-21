class OrbitalStation {

    constructor(star, orbitRadius, orbitPhase) {
        this.star = star;
        this.orbitRadius = orbitRadius;
        this.orbitPhase = orbitPhase;
        this.radius = 60; // About 1/3 planet size (planets are ~150-200)
        this.reachRadius = this.radius * 3;
        
        this.health = 1;
        this.lastDamage = 0;
        this.showingDockPrompt = false;
        
        // Trading properties - 10 resources (±3) per 1 credit
        const baseRate = 10; // 10 resources per credit
        const variation = (Math.random() - 0.5) * 6; // ±3 variation
        this.resourcesPerCredit = baseRate + variation; // 7-13 resources per credit
        this.tradeRate = 1 / this.resourcesPerCredit; // credits per resource
        
        // Create a neutral civilization for the station
        this.civilization = new Civilization(this, 0.5);
        
        this.updatePosition();
    }

    updatePosition() {
        this.x = this.star.x + cos(this.orbitPhase) * this.orbitRadius;
        this.y = this.star.y + sin(this.orbitPhase) * this.orbitRadius;
    }

    cycle(e) {
        // Orbit around the star more slowly than planets
        const yearTime = TWO_PI * this.orbitRadius / 15; // Half speed of planets
        const angularVelocity = TWO_PI / yearTime;
        this.orbitPhase += e * angularVelocity;
        
        this.updatePosition();
        
        // Check for docking proximity (4 ship lengths = ~120 units)
        const dockingDistance = 120;
        const playerDistance = dist(this, U.playerShip);
        
        if (playerDistance < dockingDistance && !this.showingDockPrompt) {
            this.showingDockPrompt = true;
            // Compute Station title for HUD while approaching
            let title = (this.star && this.star.name ? this.star.name : 'Unknown') + ' - Station - 1';
            try {
                if (U && U.orbitalStations) {
                    const siblings = U.orbitalStations.filter(s => s.star === this.star);
                    const index = siblings.indexOf(this) + 1 || 1;
                    title = (this.star && this.star.name ? this.star.name : 'Unknown') + ' - Station - ' + index;
                }
            } catch (e) {
                // ignore and fall back to default title
            }

            G.showPrompt(`${title}\nPress [D] to dock`);
        } else if (playerDistance >= dockingDistance && this.showingDockPrompt) {
            this.showingDockPrompt = false;
            G.showPrompt();
        }
    }

    render() {
        // Always draw white orbital ring (like planets do)
        translate(this.star.x, this.star.y);
        R.strokeStyle = '#fff';
        R.lineWidth = 1;
        R.globalAlpha = 0.3;
        beginPath();
        arc(0, 0, this.orbitRadius, 0, TWO_PI);
        stroke();
        R.globalAlpha = 1;

        // Only draw the station itself if visible
        if (!V.isVisible(this, this.radius)) {
            return;
        }

        translate(this.x - this.star.x, this.y - this.star.y);
        
        const damageFactor = 1 - limit(0, G.clock - this.lastDamage, 0.1) / 0.1;
        scale(1 + damageFactor * 0.2, 1 + damageFactor * 0.2);

        // Color based on relationship and damage
        const color = damageFactor > 0 ? '#fff' : 
            (this.civilization.relationshipType() === RELATIONSHIP_ENEMY ? '#f00' : 
             (this.civilization.relationshipType() === RELATIONSHIP_ALLY ? '#0f0' : '#ff0'));
        
        fs(color);
        R.lineWidth = 4;
        
        // Draw larger triangular station
        beginPath();
        moveTo(0, -30);
        lineTo(-26, 20);
        lineTo(26, 20);
        closePath();
        fill();
        stroke();
        
        // Draw center core
        fs('#888');
        beginPath();
        arc(0, 0, 8, 0, TWO_PI);
        fill();
    }

    damage(source, amount) {
        if (source.owner == U.playerShip) {
            particle('#ff0', [
                ['alpha', 1, 0, 1],
                ['size', rnd(2, 4), rnd(5, 10), 1],
                ['x', this.x, this.x + rnd(-20, 20), 1],
                ['y', this.y, this.y + rnd(-20, 20), 1]
            ]);

            this.lastDamage = G.clock;
            this.civilization.updateRelationship(RELATIONSHIP_UPDATE_DAMAGE_STATION);
            this.civilization.wasAttackedByPlayer = true;

            if ((this.health -= amount) <= 0) {
                this.explode(source);
            }
        }
    }

    dock() {
        console.log("Dock method called");
        
        // Clear the prompt
        G.showPrompt();
        
        // Connect ship to station - position ship touching the station
        U.playerShip.dockedStation = this;
        U.playerShip.isDocked = true;
        U.playerShip.inTradingInterface = true;
        
        console.log("Ship docked, isDocked:", U.playerShip.isDocked);
        
        // Initialize player credits if not set
        if (U.playerShip.credits === undefined) {
            U.playerShip.credits = 0;
        }
        
        // Calculate angle from station to ship
        const angleToShip = angleBetween(this, U.playerShip);
        
        // Position ship at station edge (station radius + small gap)
        const dockDistance = this.radius + 15; // Small gap for visual clarity
        U.playerShip.dockOffset = {
            x: cos(angleToShip) * dockDistance,
            y: sin(angleToShip) * dockDistance
        };
        
        console.log("About to show trading interface");
        
        // Show trading interface
        this.showTradingInterface();
    }
    
    showTradingInterface() {
        const playerResources = U.playerShip.civilization ? U.playerShip.civilization.resources : 0;
        const playerCredits = U.playerShip.credits || 0;
        const tradeValue = Math.floor(playerResources * this.tradeRate);
        const repairCost = 20;
        const canRepair = playerCredits >= repairCost && (U.playerShip.health < 1 || U.playerShip.shield < 1);
        
        // Compute station index within this star's orbital stations (1-based)
        let index = 1;
        try {
            if (U && U.orbitalStations) {
                const siblings = U.orbitalStations.filter(s => s.star === this.star);
                index = siblings.indexOf(this) + 1 || 1;
            }
        } catch (e) {
            index = 1;
        }

    const title = (this.star && this.star.name ? this.star.name : 'Unknown') + ' - Station - ' + index;
        
        // Use the global function to create the panel (now accepts a title first)
        if (window.createTradingPanel) {
            window.createTradingPanel(title, playerResources, playerCredits, this.resourcesPerCredit, tradeValue, repairCost, canRepair, {
                // Provide a hook for additional buttons in the trading panel UI
                extraButtons: [{
                        label: nomangle('Mod Bay'),
                        onClick: () => {
                            try {
                                // Mark the station as pending (fallback) and dispatch a CustomEvent so
                                // opening the Mod Bay is decoupled from direct function calls that
                                // some extensions/content-scripts may interfere with.
                                try { window.__SS_pendingModBayStation = this; } catch (e) {}
                                window.dispatchEvent(new CustomEvent('solarspark:openModBay', { detail: { station: this } }));

                                // Poll for the mod-bay module being loaded; if it appears, call openModBay
                                // as a fallback. This helps when the event was dispatched before the
                                // mod-bay listener attached.
                                try {
                                    let attempts = 0;
                                    const poll = setInterval(() => {
                                        try {
                                            attempts++;
                                            if (window.__SS_modBayLoaded && typeof window.openModBay === 'function') {
                                                try { console.debug('station: polling detected mod-bay loaded, calling openModBay', attempts); } catch (e) {}
                                                try { window.openModBay(this); } catch (e) { console.error('station: fallback openModBay error', e); }
                                                clearInterval(poll);
                                                try { delete window.__SS_pendingModBayStation; } catch (e) { window.__SS_pendingModBayStation = null; }
                                                return;
                                            }
                                            if (attempts > 8) { clearInterval(poll); }
                                        } catch (e) { clearInterval(poll); }
                                    }, 60);
                                } catch (e) {}
                            } catch (e) { /* ignore */ }
                        }
                    }]
            });
        } else {
            // Fallback to simple prompt if panel function not available
            const options = [];
            if (playerResources > 0) {
                options.push({label: `Sell Resources (${tradeValue} credits)`, action: () => this.sellResources()});
            }
            if (canRepair) {
                options.push({label: `Repair Ship (${repairCost} credits)`, action: () => this.repairShip()});
            }
            options.push({label: 'Leave Station', action: () => this.undock()});
            
            G.showPrompt(`${title}\nResources: ${playerResources}\nCredits: ${playerCredits}\nRate: ${this.resourcesPerCredit.toFixed(1)} resources/credit\nSell Value: ${tradeValue}`, options);
        }
    }
    
    sellResources() {
        const playerResources = U.playerShip.civilization ? U.playerShip.civilization.resources : 0;
        const tradeValue = Math.floor(playerResources * this.tradeRate);
        
        if (playerResources > 0) {
            // Add credits to player
            U.playerShip.credits = (U.playerShip.credits || 0) + tradeValue;
            
            // Remove resources from player
            if (U.playerShip.civilization) {
                U.playerShip.civilization.resources = 0;
            }
        }
        
        // Refresh the trading interface
        this.showTradingInterface();
    }
    
    repairShip() {
        const repairCost = 20;
        const playerCredits = U.playerShip.credits || 0;
        
        if (playerCredits >= repairCost && (U.playerShip.health < 1 || U.playerShip.shield < 1)) {
            // Deduct credits
            U.playerShip.credits -= repairCost;
            
            // Restore health and shields to full
            U.playerShip.health = 1;
            U.playerShip.shield = 1;
        }
        
        // Refresh the trading interface
        this.showTradingInterface();
    }
    
    undock() {
        // Remove trading panel
        const tradingPanel = document.getElementById('trading-panel');
        if (tradingPanel) {
            tradingPanel.remove();
        }
        
        // Disconnect ship from station
        if (U.playerShip.dockedStation === this) {
            U.playerShip.dockedStation = null;
            U.playerShip.isDocked = false;
            U.playerShip.dockOffset = null;
            U.playerShip.inTradingInterface = false;
        }
        
        // Clear any remaining prompts
        G.showPrompt();
    }

    explode(source) {
        for (let i = 0; i < 50; i++) {
            const angle = random() * TWO_PI;
            const distance = rnd(30, 50);

            particle(pick(['#ff0', '#f80', '#f00']), [
                ['alpha', 1, 0, 1],
                ['size', rnd(2, 4), rnd(5, 10), 1],
                ['x', this.x, this.x + cos(angle) * distance, 1],
                ['y', this.y, this.y + sin(angle) * distance, 1]
            ]);
        }

        U.remove(U.orbitalStations, this);

        if (source == U.playerShip) {
            this.civilization.updateRelationship(RELATIONSHIP_UPDATE_DESTROY_STATION);
        }

        U.dropResources(this.x, this.y, 15);
    }

    nameWithRelationship() {
        return 'Orbital Station (' + this.civilization.relationshipLabel() + ')';
    }

}
