class Universe {

    constructor() {
        this.ships = [];
        this.bodies = [];
        this.stars = [];
        this.particles = [];
        this.projectiles = [];
        this.items = [];
        this.pirates = [];

        this.center = {'x': 0, 'y': 0};

        this.backgroundStarGradient = createRadialGradient(0, 0, 0, 0, 0, 1);
        this.backgroundStarGradient.addColorStop(0, 'rgba(255,255,200,1)');
        this.backgroundStarGradient.addColorStop(0.3, 'rgba(255,255,200,0.1)');
        this.backgroundStarGradient.addColorStop(1, 'rgba(255,255,200,0)');

        this.createPlayerShip();

        // setTimeout(() => this.generateUniverse(), 0);
        this.nextAsteroid = 0;
        this.offerRefreshTimer = 0;
    }

    createPlayerShip() {
        this.remove(this.ships, this.playerShip);
        this.ships.push(this.playerShip = new PlayerShip(this.center.x, this.center.y));
        // New ship should start with zero credits and empty cargo by default. If restoreState
        // later populates upgrades/baseStats they'll be applied, but credits/cargo are reset
        // on creation (so they are lost on destruction/respawn as requested).
        try { this.playerShip.credits = 0; } catch (e) {}
        try { this.playerShip.cargo = {}; } catch (e) {}
    // Ensure a sensible default cargo capacity so upgrades apply relative to a real base
    try { if (typeof this.playerShip.cargoCapacity !== 'number' || this.playerShip.cargoCapacity <= 0) this.playerShip.cargoCapacity = 200; } catch (e) {}

        // Wrap credits and cargoCapacity with property accessors so UI can listen for changes
        try {
            const ship = this.playerShip;
            // Credits
            try {
                ship._credits = ship._credits || (ship.credits || 0);
                Object.defineProperty(ship, 'credits', {
                    configurable: true,
                    enumerable: true,
                    get: function() { return this._credits; },
                    set: function(v) {
                        const old = this._credits;
                        this._credits = v;
                        try {
                            if (typeof G !== 'undefined' && G && G.eventHub && old !== v) {
                                G.eventHub.emit('player:creditsChanged', v);
                            }
                        } catch (e) {}
                    }
                });
            } catch (e) {}

            // cargoCapacity
            try {
                ship._cargoCapacity = ship._cargoCapacity || (ship.cargoCapacity || 0);
                Object.defineProperty(ship, 'cargoCapacity', {
                    configurable: true,
                    enumerable: true,
                    get: function() { return this._cargoCapacity; },
                    set: function(v) {
                        const old = this._cargoCapacity;
                        this._cargoCapacity = v;
                        try {
                            if (typeof G !== 'undefined' && G && G.eventHub && old !== v) {
                                G.eventHub.emit('player:cargoCapacityChanged', v);
                            }
                        } catch (e) {}
                    }
                });
            } catch (e) {}
        } catch (e) {}
    }

    cycle(e) {
        if ((this.nextAsteroid -= e) <= 0) {
            this.nextAsteroid = 3;
            this.randomAsteroid();
        }


        // Remove expired offers first
        try {
            const planetsForExpiry = this.bodies.filter(b => b instanceof Planet && b.hasOffer && b.offerExpires);
            planetsForExpiry.forEach(p => {
                if (typeof G !== 'undefined' && G.clock >= p.offerExpires) {
                    p.hasOffer = false;
                    p.offerExpires = null;
                }
            });
        } catch (e) { /* ignore */ }

        // Periodically generate new offers (~every 10 minutes)
        if ((this.offerRefreshTimer -= e) <= 0) {
            this.offerRefreshTimer = 600; // 600s = 10 minutes
            this.refreshOffers();
        }

        this.forEach([this.bodies, this.ships, this.items, this.projectiles, [V]], element => element.cycle(e));
    }

    refreshOffers() {
        try {
            const planets = this.bodies.filter(b => b instanceof Planet);
            if (!planets.length) return;

            // Number of offers to generate on this refresh (approx 1/3 of planets)
            const count = Math.max(1, Math.floor(planets.length / 3));

            // Only assign offers to planets that don't already have one
            const available = planets.filter(p => !p.hasOffer);
            if (!available.length) return;

            // Shuffle available planets
            const idx = available.map((_, i) => i);
            for (let i = idx.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                const t = idx[i]; idx[i] = idx[j]; idx[j] = t;
            }

            const now = (typeof G !== 'undefined' && G.clock) ? G.clock : 0;
            for (let k = 0; k < Math.min(count, idx.length); k++) {
                const p = available[idx[k]];
                p.hasOffer = true;
                // Offer persists for 10 minutes (600s)
                p.offerExpires = now + 600;
            }
        } catch (e) { /* ignore */ }
    }

