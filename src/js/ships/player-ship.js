class PlayerShip extends Ship {

    constructor(x, y) {
        super(new Civilization(), x, y);

        this.angle = -PI / 8;
        this.nextHealing = 0;
        this.shield = 1;
        this.age = 0;
    }

    cycle(e) {
        this.age += e;

        // // Hairy condition here: we only want to brake if the user is pressing the down arrow AND we're moving towards the same direction we're pointing to
        // // This is to avoid having a reverse mode
        // this.thrust = (w.down[40] && (this.vX || this.vY) && abs(normalize(atan2(this.vY, this.vX) - this.angle)) < PI / 2) ?
        //     -1 : (w.down[38] ? 1 : 0);
        this.thrust = w.down[38] ? 1 : (w.down[40] ? -0.25 : 0);

        this.rotationDirection = w.down[37] ? -1 : (w.down[39] ? 1 : 0);

        if (w.down[32]) this.shoot(SimpleLaser);
        if (w.down[13] && this.age > 1) this.shoot(SuperLaser, SHIP_SUPERSHOT_INTERVAL);

        const nearStar = this.nearStar();
        if (nearStar) {
            this.damage(nearStar, e * 0.15);
        }

        if ((G.clock - this.lastShieldDamage) > SHIELD_RECOVERY_DELAY) {
            this.shield += SHIELD_RECOVERY_SPEED * e;
        }
        this.shield = min(this.health, this.shield); // make sure shields don't surpass health

        if ((this.nextHealing -= e) < 0) {
            this.heal();
        }

        super.cycle(e);

        if (this.thrust) {
            if (!this.thrustSound) {
                this.thrustSound = thrustSound();
                this.thrustSound.loop = true;
            }
        } else if (this.thrustSound) {
            this.thrustSound.pause();
            this.thrustSound = 0;
        }
    }

    heal() {
        const healingAmount = min(1 - this.health, SHIP_HEALING_AMOUNT);
        const requiredResources = ~~(SHIP_HEALING_REQUIRED_RESOURCES * healingAmount / SHIP_HEALING_AMOUNT);
        if (this.civilization.resources >= requiredResources && healingAmount > 0) {
            G.healAnimation(() => {
                this.health += healingAmount;
                this.civilization.resources -= requiredResources;
            });
        }

        this.nextHealing = SHIP_HEALING_INTERVAL;
    }

    damage(source, amount) {
        const isStar = source instanceof Star;

        if (this.shield > 0) {
            try {
                // Scale incoming damage by the ship's shield base so upgrades increase effective HP.
                const shieldBase = (this.baseStats && this.baseStats.maxShieldPoints) ? this.baseStats.maxShieldPoints : 100;
                const shieldScale = Math.max(1, shieldBase / 100);
                this.shield -= (amount / shieldScale);
            } catch (e) {
                this.shield -= amount;
            }

            if (!isStar || (G.clock - (this.lastShieldDamage || 0)) > 0.3) {
                this.lastShieldDamage = G.clock;

                this.shieldEffectAngle = angleBetween(this, source);
                interp(this, 'shieldEffectScale', 0.8, 1, 0.2);
            }
            return;
        }

        if (!isStar) {
            V.shake(0.1);
        }

        try {
            const hullBase = (this.baseStats && this.baseStats.maxHullPoints) ? this.baseStats.maxHullPoints : 100;
            const hullScale = Math.max(1, hullBase / 100);
            super.damage(source, (amount * 0.5) / hullScale); // Less damage for the player, scaled by hull base
        } catch (e) {
            super.damage(source, amount * 0.5);
        }

        this.nextHealing = SHIP_HEALING_DAMAGE_TIMEOUT;
    }

    modifyProjectile(projectile) {
        projectile.guideRadius = 100;
        try {
            // Compute cumulative increase matching Mod Bay rules
            function incrementPercentForLevel(level) {
                const next = level + 1;
                if (next === 2) return 0.75;
                if (next === 3) return 0.5;
                if (next === 4) return 0.25;
                return 0.2;
            }
            function cumulativeIncrease(level) {
                let sum = 0;
                for (let l = 1; l < level; l++) sum += incrementPercentForLevel(l);
                return sum;
            }

            // Apply torpedo (SuperLaser) damage multiplier
            const ctorName = (projectile && projectile.constructor && projectile.constructor.name) || '';
            if (ctorName === 'SuperLaser') {
                const lvl = (this.upgrades && this.upgrades.torpedos) || 1;
                const inc = cumulativeIncrease(lvl);
                const before = projectile.damage;
                const after = +(before * (1 + inc)).toFixed(6);
                projectile.damage = after;
                try { console.debug('mod-bay: applied torpedos upgrade to SuperLaser damage', 'level', lvl, before, '->', after); } catch (e) {}
            }

            // Apply phaser (SimpleLaser) damage multiplier
            if (ctorName === 'SimpleLaser') {
                const lvl = (this.upgrades && this.upgrades.phasers) || 1;
                const inc = cumulativeIncrease(lvl);
                const before = projectile.damage;
                const after = +(before * (1 + inc)).toFixed(6);
                projectile.damage = after;
                try { console.debug('mod-bay: applied phasers upgrade to SimpleLaser damage', 'level', lvl, before, '->', after); } catch (e) {}
            }
        } catch (e) { console.error('modifyProjectile upgrade application error', e); }
    }

    shipColor() {
        return '#fff';
    }

    explode(projectile) {
        super.explode(projectile);
        // Decrement player lives and check for game over. If lives are exhausted, trigger game over instead of respawn.
        try {
            if (typeof G !== 'undefined') {
                if (typeof G.lives !== 'number') G.lives = 3;
                G.lives = Math.max(0, G.lives - 1);
                try { console.debug && console.debug('Player exploded - lives remaining', G.lives); } catch (e) {}
                if (G.lives <= 0) {
                    try { if (typeof G.gameOver === 'function') G.gameOver(); } catch (e) {}
                    // Do not continue with respawn flow
                    if (this.thrustSound) { this.thrustSound.pause(); }
                    return;
                }
            }
        } catch (e) { /* ignore lives handling errors */ }
        // Respawn flow: preserve upgrades/baseStats but reset credits and cargo.
        setTimeout(() => {
            try {
                // Persist upgrades/baseStats to storage so restoreState can pick them up
                if (typeof U !== 'undefined' && typeof U.saveState === 'function') {
                    try { U.saveState(); } catch (e) {}
                }

                // Create a fresh player ship (this will reset credits and cargo by design)
                if (typeof U !== 'undefined' && typeof U.createPlayerShip === 'function') {
                    try { U.createPlayerShip(); } catch (e) {}
                }

                // Reapply persisted upgrades/baseStats to the new ship
                if (typeof U !== 'undefined' && typeof U.restoreState === 'function') {
                    try { U.restoreState(); } catch (e) {}
                }

                try { G.showMessage && G.showMessage(nomangle('You have respawned. Upgrades preserved.')); } catch (e) {}
            } catch (e) {}
        }, 2000);

        if (this.thrustSound) {
            this.thrustSound.pause();
        }
    }

    currentWarning() {
        if (this.health <= 0.3) {
            return nomangle('CRITICAL HULL DAMAGE') + (this.civilization.resources < SHIP_HEALING_REQUIRED_RESOURCES ? nomangle('. FIND RESOURCES TO REPAIR') : '');
        }

        if (this.nearStar()) {
            return nomangle('CRITICAL HEAT');
        }

        if (U.pirates.filter(ship => dist(ship, this) < CANVAS_WIDTH).length) {
            return nomangle('PIRATES NEARBY');
        }

        if (this.shield <= 0) {
            return nomangle('SHIELDS OFFLINE');
        }
    }

    nearStar() {
        return U.stars.filter(star => dist(this, star) < star.radius * 2)[0];
    }

    render() {
        wrap(() => super.render());

        translate(this.x, this.y);
        rotate(this.shieldEffectAngle);

        fs('#fff');

        beginPath();
        arc(0, 0, 25, -PI / 2, PI / 2);

        wrap(() => {
            scale(this.shieldEffectScale, 1);
            arc(0, 0, 25, PI / 2, -PI / 2, true);
        });

        fill();
    }

}
