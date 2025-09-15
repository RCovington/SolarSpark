const fs = require('fs');
const path = require('path');

// Read the JS files list
const jsFiles = require('./config/js.json');
const constants = require('./config/constants.json');

// Read CSS
const css = fs.readFileSync('./src/style.css', 'utf8');

// Read HTML template
let html = fs.readFileSync('./src/index.html', 'utf8');

// Concatenate all JS files
let js = '';
jsFiles.forEach(file => {
    try {
        const content = fs.readFileSync(file, 'utf8');
        js += content + '\n';
    } catch (err) {
        console.log(`Warning: Could not read ${file}`);
    }
});

// Replace constants in JS
Object.keys(constants).forEach(key => {
    const value = constants[key];
    // Simple constant replacement
    js = js.replace(new RegExp(`\\b${key}\\b`, 'g'), value);
});

// Set DEBUG to true for development
js = js.replace(/\bDEBUG\b/g, 'true');

// Skip tutorial prompt but keep the peace prompt and universe generation
js = js.replace(/setTimeout\(\(\) => G\.proceedToMissionStep\(new PromptTutorialStep\(\)\), 3000\);/g,
    'setTimeout(() => G.proceedToMissionStep(new InstructionsStep()), 100);');

// Auto-start the game in debug mode
js = js.replace(/G\.startable = true;/g, 
    'G.startable = true;\n        if (true) { setTimeout(() => G.start(), 100); }');