    randomAsteroid() {
        const asteroid = new Asteroid();
        asteroid.x = U.playerShip.x + pick([-1.1, 1.1]) * V.visibleWidth / 2;
        asteroid.y = U.playerShip.y + pick([-1.1, 1.1]) * V.visibleHeight / 2;
        U.bodies.push(asteroid);
    }

    forEach(arrays, func) {
        arrays.forEach(x => x.forEach(y => func(y)));
    }

    render() {
        fs('#000');
        fr(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

        const rng = createNumberGenerator(1);

        wrap(() => {
            translate(CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2);
            scale(V.zoomScale, V.zoomScale);

            fs(this.backgroundStarGradient);

            for (let i = 0 ; i < 400 ; i++) {
                wrap(() => {
                    const distanceFactor = rng.between(0.1, 0.3);
                    translate(
                        moduloWithNegative(rng.between(-1, 1) * CANVAS_WIDTH - U.playerShip.x * distanceFactor, CANVAS_WIDTH),
                        moduloWithNegative(rng.between(-1, 1) * CANVAS_HEIGHT - U.playerShip.y * distanceFactor, CANVAS_HEIGHT)
                    );

                    scale(distanceFactor * 20, distanceFactor * 20);

                    beginPath();
                    arc(
                        0,
                        0,
                        1,
                        0,
                        TWO_PI
                    );
                    fill();
                });
            }
        });

        wrap(() => {
            scale(V.zoomScale, V.zoomScale);
            translate(-V.x, -V.y);

            this.forEach([this.projectiles, this.particles, this.ships, this.bodies, this.items], element => wrap(() => {
                element.render();
            }));
        });
    }

    remove(array, item) {
        const index = array.indexOf(item);
        if (index >= 0) {
            array.splice(index, 1);
        }
    }

    forEachTarget(fn) {
        this.forEach([this.ships, this.bodies], fn);
        this.bodies.forEach(p => (p.stations || []).forEach(fn));
    }

    generateUniverse() {
        this.center = {
            'x': U.playerShip.x,
            'y': U.playerShip.y
        };

        const maxSystemRadius = UNIVERSE_GENERATE_SYSTEM_MAX_PLANETS * UNIVERSE_GENERATE_ORBIT_MAX_MARGIN + UNIVERSE_GENERATE_SYSTEM_MIN_MARGIN;

        const rng = createNumberGenerator(1);

        for (let i = 0 ; i < 3 ; i++) {
            const radius = i * maxSystemRadius;
            const phase = rng.between(0, TWO_PI);

            const maxSystems = ~~(TWO_PI * radius / maxSystemRadius); // using the circumference leads to slightly incorrect margins, but whatever

            for (let i = 0 ; i < maxSystems ; i++) {
                const angle = (i / maxSystems) * TWO_PI;

                // Generate a system there
                const star = new Star(rng);
                star.x = cos(angle + phase) * radius + U.playerShip.x;
                star.y = sin(angle + phase) * radius + U.playerShip.y;
                this.bodies.push(star);
                this.stars.push(star);

                const planets = rng.between(UNIVERSE_GENERATE_SYSTEM_MIN_PLANETS, UNIVERSE_GENERATE_SYSTEM_MAX_PLANETS);
                let orbitRadius = rng.between(UNIVERSE_GENERATE_ORBIT_MIN_MARGIN, UNIVERSE_GENERATE_ORBIT_MAX_MARGIN);
                for (let j = 0 ; j < planets ; j++) {
                    const planet = new Planet(star, orbitRadius, rng.floating() * 999);
                    this.bodies.push(planet);

                    star.reachRadius = orbitRadius + planet.radius;

                    orbitRadius += rng.between(UNIVERSE_GENERATE_ORBIT_MIN_MARGIN, UNIVERSE_GENERATE_ORBIT_MAX_MARGIN);
                }

                // Create some pirates
                const pirateAngle = rng.between(0, TWO_PI);
                this.createPirateGroup(
                    cos(pirateAngle) * (radius + maxSystemRadius / 2),
                    sin(pirateAngle) * (radius + maxSystemRadius / 2)
                );
            }
        }

        // After generating bodies, immediately seed offers so players see messages right away
        try {
            this.refreshOffers();
            // set the refresh timer so we don't immediately regenerate on the next cycle
            this.offerRefreshTimer = 600;
        } catch (e) { /* ignore */ }

        // Attempt to restore persisted world state (reputation, markets) if available
        try {
            if (typeof this.restoreState === 'function') this.restoreState();
        } catch (e) { /* ignore */ }
    }

    saveState() {
        try {
            const key = 'ss_save_v1';
            const payload = this.bodies.filter(b => b instanceof Planet).map(p => ({
                name: p.name,
                reputation: p.civilization && typeof p.civilization.reputation === 'number' ? p.civilization.reputation : undefined,
                market: p.market || null,
                prices: p.prices || null
            }));
            // Persist player ship upgrades and base stats
            try {
                const shipData = {};
                if (this.playerShip) {
                    shipData.upgrades = this.playerShip.upgrades || null;
                    shipData.baseStats = this.playerShip.baseStats || null;
                    shipData.credits = this.playerShip.credits || 0;
                }
                payload.push({__playerShip: shipData});
            } catch (e) { /* ignore */ }
            try { localStorage.setItem(key, JSON.stringify(payload)); } catch (e) { /* ignore */ }
        } catch (e) { /* ignore */ }
    }

    restoreState() {
        try {
            const key = 'ss_save_v1';
            let raw = null;
            try { raw = localStorage.getItem(key); } catch (e) { raw = null; }
            if (!raw) return;
            const payload = JSON.parse(raw);
            if (!Array.isArray(payload)) return;
            // match by planet name and restore simple fields
            payload.forEach(entry => {
                try {
                    const p = this.bodies.find(b => b instanceof Planet && b.name === entry.name);
                    if (!p) return;
                    if (entry.reputation !== undefined && p.civilization) {
                        p.civilization.reputation = entry.reputation;
                        if (typeof p.civilization.applyReputationToRelationship === 'function') p.civilization.applyReputationToRelationship();
                    }
                    if (entry.market) p.market = entry.market;
                    if (entry.prices) p.prices = entry.prices;
                } catch (e) { /* ignore per-entry */ }
            });
            // Try to find player ship data appended at the end
            try {
                const shipEntry = payload.find(e => e && e.__playerShip);
                if (shipEntry && this.playerShip) {
                    const sd = shipEntry.__playerShip;
                        // Only restore upgrades and baseStats for respawn persistence. Do NOT restore
                        // credits or cargo: those should be lost when a ship is destroyed.
                        if (sd.upgrades) this.playerShip.upgrades = sd.upgrades;
                        if (sd.baseStats) this.playerShip.baseStats = sd.baseStats;
                    // Reapply upgrades to ensure ship stats updated
                    if (typeof this.playerShip.upgrades !== 'undefined' && typeof this.playerShip.baseStats !== 'undefined') {
                        try {
                            if (typeof window !== 'undefined' && typeof window.applyShipUpgrades === 'function') {
                                try { window.applyShipUpgrades(this.playerShip); } catch (e) {}
                            }
                        } catch (e) {}
                    }
                }
            } catch (e) { /* ignore */ }
        } catch (e) { /* ignore */ }
    }

    // debugView() {
    //     const can = document.createElement('canvas');
    //     can.width = 500;
    //     can.height = 500;
    //
    //     const ctx = can.getContext('2d');
    //
    //     const furthestStar = this.stars.reduce((furthestStar, star) => {
    //         return max(furthestStar, dist(star, this.center));
    //     }, 0);
    //
    //     ctx.fs('#000');
    //     ctx.fr(0, 0, can.width, can.height);
    //
    //     this.bodies.concat(this.ships).forEach(body => {
    //         if (body instanceof Star) {
    //             ctx.fs('#ff0');
    //         }
    //
    //         if (body instanceof Planet) {
    //             ctx.fs('#00f');
    //         }
    //
    //         if (body instanceof Ship) {
    //             ctx.fs('#f00');
    //         }
    //
    //         const distance = dist(body, this.center);
    //         const angle = angleBetween(this.center, body);
    //         const relativeDistance = distance / furthestStar;
    //
    //         ctx.fr(
    //             can.width / 2 + cos(angle) * relativeDistance * can.width / 2,
    //             can.height / 2 + sin(angle) * relativeDistance * can.height / 2,
    //             5,
    //             5
    //         );
    //     });
    //
    //     document.body.appendChild(can);
    // }

    createPirateGroup(x, y) {
        const ships = [...Array(~~rnd(4, 6))].map(() => new AIShip(
            new Civilization({'x': x, 'y': y, 'radius': 300}, 0),
            x + rnd(-300, 300),
            y + rnd(-300, 300)
        ));

        this.ships = this.ships.concat(ships);
        this.pirates = this.pirates.concat(ships);

        return ships;
    }

    dropResources(x, y, n) {
        // Drop resources
        [...Array(~~n)].forEach(() => U.items.push(new ResourceItem(x, y)));
    }

    // randomAsteroidField(x, y) {
    //     for (let i = 0 ; i < 10 ; i++) {
    //         // const angle = random() * TWO_PI;
    //         // const dist = random() *
    //         const asteroid = new Asteroid(0, rnd(-10, 10));
    //         asteroid.preventAutomaticRemoval = true;
    //         asteroid.x = x + rnd(-200, 200);
    //         asteroid.y = y + rnd(-200, 200);
    //         U.bodies.push(asteroid);
    //     }
    // }

}
