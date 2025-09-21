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
        this.x += this.vX * e;
        this.y += this.vY * e;

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

        if ((G.clock - (this.lastShot || 0)) > 0.5) {
            this.heat -= e * 0.5;
        }

        if (this.heat <= 0) {
            this.coolingDown = false;
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
            if (shouldDropCargo) {
                // chance to drop cargo based on configured constant
                if (typeof DROP_CARGO_PROBABILITY !== 'undefined' ? (Math.random() < DROP_CARGO_PROBABILITY) : (Math.random() < (1/3))) {
                    // Choose a cargo type (random) from CARGO_DATA if available, otherwise fallback name
                    let cargoName = 'Cryogenic Embryos';
                    let units = 1 + Math.floor(Math.random() * 20); // 1-20 units
                    try {
                        if (typeof CARGO_DATA !== 'undefined' && Array.isArray(CARGO_DATA) && CARGO_DATA.length) {
                            const idx = Math.floor(Math.random() * CARGO_DATA.length);
                            const def = CARGO_DATA[idx];
                            if (def && def.cargo) cargoName = def.cargo;
                        }
                    } catch (e) {
                        // ignore and use fallback
                    }

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
                if (typeof DROP_CREDIT_PROBABILITY !== 'undefined' ? (Math.random() < DROP_CREDIT_PROBABILITY) : (Math.random() < (1/3))) {
                    try {
                        // Compute base credit amount
                        const baseMin = (typeof CREDIT_BASE_MIN !== 'undefined') ? CREDIT_BASE_MIN : 10;
                        const baseMax = (typeof CREDIT_BASE_MAX !== 'undefined') ? CREDIT_BASE_MAX : 99;
                        const randBase = baseMin + Math.floor(Math.random() * Math.max(1, (baseMax - baseMin + 1)));

                        // Scale by ship radius (proxy for size/level)
                        const scaleFactor = (typeof CREDIT_SCALE_PER_RADIUS !== 'undefined') ? CREDIT_SCALE_PER_RADIUS : 0.1;
                        const scaled = Math.round(randBase + (this.radius * scaleFactor));

                        const amount = Math.max(baseMin, scaled);

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
        } catch (e) {
            // ignore errors here to avoid crashing on explosion
            console.error('Error dropping cargo/credits items:', e);
        }
    }

}
