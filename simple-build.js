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

// Inject cargo data into the bundle so UI can reference CARGO_DATA at runtime
try {
    const cargoJson = fs.readFileSync('./data/cargo.json', 'utf8');
    js = 'const CARGO_DATA = ' + cargoJson + '\n' + js;
} catch (e) {
    console.log('Warning: could not read data/cargo.json - planet markets will use fallback values');
}

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

// Reduce mission frequency by about tenfold (keep in sync with src changes)
js = js.replace(/G\.nextMission = 20;/g, 'G.nextMission = 200;');
js = js.replace(/G\.nextMission = G\.startedOnce \? 20 : 9;/g, 'G.nextMission = G.startedOnce ? 200 : 90;');

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
$1    const orbitalStation = new OrbitalStation(star, outerOrbitRadius, stationPhase);
$1    this.orbitalStations.push(orbitalStation);
$1    this.bodies.push(orbitalStation);
$1}

$1// Create some pirates`);

// Initialize orbital stations array in Universe constructor
js = js.replace(/this\.nextAsteroid = 0;/g, 
    "this.nextAsteroid = 0;\n        this.orbitalStations = [];");

// Add orbital stations to cycle and render
js = js.replace(/this\.bodies\.forEach\(body => body\.cycle\(e\)\);/g,
    "this.bodies.forEach(body => body.cycle(e));\n        if (this.orbitalStations) this.orbitalStations.forEach(station => station.cycle(e));");

js = js.replace(/this\.bodies\.forEach\(body => wrap\(\(\) => body\.render\(\)\)\);/g,
    "this.bodies.forEach(body => wrap(() => body.render()));\n        if (this.orbitalStations) this.orbitalStations.forEach(station => wrap(() => station.render()));");

// Add docked ship behavior in player ship cycle method
// Restrict this replacement to the PlayerShip class block so it cannot span multiple files
js = js.replace(/class PlayerShip[\s\S]*?\{[\s\S]*?this\.x \+= this\.vX \* e;[\s\S]*?this\.y \+= this\.vY \* e;[\s\S]*?\}/g, match => {
    return match.replace(/this\.x \+= this\.vX \* e;[\s\S]*?this\.y \+= this\.vY \* e;/, `if (this.isDocked && (this.dockedStation || this.dockedPlanet)) {
            // Ship is docked - follow the station or planet
            const dockTarget = this.dockedStation || this.dockedPlanet;
            this.x = dockTarget.x + this.dockOffset.x;
            this.y = dockTarget.y + this.dockOffset.y;
        } else {
            // Normal ship movement
            this.x += this.vX * e;
            this.y += this.vY * e;
        }`);
});

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
    'if (w.down[83] && this.inTradingInterface && (this.dockedStation || this.dockedPlanet)) { /* S key for Sell */\n            const playerResources = this.civilization ? this.civilization.resources : 0;\n            if (playerResources > 0) {\n                if (this.dockedStation) this.dockedStation.sellResources();\n                else if (this.dockedPlanet && this.dockedPlanet.sellResources) this.dockedPlanet.sellResources();\n            }\n        }\n        if (w.down[82] && this.inTradingInterface && (this.dockedStation || this.dockedPlanet)) { /* R key for Repair */\n            const repairCost = 20;\n            const playerCredits = this.credits || 0;\n            if (playerCredits >= repairCost && (this.health < 1 || this.shield < 1)) {\n                if (this.dockedStation) this.dockedStation.repairShip();\n                else if (this.dockedPlanet && this.dockedPlanet.repairShip) this.dockedPlanet.repairShip();\n            }\n        }\n        if (w.down[76] && this.inTradingInterface && (this.dockedStation || this.dockedPlanet)) { /* L key for Leave */\n            if (this.dockedStation) this.dockedStation.undock();\n            else if (this.dockedPlanet && window.planetaryUndock) window.planetaryUndock();\n        }\n        if (w.down[27] && this.inTradingInterface && (this.dockedStation || this.dockedPlanet)) { /* Escape key for Leave */\n            if (this.dockedStation) this.dockedStation.undock();\n            else if (this.dockedPlanet && window.planetaryUndock) window.planetaryUndock();\n        }\n        if (w.down[32] && !this.inTradingInterface) this.shoot(SimpleLaser);');

// Disable mission prompts while in trading interface
js = js.replace(/G\.showPrompt\(\(\) => nomangle\('Incoming communication/g,
    'if (!U.playerShip.inTradingInterface) G.showPrompt(() => nomangle(\'Incoming communication');

// Make docked ship invulnerable to damage
js = js.replace(/damage\(source, amount\) \{/g,
    'damage(source, amount) {\n        if (this.isDocked) return; // Invulnerable while docked');

// Prevent docked ship from colliding with objects
js = js.replace(/if \(dist\(target, this\) < target\.radius \+ this\.radius\) \{/g,
    'if (dist(target, this) < target.radius + this.radius && !U.playerShip.isDocked) {');

// Add D key handler for docking - insert in player ship cycle method
js = js.replace(/if \(w\.down\[32\]\) this\.shoot\(SimpleLaser\);/g,
    'if (w.down[68] && !this.inTradingInterface) { /* D key for docking */\n            console.log("D key pressed, checking for stations...");\n            if (U.orbitalStations) {\n                console.log("Found orbital stations:", U.orbitalStations.length);\n                const nearbyStation = U.orbitalStations.find(station => {\n                    const distance = dist(station, U.playerShip);\n                    console.log("Station distance:", distance, "showing prompt:", station.showingDockPrompt);\n                    return distance < 120;\n                });\n                if (nearbyStation) {\n                    console.log("Attempting to dock at station");\n                    nearbyStation.dock();\n                } else {\n                    console.log("No nearby station found");\n                }\n            } else {\n                console.log("No orbital stations array found");\n            }\n        }\n        if (w.down[32]) this.shoot(SimpleLaser);');

// Purple arrows for orbital stations removed - no longer needed

// Fix RELATIONSHIP constants in all station code - the constants are defined as color strings
js = js.replace(/RELATIONSHIP_ENEMY/g, "'#f00'");
js = js.replace(/RELATIONSHIP_ALLY/g, "'#0f0'");

// (Trading panel creation moved into src/js/ui/trading-panel-wrapper.js and src/js/ui/menu-panel.js)

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
function atan2(y, x) { return Math.atan2(y, x); }
function abs(x) { return Math.abs(x); }
function min(a, b) { return Math.min(a, b); }
function max(a, b) { return Math.max(a, b); }
function sign(x) { return Math.sign(x); }
function random() { return Math.random(); }
function normalize(angle) { while (angle > Math.PI) angle -= 2 * Math.PI; while (angle < -Math.PI) angle += 2 * Math.PI; return angle; }
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
