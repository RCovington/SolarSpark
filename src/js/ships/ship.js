class Ship {

    constructor(civilization) {
        this.civilization = civilization;

        this.x = this.y = 0;
        this.vX = this.vY = 0;

        // Controls
        this.thrust = 0;
        this.rotationDirection = 0;

        this.angle = 0;

        this.radius = 20;
        this.reachRadius = 200;

        this.health = 1;

        this.heat = 0;
    }

    cycle(e) {
        // If the ship is docked to a planet or station, lock its position to the dock target
        try {
            if (this.isDocked && (this.dockedPlanet || this.dockedStation)) {
                const dockTarget = this.dockedPlanet || this.dockedStation;
                if (this.dockOffset && typeof this.dockOffset.x === 'number' && typeof this.dockOffset.y === 'number') {
                    this.x = dockTarget.x + this.dockOffset.x;
                    this.y = dockTarget.y + this.dockOffset.y;
                } else {
                    // fallback: place at target edge
                    const angleToShip = angleBetween(dockTarget, this);
                    const dockDistance = (dockTarget.radius || 0) + 15;
                    this.x = dockTarget.x + Math.cos(angleToShip) * dockDistance;
                    this.y = dockTarget.y + Math.sin(angleToShip) * dockDistance;
                    this.dockOffset = { x: this.x - dockTarget.x, y: this.y - dockTarget.y };
                }
                // Prevent movement while docked
                this.vX = this.vY = 0;
                this.thrust = 0;
                this.rotationDirection = 0;
            } else {
                this.x += this.vX * e;
                this.y += this.vY * e;
            }
        } catch (e) {
            // fallback to original behavior on error
            this.x += this.vX * e;
            this.y += this.vY * e;
        }

        if (this.thrust && !this.uncontrolledRotation) {
            this.vX += this.thrust * cos(this.angle) * SHIP_ACCELERATION * e;
            this.vY += this.thrust * sin(this.angle) * SHIP_ACCELERATION * e;

            for (let i = 0 ; i < ceil(e * 60) ; i++) {
                particle('#fff', [
                    ['alpha', 1, 0, 1],
                    ['size', rnd(2, 4), rnd(5, 10), 1],
                    ['x', this.x, this.x + rnd(-20, 20), 1],
                    ['y', this.y, this.y + rnd(-20, 20), 1]
                ]);
            }
        }

        const angle = atan2(this.vY, this.vX);
        const velocity = min(max(0, distP(0, 0, this.vX, this.vY) - SHIP_DECELERATION * e), SHIP_MAX_SPEED);

        this.vX = velocity * cos(angle);
        this.vY = velocity * sin(angle);

        this.angle += e * (this.uncontrolledRotation || this.rotationDirection) * SHIP_ROTATION_SPEED;

        // Cooling behavior: allow ship-specific thermalRecovery to speed up cooldown.
        // thermalRecovery is treated as a multiplier where lower values are faster (Mod Bay reduces this value).
        try {
            const baseCoolingRate = 0.5; // default heat units per second
            const tr = (this.baseStats && typeof this.baseStats.thermalRecovery === 'number') ? this.baseStats.thermalRecovery : (typeof this.thermalRecovery === 'number' ? this.thermalRecovery : 1);
            // Protect against invalid values
            const effectiveRecovery = Math.max(0.05, tr); // clamp to avoid division by near-zero

            // Reduce heat once per cycle, but only after a short post-shot window to match original behavior.
            // This preserves the original 0.5s delay before cooling starts. If coolingDown due to overheat,
            // apply a larger factor to make overheat recovery slightly faster, but still wait the 0.5s.
            if ((G.clock - (this.lastShot || 0)) > 0.5) {
                const factor = this.coolingDown ? 1.5 : 1;
                this.heat -= e * (baseCoolingRate / effectiveRecovery) * factor;
            }

            if (this.heat <= 0) {
                this.heat = 0;
                this.coolingDown = false;
            }
        } catch (e) {
            // fallback to original behaviour on error
            if ((G.clock - (this.lastShot || 0)) > 0.5) {
                this.heat -= e * 0.5;
            }

            if (this.heat <= 0) {
                this.coolingDown = false;
            }
        }
    }

    // For reference only
    // shipColor() {

    // }

    render() {
        if (!V.isVisible(this, this.radius)) {
            return;
        }

        // if (DEBUG) {
        //     G.renderedShips++;
        // }

        // wrap(() => {
            fs(1 - limit(0, G.clock - this.lastDamage, 0.1) / 0.1 > 0 ? '#f00' : this.shipColor());
            translate(this.x, this.y);
            rotate(this.angle);
            beginPath();
            moveTo(-5, 0);
            lineTo(-10, 10);
            lineTo(20, 0);
            lineTo(-10, -10);
            fill();
        // });

        // Shadow effect relative to the closest star
        const closestStar = U.stars
            .reduce((closest, star) => !closest || dist(closest, this) > dist(star, this) ? star : closest, null);

        if (closestStar) {
            const angleToClosestStar = normalize(this.angle - angleBetween(this, closestStar));
            // const alpha = 1 - abs(abs(angleToClosestStar) / PI - 1 / 2) * 2;

            // wrap(() => {
                fs('#000');

                // This is crazy but I gotta save the byes
                R.globalAlpha = (1 - abs(abs(angleToClosestStar) / PI - 1 / 2) * 2) * limit(0, (1 - dist(closestStar, this) / 5000), 1);
                // translate(this.x, this.y);
                // rotate(this.angle);

                beginPath();
                moveTo(-5, 0);
                lineTo(-10, sign(angleToClosestStar) * 10);
                lineTo(20, 0);
                fill();
            // });
        }
    }

    shoot(type, interval = SHIP_SHOT_INTERVAL) {
        if ((G.clock - (this.lastShot || 0)) < interval || this.coolingDown) {
            return;
        }

        this.lastShot = G.clock;

        const projectile = new type(this, this.x, this.y, this.angle);
        this.modifyProjectile(projectile);
        U.projectiles.push(projectile);

        this.heat = min(1, max(this.heat, 0) + projectile.heat);

        G.eventHub.emit(EVENT_SHOT, projectile);

        if (this.heat >= 1) {
            this.coolingDown = true;
        }
    }

    modifyProjectile() {
        // nothing, PlayerShip needs this tho
    }

    damage(projectile, amount) {
        // Invulnerable while docked
        try { if (this.isDocked) return; } catch (e) {}
        particle('#ff0', [
            ['alpha', 1, 0, 1],
            ['size', rnd(2, 4), rnd(5, 10), 1],
            ['x', this.x, this.x + rnd(-20, 20), 1],
            ['y', this.y, this.y + rnd(-20, 20), 1]
        ]);

        this.lastDamage = G.clock;

        if ((this.health -= amount) <= 0.05) {
            this.explode(projectile);
        }
    }

    explode() {
        this.health = 0;

        for (let i = 0 ; i < 100 ; i++) {
            const angle = random() * TWO_PI;
            const distance = rnd(5, 50);
            const d = rnd(0.2, 1.5);

            particle(pick(['#ff0', '#f80', '#f00']), [
                ['alpha', 1, 0, d],
                ['size', rnd(2, 4), rnd(5, 10), d],
                ['x', this.x, this.x + cos(angle) * distance, d],
                ['y', this.y, this.y + sin(angle) * distance, d]
            ]);
        }

        // Determine if this ship should drop cargo on destruction: enemy civilizations (or pirates as fallback)
        let shouldDropCargo = false;
        try {
            if (this.civilization && typeof this.civilization.relationshipType === 'function') {
                shouldDropCargo = (this.civilization.relationshipType() === RELATIONSHIP_ENEMY);
            }
        } catch (e) { shouldDropCargo = false; }

        // Fallback to pirate-specific list if relationship info not available
        try {
            if (!shouldDropCargo && U.pirates && U.pirates.indexOf(this) >= 0) shouldDropCargo = true;
        } catch (e) {}

        U.remove(U.ships, this);
        U.remove(U.pirates, this);

        if (V.isVisible(this)) {
            explosionSound();
        }

        // Drop raw resources
        U.dropResources(this.x, this.y, 10);

        // If this ship qualifies, perform drop checks: 1/3 chance to drop cargo, 1/3 chance to drop credits
        try {
            // Drop raw resources and possible cargo/credits only if the destroyed ship is near the player's ship.
            // This avoids cluttering the world with loot from distant fights the player cannot reach.
            try {
                const DROP_NEARBY_DISTANCE = 800; // distance threshold for loot to be dropped (in game units)
                const playerShip = (typeof U !== 'undefined') ? U.playerShip : null;
                const tooFar = playerShip ? (dist(this, playerShip) > DROP_NEARBY_DISTANCE) : false;

                if (!tooFar) {
                    // Drop raw resources
                    U.dropResources(this.x, this.y, 10);

                    // If this ship qualifies, perform drop checks: 1/3 chance to drop cargo, 1/3 chance to drop credits
                    if (shouldDropCargo) {
                        // chance to drop cargo based on configured constant
                        if (typeof 0.3333333 !== 'undefined' ? (Math.random() < 0.3333333) : (Math.random() < (1/3))) {
                            // Choose a cargo type (random) from CARGO_DATA if available, otherwise fallback name
                            let cargoName = 'Cryogenic Embryos';
                            let units = 1 + Math.floor(Math.random() * 20); // 1-20 units
                            try {
                                if (typeof CARGO_DATA !== 'undefined' && Array.isArray(CARGO_DATA) && CARGO_DATA.length) {
                                    try {
                                        // Compute weighted probabilities so low-value items are more likely.
                                        // Anchors: lowest-value -> 10x, Helix Seeds -> 5x, highest-value -> 1x.
                                        const vals = CARGO_DATA.map(d => (d && typeof d.value === 'number') ? d.value : 1);
                                        const minVal = Math.min.apply(null, vals);
                                        const maxVal = Math.max.apply(null, vals);

                                        // Try to find helix seeds value; fallback to median-like value
                                        const helixDef = CARGO_DATA.find(d => d && d.cargo && d.cargo.toLowerCase().includes('helix'));
                                        const helixVal = helixDef && typeof helixDef.value === 'number' ? helixDef.value : Math.max(minVal, Math.min(maxVal, (minVal + maxVal) / 4));

                                        const log = v => Math.log(Math.max(1e-6, v));

                                        // Linear interpolate on log-value between anchors
                                        const calcWeight = (v) => {
                                            try {
                                                if (v <= helixVal) {
                                                    const t = (log(v) - log(minVal)) / Math.max(1e-6, (log(helixVal) - log(minVal)));
                                                    return 10 - (10 - 5) * limit(0, t, 1); // 10 -> 5
                                                } else {
                                                    const t = (log(v) - log(helixVal)) / Math.max(1e-6, (log(maxVal) - log(helixVal)));
                                                    return 5 - (5 - 1) * limit(0, t, 1); // 5 -> 1
                                                }
                                            } catch (e) { return 1; }
                                        };

                                        const weights = CARGO_DATA.map(d => calcWeight((d && typeof d.value === 'number') ? d.value : 1));
                                        const total = weights.reduce((s, w) => s + (isFinite(w) ? w : 0), 0);
                                        let r = Math.random() * total;
                                        let chosen = 0;
                                        for (let i = 0; i < weights.length; i++) {
                                            r -= weights[i];
                                            if (r <= 0) { chosen = i; break; }
                                        }

                                        let def = CARGO_DATA[chosen];
                                        if (def && def.cargo) cargoName = def.cargo;
                                    } catch (e) {
                                        // fallback to uniform selection
                                        let idx = Math.floor(Math.random() * CARGO_DATA.length);
                                        let def = CARGO_DATA[idx];
                                        if (def && def.cargo) cargoName = def.cargo;
                                    }
                                }
                            } catch (e) {}

                            // Ensure the CargoItem class is available (it should be included in build)
                            if (typeof CargoItem !== 'undefined') {
                                console.log('Dropping CargoItem', cargoName, units, 'at', this.x, this.y);
                                U.items.push(new CargoItem(this.x, this.y, cargoName, units));
                            } else {
                                // Fallback: create a ResourceItem if CargoItem not present
                                console.log('CargoItem not defined, dropping ResourceItem as fallback');
                                U.items.push(new ResourceItem(this.x, this.y));
                            }
                        }

                        // Independently, chance to drop credits based on configured constant
                        if (typeof 0.3333333 !== 'undefined' ? (Math.random() < 0.3333333) : (Math.random() < (1/3))) {
                            try {
                                // Compute base credit amount
                                let baseMin = (typeof 10 !== 'undefined') ? 10 : 10;
                                let baseMax = (typeof 99 !== 'undefined') ? 99 : 99;
                                let randBase = baseMin + Math.floor(Math.random() * Math.max(1, (baseMax - baseMin + 1)));

                                // Scale by ship radius (proxy for size/level)
                                let scaleFactor = (typeof 0.1 !== 'undefined') ? 0.1 : 0.1;
                                let scaled = Math.round(randBase + (this.radius * scaleFactor));

                                let amount = Math.max(baseMin, scaled);

                                if (typeof CreditItem !== 'undefined') {
                                    U.items.push(new CreditItem(this.x, this.y, amount));
                                } else {
                                    U.items.push(new ResourceItem(this.x, this.y));
                                }
                            } catch (e) {
                                U.items.push(new ResourceItem(this.x, this.y));
                            }
                        }
                    }
                } else {
                    // Too far from player; skip dropping loot
                    try { console.debug && console.debug('explode: ship too far from player, skipping drops', dist(this, playerShip)); } catch (e) {}
                }
            } catch (e) {
                // ignore errors here to avoid crashing on explosion
                console.error('Error dropping cargo/credits items:', e);
            }
        } catch (e) {
            // ignore any unexpected errors during explosion handling
        }
    }

