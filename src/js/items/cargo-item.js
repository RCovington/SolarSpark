class CargoItem extends Item {

    constructor(x, y, cargoName = 'Cryogenic Embryos', units = 1) {
        super(x, y);
        this.cargoName = cargoName;
        this.units = units || 1;
        // Make cargo easier to spot and persist until collected (don't auto-expire)
        this.timeLeft = Infinity;

        // Emit a gold flash particle so player notices the drop
        try {
            particle('#ffd700', [
                ['alpha', 1, 0, 0.2],
                ['size', 10, 40, 0.2],
                ['x', this.x, this.x, 0],
                ['y', this.y, this.y, 0]
            ]);
        } catch (e) {
            // ignore if particle not available
        }
    }

    renderGraphic() {
        // Golden box: draw a larger gold cube/box with glow
        scale(0.7, 0.7);

        // Glow
        try { R.shadowColor = 'rgba(255,215,0,0.8)'; R.shadowBlur = 20; } catch (e) {}

        // box base
        fs('#d4af37'); // gold
        beginPath();
        moveTo(-18, -12);
        lineTo(18, -12);
        lineTo(18, 12);
        lineTo(-18, 12);
        closePath();
        fill();

        // highlight
        fs('#ffe680');
        beginPath();
        moveTo(-18, -12);
        lineTo(18, -12);
        lineTo(12, -7);
        lineTo(-12, -7);
        closePath();
        fill();

        // stripe
        fs('#b8860b');
        beginPath();
        moveTo(-6, -12);
        lineTo(6, -12);
        lineTo(6, 12);
        lineTo(-6, 12);
        closePath();
        fill();

        try { R.shadowBlur = 0; } catch (e) {}
    }

    pickUp(ship) {
        // Award flat credit bonus
        ship.credits = (ship.credits || 0) + 100;

        // Ensure ship cargo map exists
        ship.cargo = ship.cargo || {};

        // Determine per-unit storage for this cargo
        let perUnit = 1;
        try {
            if (typeof CARGO_DATA !== 'undefined' && Array.isArray(CARGO_DATA)) {
                const def = CARGO_DATA.find(d => d.cargo === this.cargoName || String(d.id) === String(this.cargoName));
                if (def && def.storage_units) perUnit = def.storage_units;
            }
        } catch (e) {}

        // Compute remaining capacity in units (not cargo types)
        const CAP = 200;
        let used = 0;
        try { Object.keys(ship.cargo).forEach(k => { const d = (typeof CARGO_DATA !== 'undefined' && Array.isArray(CARGO_DATA)) ? CARGO_DATA.find(dd => dd.cargo === k) : null; const pu = d && d.storage_units ? d.storage_units : 1; used += (ship.cargo[k] || 0) * pu; }); } catch (e) {}
        const remainingUnits = Math.max(0, CAP - used);

        // How many of this cargo can we accept?
        const maxAccept = Math.floor(remainingUnits / perUnit);
        const toAccept = Math.max(0, Math.min(this.units || 0, maxAccept));

        if (toAccept > 0) {
            ship.cargo[this.cargoName] = (ship.cargo[this.cargoName] || 0) + toAccept;
        }

        let msg = `Picked up ${this.cargoName} (+100 credits)`;
        if (toAccept > 0 && toAccept < this.units) {
            msg += ` — stored ${toAccept}/${this.units} units (ship full)`;
        } else if (toAccept === 0) {
            msg += ' — no cargo space available';
        }

        G.showMessage(nomangle(msg));
        pickupSound();
    }

}
