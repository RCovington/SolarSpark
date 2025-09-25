class PlanetaryStation {

    constructor(planet, angleOnPlanet) {
        this.planet = planet;
        this.angleOnPlanet = angleOnPlanet;
        this.radius = 15;

        this.scale = 1;
        this.lastDamage = 0;

        this.health = 1;
    }

    get globalAngle() {
        return this.angleOnPlanet + this.planet.angle;
    }

    cycle() {
        this.x = this.planet.x + (this.planet.radius - 2) * cos(this.globalAngle);
        this.y = this.planet.y + (this.planet.radius - 2) * sin(this.globalAngle);
    }

    render() {
        const damageFactor = 1 - limit(0, G.clock - this.lastDamage, 0.1) / 0.1;

        // Base scale including damage pulse
        let baseScale = 1 + damageFactor * 0.2;
        let overrideColor = null;
        try {
            const revertUntil = this.planet.civilization._revertAnimationUntil;
            if (revertUntil && G.clock <= revertUntil) {
                const dur = 0.6;
                const progress = 1 - Math.max(0, (revertUntil - G.clock) / dur);
                const bounce = 0.12 * Math.sin(progress * Math.PI);
                baseScale *= (1 + bounce);
                overrideColor = '#0f0';
            }
        } catch (e) { /* ignore */ }

        scale(baseScale, baseScale);

        fs(damageFactor > 0 ? '#fff' : (overrideColor || this.planet.civilization.relationshipType()));
        this.renderGraphic();
    }

    // // For reference only
    // renderGraphic() {

    // }

    damage(source, amount) {
        if (source.owner == U.playerShip) { // only get damage from the player (prevents mortars from destroying friendly stations)
            particle('#ff0', [
                ['alpha', 1, 0, 1],
                ['size', rnd(2, 4), rnd(5, 10), 1],
                ['x', this.x, this.x + rnd(-20, 20), 1],
                ['y', this.y, this.y + rnd(-20, 20), 1]
            ]);

            this.lastDamage = G.clock;

            this.planet.civilization.updateRelationship(RELATIONSHIP_UPDATE_DAMAGE_STATION);
            try {
                if (typeof this.planet.civilization._previousRelationshipOnTempHostility === 'undefined') {
                    this.planet.civilization._previousRelationshipOnTempHostility = this.planet.civilization.relationship;
                }
            } catch (e) { /* ignore */ }
            try {
                const secs = (typeof TEMPORARY_ENEMY_SECONDS === 'number') ? TEMPORARY_ENEMY_SECONDS : 120;
                const already = this.planet.civilization.temporaryEnemyUntil && this.planet.civilization.temporaryEnemyUntil > G.clock;
                if (!already) {
                    this.planet.civilization.temporaryEnemyUntil = G.clock + secs;
                    const disp = (typeof this.planet.civilization.getDisplayName === 'function') ? this.planet.civilization.getDisplayName() : (this.planet.civilization.center && this.planet.civilization.center.name) || 'Unknown';
                    G.showMessage(disp + nomangle(' will be hostile for ') + String(secs) + 's');
                }
            } catch (e) { /* ignore */ }

            if ((this.health -= amount) <= 0) {
                this.explode(source);
            }
        }
    }

    explode(source) {
        for (let i = 0 ; i < 50 ; i++) {
            const angle = this.globalAngle + rnd(-PI / 2, PI / 2);
            const distance = rnd(30, 50);

            particle(pick(['#ff0', '#f80', '#f00']), [
                ['alpha', 1, 0, 1],
                ['size', rnd(2, 4), rnd(5, 10), 1],
                ['x', this.x, this.x + cos(angle) * distance, 1],
                ['y', this.y, this.y + sin(angle) * distance, 1]
            ]);
        }

        U.remove(this.planet.stations, this);

        if (source == U.playerShip) {
            this.planet.civilization.updateRelationship(RELATIONSHIP_UPDATE_DESTROY_STATION);
            try {
                if (typeof this.planet.civilization._previousRelationshipOnTempHostility === 'undefined') {
                    this.planet.civilization._previousRelationshipOnTempHostility = this.planet.civilization.relationship;
                }
            } catch (e) { /* ignore */ }
            try { if (window.Score) Score.add(2, 'defense'); } catch (e) {}
            try {
                const secs = (typeof TEMPORARY_ENEMY_SECONDS === 'number') ? TEMPORARY_ENEMY_SECONDS : 120;
                const already = this.planet.civilization.temporaryEnemyUntil && this.planet.civilization.temporaryEnemyUntil > G.clock;
                if (!already) {
                    this.planet.civilization.temporaryEnemyUntil = G.clock + secs;
                    const disp = (typeof this.planet.civilization.getDisplayName === 'function') ? this.planet.civilization.getDisplayName() : (this.planet.civilization.center && this.planet.civilization.center.name) || 'Unknown';
                    G.showMessage(disp + nomangle(' will be hostile for ') + String(secs) + 's');
                }
            } catch (e) { /* ignore */ }
        }

        G.eventHub.emit(EVENT_STATION_DESTROYED, this);

        U.dropResources(this.x, this.y, 10);
    }

}
