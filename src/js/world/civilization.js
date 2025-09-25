class Civilization {

    constructor(center, relationship) {
        this.resources = 0;
        this.center = center;
        this.relationship = relationship;
        // If colonized, this civilization is permanently allied to the player
        this.colonized = false;
        // Numeric reputation score for trade UI and mission effects
        // Allies start at +100, enemies start at -100
        try {
            this.reputation = (this.relationship < 0.5) ? -100 : 100;
        } catch (e) { this.reputation = 0; }
        this.initialRelationship = this.relationshipType();
    }

    relationshipType() {
        // Colonized civilizations are always allies
        if (this.colonized) return RELATIONSHIP_ALLY;
        // If temporarily marked as enemy due to recent player aggression, check expiry
        try {
            if (this.temporaryEnemyUntil) {
                if (typeof G !== 'undefined' && G.clock <= this.temporaryEnemyUntil) {
                    // Still hostile
                    return RELATIONSHIP_ENEMY;
                }
                // Timer expired — restore prior relationship if we saved one, clear saved state and notify once
                try {
                    if (typeof this._previousRelationshipOnTempHostility !== 'undefined') {
                        this.relationship = this._previousRelationshipOnTempHostility;
                        try { delete this._previousRelationshipOnTempHostility; } catch (e) { this._previousRelationshipOnTempHostility = undefined; }
                    }
                } catch (e) { /* ignore */ }
                this.temporaryEnemyUntil = null;
                try {
                    // Trigger a short revert animation on bodies that use this civilization
                    this._revertAnimationUntil = G.clock + 0.6; // 0.6s animation
                } catch (e) { /* ignore */ }
                try { G.showMessage(this.center.name + nomangle(' is no longer hostile')); } catch (e) { /* ignore */ }
            }
        } catch (e) { /* ignore */ }
        return this.relationship < 0.5 ? RELATIONSHIP_ENEMY : RELATIONSHIP_ALLY;
    }

    relationshipLabel() {
        return this.relationshipType() === RELATIONSHIP_ENEMY ? nomangle('enemy') : nomangle('ally');
    }

    updateRelationship(difference) {
        // If colonized, ignore negative changes and remain allied forever
        if (this.colonized && difference < 0) {
            return;
        }
        const relationshipTypeBefore = this.relationshipType();
        this.relationship = limit(0, this.relationship + difference, 1);

        if (this.relationshipType() !== relationshipTypeBefore) {
            G.showMessage(this.center.name + nomangle(' is now your ') + this.relationshipLabel());
        }
    }

    // Apply reputation numeric score to the normalized relationship value.
    // If reputation is non-negative, consider the civilization an ally; otherwise enemy.
    applyReputationToRelationship() {
        try {
            const before = this.relationshipType();
            // Map reputation to a relationship float around the ally/enemy threshold.
            if (typeof this.reputation === 'number' && this.reputation >= 0) {
                this.relationship = 0.75; // strong ally
            } else {
                this.relationship = 0.25; // enemy
            }
            if (this.relationshipType() !== before) {
                G.showMessage(this.center.name + nomangle(' is now your ') + this.relationshipLabel());
            }
        } catch (e) { /* ignore */ }
    }

}
