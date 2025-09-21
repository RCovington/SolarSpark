Planetary Trade — quick reference

Overview
- Planetary Trade panels open when docked at a friendly planet.
- Each planet persists a `planet.market` array containing 3 offered cargo types (name, units, price).
- Per-planet prices are stored in `planet.prices[cargoName]` and are computed from the base `CARGO_DATA` value ±20% on first encounter.

Buying
- Use the inline Buy button next to an offered item.
- When buying, an inline quantity selector appears with - / + / Max / Confirm / Cancel controls.
- Quantity is bounded by: market stock, your credits, and ship cargo capacity (each cargo has `storage_units` from `data/cargo.json`).
- On Confirm, credits are deducted and `ship.cargo[cargoName]` is increased; market units are decreased.

Selling
- The Inventory section lists cargo the ship carries (zero-unit entries are filtered out).
- Press Sell to sell the entire stack of that cargo at the planet's price. Selling removes the cargo entry from `ship.cargo` and credits the ship.

Tooltips
- Hover over a price to see a tooltip comparing the planet price to the base value. The tooltip shows the base price, a percent variance, and the resulting price.

Implementation notes
- Panel UI is created by `createMenuPanel` in `src/js/ui/menu-panel.js`.
- Planet market sampling logic: `src/js/ui/planetary-trade-wrapper.js` -> `samplePlanetCargo`.
- Per-planet price calculation: `getPlanetPrice(planet, cargoName)` (persisted in `planet.prices`).

Manual tests (smoke)
1. Build and open `build/debug.html` in a browser.
2. Dock at a planet and open the Planetary Trade panel (press D when close enough).
3. Buy an item using the inline quantity selector; confirm credits and `ship.cargo` updated.
4. Sell an item from Inventory and verify credits increase and the item is removed.
5. Hover prices and verify the tooltip shows percent variance and colors correctly.

Files of interest
- `src/js/ui/menu-panel.js` — panel scaffolding and CSS
- `src/js/ui/planetary-trade-wrapper.js` — trading logic and UI
- `data/cargo.json` — cargo definitions