// Handle nomangle macro - it should just return the string as-is for debug builds
// Handle string literals with single, double, or backtick quotes
js = js.replace(/nomangle\s*\(\s*['"`]([^'"`]*?)['"`]\s*\)/g, "'$1'");

// Handle regex patterns
js = js.replace(/nomangle\s*\(\s*\/([^\/]*?)\/([gimuy]*)\s*\)/g, '/$1/$2');

// Handle any remaining nomangle calls by defining it as a function
js = 'function nomangle(x) { return x; }\n' + js;

// Fix CANVAS_HEIGHT constant - use the non-mobile version for simplicity
js = js.replace(/CANVAS_HEIGHT = mobile \? 1400 : 1000/g, 'CANVAS_HEIGHT = 1000');

// Fix text spacing - increase horizontal spacing between characters
js = js.replace(/nextX = max\(nextX, characterX \+ segment\[0\] \+ 2 \/ 5, characterX \+ segment\[2\] \+ 2 \/ 5\);/g, 'nextX = max(nextX, characterX + segment[0] + 1.0, characterX + segment[2] + 1.0);');
js = js.replace(/nextX \+= 1;/g, 'nextX += 1.5;');

// Revert 'E' back to normal and fix the spacing calculation instead
// The issue is that the spacing calculation doesn't account for the actual width of letter 'E' properly
js = js.replace(/characterX = nextX;/g, 'characterX = nextX + 0.1;');

// Add lives system - modify Game constructor to include lives and reset on new game
js = js.replace(/G\.healthGaugeColor = '#fff';/g, "G.healthGaugeColor = '#fff';\n        G.lives = 3;");
js = js.replace(/G\.setupNewGame\(\);/g, "G.setupNewGame();\n        G.lives = 3;");

// Modify player ship explode method to handle lives system
js = js.replace(/setTimeout\(\(\) => G\.gameOver\(\), 2000\);/g, 'setTimeout(() => G.handlePlayerDeath(), 2000);');

// Add new method to handle player death and respawn
const livesSystemCode = `
    handlePlayerDeath() {
        G.lives--;
        
        if (G.lives <= 0) {
            G.gameOver();
        } else {
            // Store death location for respawn
            const deathX = U.playerShip.x;
            const deathY = U.playerShip.y;
            
            // Respawn after a delay
            setTimeout(() => {
                U.createPlayerShip();
                U.playerShip.x = deathX + rnd(-200, 200);
                U.playerShip.y = deathY + rnd(-200, 200);
                U.playerShip.health = 1;
                U.playerShip.shield = 1;
            }, 1000);
        }
    }

    renderLives() {
        // Render life icons in upper right corner
        for (let i = 0; i < G.lives; i++) {
            wrap(() => {
                translate(CANVAS_WIDTH - 60 - (i * 50), 60);
                scale(1.2, 1.2);
                
                // Draw ship icon for each life
                fs('#fff');
                R.lineWidth = 3;
                beginPath();
                moveTo(0, -12);
                lineTo(-10, 12);
                lineTo(0, 6);
                lineTo(10, 12);
                closePath();
                fill();
                stroke();
            });
        }
    }
`;

// Add the lives system code to the Game class
js = js.replace(/gameOver\(\) \{/g, livesSystemCode + '\n    gameOver() {');

// Add lives rendering to the main render cycle - find a better location to insert it
js = js.replace(/G\.renderGauge\(100, 45, U\.playerShip\.shield, G\.healthGaugeColor/g, 'G.renderLives();\n\n            G.renderGauge(100, 45, U.playerShip.shield, G.healthGaugeColor');

// Reduce mission frequency to 1/5th of original
js = js.replace(/G\.nextMission = 20;/g, 'G.nextMission = 100;');
js = js.replace(/G\.nextMission = G\.startedOnce \? 20 : 9;/g, 'G.nextMission = G.startedOnce ? 100 : 45;');

// Make planetary defenses peaceful by default
// Change station colors from red to green/yellow based on relationship
js = js.replace(/fs\(damageFactor > 0 \? '#fff' : this\.planet\.civilization\.relationshipType\(\)\);/g, 
    "fs(damageFactor > 0 ? '#fff' : (this.planet.civilization.relationshipType() === RELATIONSHIP_ENEMY ? '#f00' : (this.planet.civilization.relationshipType() === RELATIONSHIP_ALLY ? '#0f0' : '#ff0')));");

// Modify mortar attack logic to only attack enemies
js = js.replace(/this\.planet\.civilization\.relationshipType\(\) === RELATIONSHIP_ENEMY/g, 
    "(this.planet.civilization.relationshipType() === RELATIONSHIP_ENEMY || this.planet.civilization.wasAttackedByPlayer)");

// Add tracking for when player attacks a planet
js = js.replace(/this\.planet\.civilization\.updateRelationship\(RELATIONSHIP_UPDATE_DAMAGE_STATION\);/g,
    "this.planet.civilization.updateRelationship(RELATIONSHIP_UPDATE_DAMAGE_STATION);\n            this.planet.civilization.wasAttackedByPlayer = true;");

// Add orbital stations to universe generation - inject after the planet loop closes
js = js.replace(/(\s+)\/\/ Create some pirates/g,
    `$1// Add outer orbital stations - closer spacing like planet rings
$1const outerOrbitRadius = orbitRadius + rng.between(200, 300);
$1for (let k = 0; k < 3; k++) {
$1    const stationPhase = (k / 3) * 6.283185307179586 + rng.between(-0.2, 0.2);
$1    const orbitalStation = new OrbitalStation(star, outerOrbitRadius, stationPhase, k + 1);
$1    this.bodies.push(orbitalStation);
$1}

$1// Create some pirates`);

// Initialize player ship with cargo bay attribute, upgrades, and credits
js = js.replace(/this\.health = 1;/g,
    'this.health = 1;\n        this.cargoBay = 200; // Initial cargo bay capacity\n        this.upgrades = (typeof U !== "undefined" && U.playerUpgrades) ? U.playerUpgrades : {};\n        this.credits = (typeof U !== "undefined" && U.playerCredits !== undefined) ? U.playerCredits : 0;');

// Initialize orbital stations array in Universe constructor
js = js.replace(/this\.nextAsteroid = 0;/g, 
    "this.nextAsteroid = 0;\n        this.orbitalStations = [];\n        this.playerUpgrades = {};\n        this.playerCredits = 0;");

// Add mission availability to planet constructor (1/3 chance) - only for planets, not ships
js = js.replace(/this\.stations = \[\];[\s\S]*?this\.angle = 0;/g, 
    'this.stations = [];\n        this.angle = 0;\n        this.hasMission = this.rng.between(0, 1) < 0.33; // 1/3 chance for mission availability');

// Add mission icon rendering to planet render method
js = js.replace(/this\.renderName\(\);/g, `this.renderName();
        
        // Render mission icon if planet has mission available
        if (this.hasMission && !G.missionStep) {
            wrap(() => {
                // Yellow exclamation point in triangle
                fs('#ff0');
                beginPath();
                moveTo(0, -this.radius - 30);
                lineTo(-15, -this.radius - 10);
                lineTo(15, -this.radius - 10);
                closePath();
                fill();
                
                // Exclamation point
                fs('#000');
                fillRect(-2, -this.radius - 25, 4, 10);
                fillRect(-2, -this.radius - 13, 4, 3);
            });
        }`);

// Add orbital stations to cycle and render
js = js.replace(/this\.bodies\.forEach\(body => body\.cycle\(e\)\);/g,
    "this.bodies.forEach(body => body.cycle(e));\n        if (this.orbitalStations) this.orbitalStations.forEach(station => station.cycle(e));");

js = js.replace(/this\.bodies\.forEach\(body => wrap\(\(\) => body\.render\(\)\)\);/g,
    "this.bodies.forEach(body => wrap(() => body.render()));\n        if (this.orbitalStations) this.orbitalStations.forEach(station => wrap(() => station.render()));");

// Add docked ship behavior and mission planet proximity detection in player ship cycle method
js = js.replace(/this\.x \+= this\.vX \* e;[\s\S]*?this\.y \+= this\.vY \* e;/g,
    `if (this.isDocked && this.dockedStation) {
        // Lock position to station while docked
        this.x = this.dockedStation.x;
        this.y = this.dockedStation.y;
        this.vX = 0;
        this.vY = 0;
    } else {
        this.x += this.vX * e;
        this.y += this.vY * e;
    }
    
    // Check for nearby planets with missions (5 ship lengths = ~150 units)
    this.nearMissionPlanet = null;
    if (!G.missionStep) {
        U.bodies.forEach(body => {
            if (body.hasMission && body.orbitsAround) { // Only planets with missions
                const distance = dist(this, body);
                if (distance <= body.radius + 150) { // Within 5 ship lengths
                    this.nearMissionPlanet = body;
                }
            }
        });
    }`);

// Add velocity damping with docking check
js = js.replace(/this\.vX \*= 0\.95;/g, 
    'if (!this.isDocked) this.vX *= 0.95;');
js = js.replace(/this\.vY \*= 0\.95;/g, 
    'if (!this.isDocked) this.vY *= 0.95;');

// Disable ship controls while in trading interface
js = js.replace(/this\.rotationDirection = 0;/g,
    'if (this.inTradingInterface) return;\n        this.rotationDirection = 0;');

// Disable shooting while in trading interface and add trading interface key handlers
js = js.replace(/if \(w\.down\[32\]\) \{/g,
    'if (w.down[32] && !U.playerShip.inTradingInterface) {');
js = js.replace(/if \(w\.down\[13\]\) \{/g,
    'if (w.down[13] && !U.playerShip.inTradingInterface) {');

// Add trading interface keyboard shortcuts
js = js.replace(/if \(w\.down\[32\]\) this\.shoot\(SimpleLaser\);/g,
    'if (w.down[83] && this.inTradingInterface && this.dockedStation) { /* S key for Sell */\n            const playerOre = this.civilization ? this.civilization.resources : 0;\n            if (playerOre > 0) {\n                this.dockedStation.sellOre();\n            }\n        }\n        if (w.down[82] && this.inTradingInterface && this.dockedStation) { /* R key for Repair */\n            const repairCost = 25;\n            const playerCredits = this.credits || 0;\n            if (playerCredits >= repairCost && (this.health < 1 || this.shield < 1)) {\n                this.dockedStation.repairShip();\n            }\n        }\n        if (w.down[77] && this.inTradingInterface && this.dockedStation) { /* M key for Mod Bay */\n            this.dockedStation.showModBay();\n        }\n        if (w.down[66] && this.inTradingInterface && this.dockedStation) { /* B key for Back to Trading */\n            this.dockedStation.showTradingInterface();\n        }\n        if ((w.down[49] || w.down[50] || w.down[51] || w.down[52] || w.down[53] || w.down[54] || w.down[55]) && this.inTradingInterface && this.dockedStation) { /* 1-7 keys for upgrades */\n            const upgradeTypes = ["hull", "shield", "phasers", "torpedos", "thermalVent", "weightCapacity", "cargoBay"];\n            const upgradeIndex = (w.down[49] ? 0 : w.down[50] ? 1 : w.down[51] ? 2 : w.down[52] ? 3 : w.down[53] ? 4 : w.down[54] ? 5 : 6);\n            this.dockedStation.purchaseUpgrade(upgradeTypes[upgradeIndex]);\n        }\n        if (w.down[76] && this.inTradingInterface && this.dockedStation) { /* L key for Leave */\n            this.dockedStation.undock();\n        }\n        if (w.down[27] && this.inTradingInterface && this.dockedStation) { /* Escape key for Leave */\n            this.dockedStation.undock();\n        }\n        if (w.down[32] && !this.inTradingInterface) this.shoot(SimpleLaser);');

// Disable mission prompts while in trading interface
js = js.replace(/G\.showPrompt\(\(\) => nomangle\('Incoming communication/g,
    'if (!U.playerShip.inTradingInterface) G.showPrompt(() => nomangle(\'Incoming communication');

// Make docked ship invulnerable to damage
js = js.replace(/damage\(source, amount\) \{/g,
    'damage(source, amount) {\n        if (this.isDocked) return; // Invulnerable while docked');

// Prevent docked ship from colliding with objects
js = js.replace(/if \(dist\(target, this\) < target\.radius \+ this\.radius\) \{/g,
    'if (dist(target, this) < target.radius + this.radius && !U.playerShip.isDocked) {');

// Add D key handler for docking - inject it directly into the player ship cycle
js = js.replace(/this\.rotationDirection = w\.down\[37\] \? -1 : \(w\.down\[39\] \? 1 : 0\);/g,
    'this.rotationDirection = w.down[37] ? -1 : (w.down[39] ? 1 : 0);\n\n        // D key for docking\n        if (w.down[68] && !this.inTradingInterface) {\n            console.log("D key pressed, checking for stations...");\n            if (U.bodies) {\n                const nearbyStation = U.bodies.find(body => {\n                    if (body.constructor && body.constructor.name === "OrbitalStation") {\n                        const distance = dist(body, U.playerShip);\n                        console.log("Station distance:", distance);\n                        return distance < 120;\n                    }\n                    return false;\n                });\n                if (nearbyStation) {\n                    console.log("Attempting to dock at station");\n                    nearbyStation.dock();\n                } else {\n                    console.log("No nearby station found");\n                }\n            } else {\n                console.log("No bodies array found");\n            }\n        }');

// Purple arrows for orbital stations removed - no longer needed

// Fix RELATIONSHIP constants in all station code - the constants are defined as color strings
js = js.replace(/RELATIONSHIP_ENEMY/g, "'#f00'");
js = js.replace(/RELATIONSHIP_ALLY/g, "'#0f0'");

// Add trading interface panel CSS and HTML
const tradingInterfaceCSS = `
<style>
#trading-panel {
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    background: rgba(0, 20, 40, 0.95);
    border: 2px solid #00ffff;
    border-radius: 10px;
    padding: 20px;
    color: #ffffff;
    font-family: monospace;
    font-size: 14px;
    min-width: 400px;
    max-width: 500px;
    z-index: 1000;
    box-shadow: 0 0 20px rgba(0, 255, 255, 0.3);
}

#trading-panel h2 {
    color: #00ffff;
    text-align: center;
    margin: 0 0 20px 0;
    font-size: 18px;
}

#trading-panel .section {
    margin-bottom: 15px;
    padding: 10px;
    background: rgba(0, 0, 0, 0.3);
    border-radius: 5px;
}

#trading-panel .section h3 {
    color: #ffff00;
    margin: 0 0 8px 0;
    font-size: 14px;
}

#trading-panel .info-row {
    display: flex;
    justify-content: space-between;
    margin: 5px 0;
}

#trading-panel .buttons {
    display: flex;
    gap: 10px;
    justify-content: center;
    margin-top: 20px;
}

#trading-panel button {
    background: #004080;
    border: 1px solid #00ffff;
    color: #ffffff;
    padding: 8px 16px;
    border-radius: 5px;
    cursor: pointer;
    font-family: monospace;
    font-size: 12px;
}

#trading-panel button:hover {
    background: #0066cc;
    box-shadow: 0 0 5px rgba(0, 255, 255, 0.5);
}

#trading-panel button:disabled {
    background: #333;
    color: #666;
    cursor: not-allowed;
}
</style>
`;

// Inject trading interface CSS into HTML - target the actual HTML file content
html = html.replace(/<\/head>/g, tradingInterfaceCSS + '</head>');

// Add trading panel creation function to global scope
const tradingPanelFunction = `
window.createTradingPanel = function(stationName, playerOre, playerCredits, orePerCredit, tradeValue, repairCost, canRepair) {
    // Remove existing panel if present
    const existingPanel = document.getElementById('trading-panel');
    if (existingPanel) {
        existingPanel.remove();
    }
    
    // Create panel with inline styles to ensure visibility
    const panel = document.createElement('div');
    panel.id = 'trading-panel';
    panel.style.cssText = \`
        position: fixed !important;
        top: 50% !important;
        left: 50% !important;
        transform: translate(-50%, -50%) !important;
        background: rgba(0, 20, 40, 0.95) !important;
        border: 2px solid #00ffff !important;
        border-radius: 10px !important;
        padding: 20px !important;
        color: #ffffff !important;
        font-family: monospace !important;
        font-size: 14px !important;
        min-width: 400px !important;
        max-width: 500px !important;
        z-index: 10000 !important;
        box-shadow: 0 0 20px rgba(0, 255, 255, 0.3) !important;
    \`;
    
    panel.innerHTML = \`
        <h2 style="color: #00ffff; text-align: center; margin: 0 0 20px 0; font-size: 18px;">\${stationName}</h2>
        
        <div style="margin-bottom: 15px; padding: 10px; background: rgba(0, 0, 0, 0.3); border-radius: 5px;">
            <h3 style="color: #ffff00; margin: 0 0 8px 0; font-size: 14px;">INVENTORY</h3>
            <div style="display: flex; justify-content: space-between; margin: 5px 0;">
                <span>Ore:</span>
                <span>\${playerOre} units</span>
            </div>
            <div style="display: flex; justify-content: space-between; margin: 5px 0;">
                <span>Credits:</span>
                <span>\${playerCredits}</span>
            </div>
        </div>
        
        <div style="margin-bottom: 15px; padding: 10px; background: rgba(0, 0, 0, 0.3); border-radius: 5px;">
            <h3 style="color: #ffff00; margin: 0 0 8px 0; font-size: 14px;">TRADE RATES</h3>
            <div style="display: flex; justify-content: space-between; margin: 5px 0;">
                <span>Station Rate:</span>
                <span>\${orePerCredit.toFixed(1)} ore/credit</span>
            </div>
            <div style="display: flex; justify-content: space-between; margin: 5px 0;">
                <span>Sell Value:</span>
                <span>\${tradeValue} credits</span>
            </div>
        </div>
        
        <div style="margin-bottom: 15px; padding: 10px; background: rgba(0, 0, 0, 0.3); border-radius: 5px;">
            <h3 style="color: #ffff00; margin: 0 0 8px 0; font-size: 14px;">SERVICES</h3>
            <div style="display: flex; justify-content: space-between; margin: 5px 0;">
                <span>Ship Repair:</span>
                <span>\${repairCost} credits</span>
            </div>
        </div>
        
        <div style="display: flex; gap: 10px; justify-content: center; margin-top: 20px; flex-wrap: wrap;">
            \${playerOre > 0 ? \`<button onclick="U.playerShip.dockedStation.sellOre()" style="background: #004080; border: 1px solid #00ffff; color: #ffffff; padding: 8px 16px; border-radius: 5px; cursor: pointer; font-family: monospace; font-size: 12px;">[S] Sell Ore (\${tradeValue} credits)</button>\` : ''}
            \${canRepair ? \`<button onclick="U.playerShip.dockedStation.repairShip()" style="background: #004080; border: 1px solid #00ffff; color: #ffffff; padding: 8px 16px; border-radius: 5px; cursor: pointer; font-family: monospace; font-size: 12px;">[R] Repair Ship (\${repairCost} credits)</button>\` : ''}
            <button onclick="U.playerShip.dockedStation.showModBay()" style="background: #006600; border: 1px solid #00ffff; color: #ffffff; padding: 8px 32px; border-radius: 5px; cursor: pointer; font-family: monospace; font-size: 12px; width: 100%; margin-top: 10px;">[M] MOD BAY</button>
            <button onclick="U.playerShip.dockedStation.undock()" style="background: #004080; border: 1px solid #00ffff; color: #ffffff; padding: 8px 16px; border-radius: 5px; cursor: pointer; font-family: monospace; font-size: 12px;">[L] Leave Station</button>
        </div>
    \`;
    
    document.body.appendChild(panel);
};

window.createModBayPanel = function(stationName, playerCredits, upgrades) {
    // Remove existing panel if present
    const existingPanel = document.getElementById('trading-panel');
    if (existingPanel) {
        existingPanel.remove();
    }
    
    const upgradeTypes = [
        {key: 'hull', name: 'Hull', description: 'Increases ship durability'},
        {key: 'shield', name: 'Shield', description: 'Improves shield strength'},
        {key: 'phasers', name: 'Phasers', description: 'Enhanced energy weapons'},
        {key: 'torpedos', name: 'Torpedos', description: 'Improved projectile weapons'},
        {key: 'thermalVent', name: 'Thermal Vent', description: 'Reduce weapon heat'},
        {key: 'weightCapacity', name: 'Weight Capacity', description: 'Increase Raw Materials Storage'},
        {key: 'cargoBay', name: 'Cargo Bay', description: 'Increase Cargo Storage'}
    ];
    
    // Create panel with inline styles
    const panel = document.createElement('div');
    panel.id = 'trading-panel';
    panel.style.cssText = \`
        position: fixed !important;
        top: 50% !important;
        left: 50% !important;
        transform: translate(-50%, -50%) !important;
        background: rgba(0, 20, 40, 0.95) !important;
        border: 2px solid #00ffff !important;
        border-radius: 10px !important;
        padding: 20px !important;
        color: #ffffff !important;
        font-family: monospace !important;
        font-size: 14px !important;
        min-width: 450px !important;
        max-width: 550px !important;
        z-index: 10000 !important;
        box-shadow: 0 0 20px rgba(0, 255, 255, 0.3) !important;
        max-height: 80vh !important;
        overflow-y: auto !important;
    \`;
    
    let upgradeButtons = '';
    upgradeTypes.forEach((upgrade, index) => {
        const currentLevel = upgrades[upgrade.key] || 0;
        const upgradeCost = 50 * Math.pow(2, currentLevel);
        const canAfford = playerCredits >= upgradeCost;
        const keyNumber = index + 1;
        
        upgradeButtons += \`
            <div style="margin-bottom: 10px; padding: 10px; background: rgba(0, 0, 0, 0.3); border-radius: 5px;">
                <div style="display: flex; justify-content: space-between; align-items: center;">
                    <div>
                        <strong style="color: #ffff00;">\${upgrade.name}</strong> (Level \${currentLevel})
                        <div style="font-size: 12px; color: #ccc;">\${upgrade.description}</div>
                    </div>
                    <button onclick="U.playerShip.dockedStation.purchaseUpgrade('\${upgrade.key}')" 
                            style="background: \${canAfford ? '#006600' : '#333'}; border: 1px solid #00ffff; color: \${canAfford ? '#ffffff' : '#666'}; padding: 6px 12px; border-radius: 5px; cursor: \${canAfford ? 'pointer' : 'not-allowed'}; font-family: monospace; font-size: 11px;" 
                            \${!canAfford ? 'disabled' : ''}>
                        [\${keyNumber}] \${upgradeCost} credits
                    </button>
                </div>
            </div>
        \`;
    });
    
    panel.innerHTML = \`
        <h2 style="color: #00ffff; text-align: center; margin: 0 0 20px 0; font-size: 18px;">\${stationName} - MOD BAY</h2>
        
        <div style="margin-bottom: 15px; padding: 10px; background: rgba(0, 0, 0, 0.3); border-radius: 5px;">
            <h3 style="color: #ffff00; margin: 0 0 8px 0; font-size: 14px;">CREDITS</h3>
            <div style="text-align: center; font-size: 16px;">\${playerCredits}</div>
        </div>
        
        <div style="margin-bottom: 15px;">
            <h3 style="color: #ffff00; margin: 0 0 10px 0; font-size: 14px;">SHIP UPGRADES</h3>
            \${upgradeButtons}
        </div>
        
        <div style="display: flex; gap: 10px; justify-content: center; margin-top: 20px;">
            <button onclick="U.playerShip.dockedStation.showTradingInterface()" style="background: #004080; border: 1px solid #00ffff; color: #ffffff; padding: 8px 16px; border-radius: 5px; cursor: pointer; font-family: monospace; font-size: 12px;">[B] Back to Trading</button>
            <button onclick="U.playerShip.dockedStation.undock()" style="background: #004080; border: 1px solid #00ffff; color: #ffffff; padding: 8px 16px; border-radius: 5px; cursor: pointer; font-family: monospace; font-size: 12px;">[L] Leave Station</button>
        </div>
    \`;
    
    document.body.appendChild(panel);
};
`;

js += tradingPanelFunction;

// Update resource gauge to use dynamic capacity
js = js.replace(/U\.playerShip\.civilization\.resources \/ PLANET_MAX_RESOURCES/g,
    'U.playerShip.civilization.resources / (window.getPlayerResourceCapacity ? window.getPlayerResourceCapacity() : PLANET_MAX_RESOURCES)');

// Add function to calculate player's max resource capacity based on upgrades
const resourceCapacityFunction = `
window.getPlayerResourceCapacity = function() {
    const baseCapacity = PLANET_MAX_RESOURCES; // 200
    if (!U || !U.playerShip || !U.playerShip.upgrades) {
        return baseCapacity;
    }
    const weightCapacityLevel = U.playerShip.upgrades.weightCapacity || 0;
    
    if (weightCapacityLevel === 0) {
        return baseCapacity;
    }
    
    // Check if in debug mode
    const isDebugMode = window.location.href.includes('debug.html');
    const multiplier = isDebugMode ? 2.0 : 1.2; // 100% increase in debug, 20% in regular
    
    return Math.floor(baseCapacity * Math.pow(multiplier, weightCapacityLevel));
};

window.getPlayerCargoBayCapacity = function() {
    const baseCapacity = 200; // Initial cargo bay capacity
    if (!U || !U.playerShip || !U.playerShip.upgrades) {
        return baseCapacity;
    }
    const cargoBayLevel = U.playerShip.upgrades.cargoBay || 0;
    
    if (cargoBayLevel === 0) {
        return baseCapacity;
    }
    
    // Check if in debug mode
    const isDebugMode = window.location.href.includes('debug.html');
    const multiplier = isDebugMode ? 2.0 : 1.2; // 100% increase in debug, 20% in regular
    
    return Math.floor(baseCapacity * Math.pow(multiplier, cargoBayLevel));
};

window.getTorpedoDamageMultiplier = function() {
    if (!U || !U.playerShip || !U.playerShip.upgrades) {
        return 1.0;
    }
    const torpedosLevel = U.playerShip.upgrades.torpedos || 0;
    
    if (torpedosLevel === 0) {
        return 1.0; // Base damage multiplier
    }
    
    // Check if in debug mode
    const isDebugMode = window.location.href.includes('debug.html');
    const multiplier = isDebugMode ? 2.0 : 1.2; // 100% increase in debug, 20% in regular
    
    return Math.pow(multiplier, torpedosLevel);
};

window.getPhaserDamageMultiplier = function() {
    if (!U || !U.playerShip || !U.playerShip.upgrades) {
        return 1.0;
    }
    const phasersLevel = U.playerShip.upgrades.phasers || 0;
    
    if (phasersLevel === 0) {
        return 1.0; // Base damage multiplier
    }
    
    // Check if in debug mode
    const isDebugMode = window.location.href.includes('debug.html');
    const multiplier = isDebugMode ? 2.0 : 1.2; // 100% increase in debug, 20% in regular
    
    return Math.pow(multiplier, phasersLevel);
};

window.getShieldCapacityMultiplier = function() {
    if (!U || !U.playerShip || !U.playerShip.upgrades) {
        return 1.0;
    }
    const shieldLevel = U.playerShip.upgrades.shield || 0;
    
    if (shieldLevel === 0) {
        return 1.0; // Base capacity multiplier
    }
    
    // Check if in debug mode
    const isDebugMode = window.location.href.includes('debug.html');
    const multiplier = isDebugMode ? 2.0 : 1.2; // 100% increase in debug, 20% in regular
    
    return Math.pow(multiplier, shieldLevel);
};

window.getHullCapacityMultiplier = function() {
    if (!U || !U.playerShip || !U.playerShip.upgrades) {
        return 1.0;
    }
    const hullLevel = U.playerShip.upgrades.hull || 0;
    
    if (hullLevel === 0) {
        return 1.0; // Base capacity multiplier
    }
    
    // Check if in debug mode
    const isDebugMode = window.location.href.includes('debug.html');
    const multiplier = isDebugMode ? 2.0 : 1.2; // 100% increase in debug, 20% in regular
    
    return Math.pow(multiplier, hullLevel);
};
`;

js += resourceCapacityFunction;

// Update torpedo damage based on upgrades
js = js.replace(/this\.damage = 0\.5;/g,
    'this.damage = 0.5 * (window.getTorpedoDamageMultiplier ? window.getTorpedoDamageMultiplier() : 1.0);');

// Update phaser damage based on upgrades
js = js.replace(/this\.damage = 0\.1;/g,
    'this.damage = 0.1 * (window.getPhaserDamageMultiplier ? window.getPhaserDamageMultiplier() : 1.0);');

// Update shield capacity based on upgrades - replace shield initialization and repair
js = js.replace(/this\.shield = 1;/g,
    'this.shield = window.getShieldCapacityMultiplier ? window.getShieldCapacityMultiplier() : 1.0;');

// Update shield repair to use maximum capacity
js = js.replace(/U\.playerShip\.shield = 1;/g,
    'U.playerShip.shield = window.getShieldCapacityMultiplier ? window.getShieldCapacityMultiplier() : 1.0;');

// Update shield gauge to use dynamic maximum
js = js.replace(/200 \* limit\(0, U\.playerShip\.shield, 1\)/g,
    '200 * limit(0, U.playerShip.shield, window.getShieldCapacityMultiplier ? window.getShieldCapacityMultiplier() : 1.0)');

// Update shield damage check to use dynamic maximum
js = js.replace(/U\.playerShip\.shield < 1/g,
    'U.playerShip.shield < (window.getShieldCapacityMultiplier ? window.getShieldCapacityMultiplier() : 1.0)');

// Update hull capacity based on upgrades - replace health initialization and repair
js = js.replace(/this\.health = 1;/g,
    'this.health = window.getHullCapacityMultiplier ? window.getHullCapacityMultiplier() : 1.0;');

// Update hull repair to use maximum capacity
js = js.replace(/U\.playerShip\.health = 1;/g,
    'U.playerShip.health = window.getHullCapacityMultiplier ? window.getHullCapacityMultiplier() : 1.0;');

// Update hull damage check to use dynamic maximum
js = js.replace(/U\.playerShip\.health < 1/g,
    'U.playerShip.health < (window.getHullCapacityMultiplier ? window.getHullCapacityMultiplier() : 1.0)');

// Reduce incoming communications frequency to 1/5th
js = js.replace(/G\.nextMission = 20;/g, 'G.nextMission = 100;');
js = js.replace(/G\.nextMission = G\.startedOnce \? 20 : 9;/g, 'G.nextMission = G.startedOnce ? 100 : 45;');

// Add upgrade and credit persistence logic to ship explode method
js = js.replace(/explode\(\) \{/g, `explode() {
        // Save player upgrades and credits before exploding
        if (typeof U !== "undefined" && this === U.playerShip) {
            if (this.upgrades) {
                U.playerUpgrades = {...this.upgrades};
            }
            if (this.credits !== undefined) {
                U.playerCredits = this.credits;
            }
        }`);

// Add respawn logic after ship removal
js = js.replace(/U\.dropResources\(this\.x, this\.y, 10\);/g, `U.dropResources(this.x, this.y, 10);
        
        // Respawn player ship after a delay if this was the player
        if (typeof U !== "undefined" && this === U.playerShip) {
            setTimeout(() => {
                U.createPlayerShip();
            }, 2000);
        }`);

// Add R key handler in onkeyup event
js = js.replace(/if \(isNaN\(character\)\) \{/g, `// Debug all R key presses
        if (e.keyCode === 82) {
            console.log('R key pressed!');
            console.log('U exists:', typeof U !== 'undefined');
            console.log('U.playerShip exists:', typeof U !== 'undefined' && U.playerShip);
            console.log('nearMissionPlanet:', typeof U !== 'undefined' && U.playerShip && U.playerShip.nearMissionPlanet);
            console.log('G.missionStep:', typeof G !== 'undefined' && G.missionStep);
        }
        
        // R key for mission communication (keyCode 82, character 'r')
        if (e.keyCode === 82 && typeof U !== 'undefined' && U.playerShip && U.playerShip.nearMissionPlanet && !G.missionStep) {
            console.log('R key pressed for mission communication - triggering mission!');
            const mission = U.playerShip.nearMissionPlanet.createRandomMission();
            U.playerShip.nearMissionPlanet.hasMission = false;
            U.playerShip.nearMissionPlanet = null;
            U.playerShip.showingMissionPrompt = false;
            G.showPrompt();
            
            // Directly proceed to the mission step instead of using PromptMission
            G.proceedToMissionStep(mission);
        }
        
        if (isNaN(character)) {`);

// Add click handling for planet missions - inject after constants are defined
js = js.replace(/w\.down = \{\};/g, `w.down = {};

// Mouse click handling for planet missions
let mouseX = 0, mouseY = 0;
document.addEventListener('mousemove', (e) => {
    const canvas = document.querySelector('canvas');
    const rect = canvas.getBoundingClientRect();
    mouseX = (e.clientX - rect.left) * (800 / rect.width); // Use hardcoded canvas width
    mouseY = (e.clientY - rect.top) * (600 / rect.height); // Use hardcoded canvas height
});

document.addEventListener('click', (e) => {
    if (typeof G === 'undefined' || typeof U === 'undefined') return;
    if (G.missionStep) return; // Don't allow new missions if one is active
    
    // Convert screen coordinates to world coordinates
    const worldX = (mouseX - 400) / V.zoomScale + U.playerShip.x; // 800/2 = 400
    const worldY = (mouseY - 300) / V.zoomScale + U.playerShip.y; // 600/2 = 300
    
    // Check if click is on a planet with mission
    U.bodies.forEach(body => {
        if (body.hasMission && body.orbitsAround) { // Only planets have orbitsAround
            const iconRadius = 20; // Click area around mission icon
            const iconY = body.y - body.radius - 20; // Icon position
            const iconDistance = Math.sqrt((worldX - body.x) ** 2 + (worldY - iconY) ** 2);
            
            if (iconDistance <= iconRadius) {
                // Trigger mission from this planet
                G.proceedToMissionStep(new PromptMission(body.createRandomMission()));
                body.hasMission = false; // Remove mission after accepting
            }
        }
    });
});`);

// Add method to create random missions for planets
js = js.replace(/nameWithRelationship\(\) \{/g, `createRandomMission() {
        // Pick another planet that's not too far yet not too close
        const close = body => between(1000, dist(body, this), 10000);
        const otherPlanets = () => U.bodies.filter(body => body.orbitsAround).filter(close);
        const otherPlanetAndStars = () => otherPlanets().concat(U.stars.filter(close));

        const missionStep = pick([
            new AttackPlanet(pick(otherPlanets())),
            new StudyBody(pick(otherPlanetAndStars())),
            new CollectResources(),
            new Asteroids(),
            new Pirates()
        ]);
        missionStep.civilization = this.civilization;
        return missionStep;
    }

    nameWithRelationship() {`);

// Add mission proximity message using showPrompt like docking with debug logging
js = js.replace(/if \(this\.thrust\) \{/g, `// Check for mission planet message with debug logging
        if (this.nearMissionPlanet && !G.missionStep && !this.showingMissionPrompt) {
            console.log('Showing mission prompt for planet:', this.nearMissionPlanet.name);
            this.showingMissionPrompt = true;
            G.showPrompt('Press [R] to receive communication from ' + this.nearMissionPlanet.name);
        } else if (!this.nearMissionPlanet && this.showingMissionPrompt) {
            console.log('Clearing mission prompt');
            this.showingMissionPrompt = false;
            G.showPrompt();
        }
        
        if (this.thrust) {`);

// Add missing global functions that might be needed
const globalFunctions = `
// Global utility functions
function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
function rnd(min, max) { return Math.random() * (max - min) + min; }
function limit(min, val, max) { return Math.max(min, Math.min(val, max)); }
function dist(a, b) { return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2); }
function distP(x1, y1, x2, y2) { return Math.sqrt((x1 - x2) ** 2 + (y1 - y2) ** 2); }
function angleBetween(a, b) { return Math.atan2(b.y - a.y, b.x - a.x); }
function cos(a) { return Math.cos(a); }
function sin(a) { return Math.sin(a); }
function max(a, b) { return Math.max(a, b); }
function min(a, b) { return Math.min(a, b); }
function abs(a) { return Math.abs(a); }
function between(min, val, max) { return val >= min && val <= max; }
function normalize(angle) { while (angle < -Math.PI) angle += 2 * Math.PI; while (angle > Math.PI) angle -= 2 * Math.PI; return angle; }
function moduloWithNegative(a, b) { return ((a % b) + b) % b; }

// Math constants
let PI = Math.PI;
let TWO_PI = Math.PI * 2;
`;

js = globalFunctions + js;

// Replace injection sites in HTML
html = html.replace('{{{ CSS_INJECTION_SITE}}}', css);
html = html.replace('{{{ JS_INJECTION_SITE }}}', js);

// Create build directory if it doesn't exist
if (!fs.existsSync('./build')) {
    fs.mkdirSync('./build');
}

// Write the final HTML file
fs.writeFileSync('./build/debug.html', html);

console.log('Simple build completed! Open build/debug.html in a browser.');
