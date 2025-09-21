class CreditItem extends Item {

    constructor(x, y, amount = null) {
        super(x, y);
        // randomize if not provided; can be passed a computed amount based on ship size
        this.amount = amount !== null ? amount : (typeof CREDIT_BASE_MIN !== 'undefined' ? CREDIT_BASE_MIN : 10) + Math.floor(Math.random() * (typeof CREDIT_BASE_MAX !== 'undefined' ? (CREDIT_BASE_MAX - (typeof CREDIT_BASE_MIN !== 'undefined' ? CREDIT_BASE_MIN : 10)) : 90)); // fallback 10-99
        this.timeLeft = Infinity;

        // subtle coin flash
        try {
            particle('#ffd700', [
                ['alpha', 1, 0, 0.2],
                ['size', 6, 30, 0.2],
                ['x', this.x, this.x, 0],
                ['y', this.y, this.y, 0]
            ]);
        } catch (e) {}
    }

    renderGraphic() {
        // coin: simple gold circle with shine
        scale(0.6, 0.6);
        try { R.shadowColor = 'rgba(255,215,0,0.8)'; R.shadowBlur = 12; } catch (e) {}

        fs('#ffd700');
        beginPath();
        arc(0, 0, 12, 0, TWO_PI);
        fill();

        fs('#fff');
        beginPath();
        arc(-4, -4, 3, 0, TWO_PI);
        fill();

        try { R.shadowBlur = 0; } catch (e) {}
    }

    pickUp(ship) {
        ship.credits = (ship.credits || 0) + this.amount;

        const msg = `Picked up ${this.amount} credits`;
        try {
            if (typeof G !== 'undefined' && G.showPrompt) {
                G.showPrompt(nomangle(msg));
            } else {
                G.showMessage(nomangle(msg));
            }
        } catch (e) {
            try { G.showMessage(nomangle(msg)); } catch (e2) { /* ignore */ }
        }

        try { if (typeof creditPickupSound !== 'undefined') creditPickupSound(); else pickupSound(); } catch (e) { try { pickupSound(); } catch (e2) {} }
    }

}
