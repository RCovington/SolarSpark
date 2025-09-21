class Civilization {

    constructor(center, relationship) {
        this.resources = 0;
        this.center = center;
        this.relationship = relationship;
        // Numeric reputation score for trade UI and mission effects
        // Allies start at +100, enemies start at -100
        try {
            this.reputation = (this.relationship < 0.5) ? -100 : 100;
        } catch (e) { this.reputation = 0; }
        this.initialRelationship = this.relationshipType();
    }

    relationshipType() {
        return this.relationship < 0.5 ? RELATIONSHIP_ENEMY : RELATIONSHIP_ALLY;
    }

    relationshipLabel() {
        return this.relationshipType() === RELATIONSHIP_ENEMY ? nomangle('enemy') : nomangle('ally');
    }

    updateRelationship(difference) {
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
