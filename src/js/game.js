class Game {

    constructor() {
        G = this;

        // Ensure any persisted world save is cleared before we construct the Universe
        // so a deliberate "New Game" (or fresh page load) doesn't restore planet
        // dispositions from a previous playthrough.
        try {
            if (typeof localStorage !== 'undefined') {
                localStorage.removeItem('ss_save_v1');
                try { console.debug('constructor: cleared persistent save before universe creation'); } catch (e) {}
            }
        } catch (e) { /* ignore */ }

        U = new Universe();

        V = new Camera();
        G.setupNewGame();

        G.clock = 0;
        // G.promptClock = 0; // for reference

        // G.message = null; // for reference
        // G.messageProgress = 0; // for reference

        // G.missionStep = null; // for reference

    G.titleStickString = stickString(nomangle('SolarSpark'));
    G.subtitleStickString = stickString(nomangle(''));
        G.instructionsStickString = stickString(nomangle('press enter to send a ship'));

        G.titleCharWidth = G.subtitleCharWidth = 50;
        G.titleCharHeight = G.subtitleCharHeight = 100;

        G.startedOnce = false;
        G.startable = true;

        G.resourceIconOffsetY = 0;
        G.resourceIconScale = 1;
        G.resourceIconAlpha = 1;
        G.healthIconScale = 1;

        G.healthGaugeColor = '#fff';
        // Player lives (displayed in HUD)
        G.lives = 3;
    }

    proceedToMissionStep(missionStep) {
        if (G.missionStep) {
            G.missionStep.detach();
        }

        G.missionStep = missionStep;
    // Mission timer: increase baseline so missions come roughly 1/10th as often
    G.nextMission = 200;

        G.showPrompt();

        if (!missionStep) {
            return;
        }

        missionStep.proceedListener = missionStep => G.proceedToMissionStep(missionStep);
        missionStep.attach();
    }

    renderGauge(x, y, ratio, color, renderIcon) {
        wrap(() => {
            translate(x, y);

            fs('rgba(128,128,128,0.5)');
            fr(0, -5, 200, 10);

            fs(color);
            fr(0, -5, -2, 10);
            fr(200, -5, 2, 10);

            fr(0, -5, 200 * limit(0, ratio, 1), 10);

            translate(-25, 0);
            renderIcon();
        });
    }

    healAnimation(callback) {
        interp(G, 'resourceIconOffsetY', 0, -30, 0.3, 0, 0, () => {
            G.resourceIconOffsetY = 0;
        });

        interp(G, 'healthIconScale', 1, 2, 0.3, 0.2, 0, () => {
            interp(G, 'healthIconScale', 2, 1, 0.3, 0, 0, () => {
                G.healthGaugeColor = '#fff';
            });
        });

        setTimeout(() => G.healthGaugeColor = '#0f0', 200);

        interp(G, 'resourceIconScale', 1, 0, 0.3, 0, 0, () => {
            G.resourceIconScale = 1;
            callback();
        });

        interp(G, 'resourceIconAlpha', 1, 0, 0.3, 0, 0, () => {
            interp(G, 'resourceIconAlpha', 0, 1, 0.3, 0.3);
        });
    }

    resourceAnimation() {
        interp(G, 'resourceIconScale', 1, 2, 0.3, 0, 0, () => {
            interp(G, 'resourceIconScale', 2, 1, 0.3);
        });

        // interp(G, 'resourceIconAlpha', 1, 0, 0.3, 0, 0, () => {
        //     interp(G, 'resourceIconAlpha', 0, 1, 0.1);
        // });
    }

    cycle(e) {
        G.clock += e;

        if (G.started) {
            if ((G.nextMission -= e) <= 0) {
                G.promptRandomMission();
            }

            U.cycle(e);
            G.eventHub.emit(EVENT_CYCLE, e);
        }

        INTERPOLATIONS.slice().forEach(i => i.cycle(e));

        if (w.down[13]) {
            G.start();
        }

        // if (DEBUG) {
        //     G.renderedPlanets = 0;
        //     G.renderedOrbits = 0;
        //     G.renderedStars = 0;
        //     G.renderedAsteroids = 0;
        //     G.renderedShips = 0;
        //     G.renderedParticles = 0;
        // }

        U.render();

        // Render HUD
        wrap(() => {
            translate(V.shakeX, V.shakeY);

            fs('rgba(0,0,0,0.5)');
            R.strokeStyle = '#fff';
            // Widen the legend box so shield/hull numeric readouts and extra labels fit inside
            // Reduced height to remove excessive bottom gap
            fr(50, 30, 420, 150);
            strokeRect(50.5, 30.5, 420, 150);

            R.font = '10pt ' + monoFont;
            R.textAlign = nomangle('center');
            fs('#fff');

            const allyMap = U.bodies.reduce((map, body) => {
                if (body.civilization) {
                    map[body.civilization.relationshipType()]++;
                    map.total++;
                }
                return map;
            }, {'total': 1, RELATIONSHIP_ALLY: 0});

            fillText(nomangle('Peace: ') + ~~(allyMap[RELATIONSHIP_ALLY] * 100 / allyMap.total) + '%', 185, 140);

            G.renderGauge(100, 50, U.playerShip.health, (U.playerShip.health < 0.25 || G.clock - U.playerShip.lastDamage < 0.2) ? '#f00' : G.healthGaugeColor, () => {
                scale(0.5 * G.healthIconScale, 0.5 * G.healthIconScale);
                beginPath();
                moveTo(0, -15);
                lineTo(14, -10);
                lineTo(10, 10);
                lineTo(0, 18);
                lineTo(-10, 10);
                lineTo(-14, -10);
                fill();
            });

            wrap(() => {
                R.shadowColor = '#0f0';
                R.shadowBlur = 10;

                fs('cyan');
                fr(100, 45, 200 * limit(0, U.playerShip.shield, 1), 10);
            });

            // Compact HUD numeric labels
            try {
                R.font = '10pt ' + monoFont;
                R.textAlign = nomangle('left');

                // Shield and Hull: show as "<shields> : <hull>" with shields blue and hull white
                try {
                    // absolute shield points
                    const shieldBase = (typeof U.playerShip.maxShieldPoints === 'number') ? U.playerShip.maxShieldPoints : ((U.playerShip.baseStats && U.playerShip.baseStats.maxShieldPoints) ? U.playerShip.baseStats.maxShieldPoints : 100);
                    const shieldCurrentPoints = Math.round((U.playerShip.shield || 0) * (shieldBase));
                    // absolute hull points
                    const hullBase = (typeof U.playerShip.maxHullPoints === 'number') ? U.playerShip.maxHullPoints : ((U.playerShip.baseStats && U.playerShip.baseStats.maxHullPoints) ? U.playerShip.baseStats.maxHullPoints : 100);
                    const hullCurrentPoints = Math.round((U.playerShip.health || 0) * hullBase);

                    // Draw shields in blue
                    fs('cyan');
                    fillText(String(shieldCurrentPoints), 360, 60);
                    // Colon separator (small, white)
                    fs('#fff');
                    fillText(':', 395, 60);
                    // Hull in white
                    fs('#fff');
                    fillText(String(hullCurrentPoints), 405, 60);
                } catch (e) { /* ignore shield/hull label errors */ }

                // Materials bar: show highest mod upgrade level the player has
                try {
                    let highest = 0;
                    if (U.playerShip && U.playerShip.upgrades) {
                        Object.keys(U.playerShip.upgrades).forEach(k => {
                            const v = parseInt(U.playerShip.upgrades[k], 10) || 0;
                            if (v > highest) highest = v;
                        });
                    }
                    fs('#fff');
                    fillText('Mod Lv: ' + String(highest), 360, 95);
                } catch (e) { /* ignore mod label errors */ }
            } catch (e) { /* non-fatal HUD overlay error */ }

            G.renderGauge(100, 80, U.playerShip.civilization.resources / PLANET_MAX_RESOURCES, '#fff', () => {
                R.globalAlpha = G.resourceIconAlpha;

                translate(0, G.resourceIconOffsetY);
                scale(0.3 * G.resourceIconScale, 0.3 * G.resourceIconScale);
                renderResourcesIcon();
            });

            // Cargo usage bar
            try {
                let cargoUsed = 0;
                try {
                    const cargo = U.playerShip.cargo || {};
                    Object.keys(cargo).forEach(k => {
                        const d = (typeof CARGO_DATA !== 'undefined' && Array.isArray(CARGO_DATA)) ? CARGO_DATA.find(dd => dd.cargo === k) : null;
                        const per = d && d.storage_units ? d.storage_units : 1;
                        cargoUsed += (cargo[k] || 0) * per;
                    });
                } catch (e) { cargoUsed = 0; }

                const cargoCap = (typeof U.playerShip.cargoCapacity === 'number') ? U.playerShip.cargoCapacity : (U.playerShip.baseStats && U.playerShip.baseStats.cargoCapacity) || 200;

                G.renderGauge(100, 110, Math.min(1, cargoUsed / Math.max(1, cargoCap)), '#9cf', () => {
                    // small box icon for cargo
                    beginPath();
                    fr(-8, -6, 12, 12);
                });
                // Show credits next to cargo bar
                try {
                    R.font = '10pt ' + monoFont;
                    R.textAlign = nomangle('left');
                    fs('#fff');
                    const credits = (U.playerShip && typeof U.playerShip.credits === 'number') ? U.playerShip.credits : ((U.playerShip && U.playerShip.credits) ? U.playerShip.credits : 0);
                    fillText(String(credits) + ' CR', 360, 115);
                } catch (e) { /* ignore credits label errors */ }
            } catch (e) { /* ignore cargo HUD errors */ }

            // Heat bar (moved down)
            G.renderGauge(100, 140, U.playerShip.heat, U.playerShip.coolingDown ? '#f00' : '#fff', () => {
                fr(-5, -5, 3, 10);
                fr(-1, -5, 3, 10);
                fr(3, -5, 3, 10);
            });
            // Show lives next to heat bar
            try {
                R.font = '10pt ' + monoFont;
                R.textAlign = nomangle('left');
                fs('#fff');
                const lives = (typeof G.lives === 'number') ? G.lives : 0;
                fillText(String(lives) + ' lives', 360, 145);
            } catch (e) { /* ignore lives label errors */ }

            // Draw a vertical divider to show hull/shield are separate from the resource bars
            try {
                R.strokeStyle = 'rgba(255,255,255,0.15)';
                R.lineWidth = 1;
                beginPath();
                const dividerX = 50 + 320; // inside the widened box (adjusted for wider panel)
                moveTo(dividerX, 35);
                lineTo(dividerX, 35 + 150);
                stroke();
            } catch (e) { /* ignore divider errors */ }

            // Rendering targets
            let targets = [];

            const closestStars = U.stars.sort((a, b) => {
                return dist(a, U.playerShip) - dist(b, U.playerShip);
            }).slice(0, 3);

            const isInSystem = closestStars[0] && dist(closestStars[0], U.playerShip) < closestStars[0].reachRadius;

            if (isInSystem && !closestStars[0].systemDiscovered) {
                closestStars[0].systemDiscovered = true;
                G.showMessage(nomangle('system discovered - ') + closestStars[0].name);
            }

            if (G.missionStep) {
                targets = G.missionStep.targets || [];
                // (G.missionStep.targets || []).forEach(target => wrap(() => {
                //     U.transformToCamera();

                //     R.lineWidth = 4;
                //     R.strokeStyle = '#fff';
                //     R.globalAlpha = 0.1;

                //     setLineDash([20, 20]);
                //     beginPath();
                //     moveTo(U.playerShip.x, U.playerShip.y);
                //     lineTo(target.x, target.y);
                //     stroke();
                // }));
            } else if(!isInSystem) {
                targets = closestStars;
            }

            targets.forEach(target => {
                if (dist(target, U.playerShip) < (target.reachRadius || 0)) {
                    return;
                }

                const angle = angleBetween(U.playerShip, target);

                wrap(() => {
                    const distanceOnCircle = limit(0, (dist(target, U.playerShip) - target.reachRadius) / 4000, 1) * 200 + 50;

                    translate(CANVAS_WIDTH / 2 + cos(angle) * distanceOnCircle, CANVAS_HEIGHT / 2 + sin(angle) * distanceOnCircle);
                    rotate(angle);

                    // R.globalAlpha = 0.5;
                    fs(G.missionStep ? '#f80' : '#888');
                    beginPath();
                    moveTo(0, 0);
                    lineTo(-14, 10);
                    lineTo(-8, 0);
                    lineTo(-14, -10);
                    fill();
                });
            });

            // Draw green directional arrows for every planet the player has colonized
            try {
                const colonized = U.bodies.filter(b => b instanceof Planet && b.civilization && b.civilization.colonized);
                colonized.forEach(planet => {
                    if (dist(planet, U.playerShip) < (planet.reachRadius || 0)) return;

                    const angle = angleBetween(U.playerShip, planet);

                    wrap(() => {
                        const distanceOnCircle = limit(0, (dist(planet, U.playerShip) - (planet.reachRadius || 0)) / 4000, 1) * 200 + 50;

                        translate(CANVAS_WIDTH / 2 + cos(angle) * distanceOnCircle, CANVAS_HEIGHT / 2 + sin(angle) * distanceOnCircle);
                        rotate(angle);

                        // Bright green arrow slightly smaller than mission arrows
                        R.globalAlpha = 0.95;
                        fs('#0f0');
                        beginPath();
                        moveTo(0, 0);
                        lineTo(-10, 7);
                        lineTo(-5, 0);
                        lineTo(-10, -7);
                        fill();
                    });
                });
            } catch (e) { /* ignore HUD arrow errors */ }

            // Prompt
            const promptText = G.promptText();
            if (promptText) {
                wrap(() => {
                    fs('rgba(0,0,0,0.5)');
                    R.font = '20pt ' + monoFont;

                    translate(0, CANVAS_HEIGHT - (isTouch ? 400 : 200));
                    fr(0, 0, CANVAS_WIDTH, 200);

                    const textWidth = measureText(promptText + '_').width;
                    const actualText = this.currentPromptText();

                    fs('#fff');
                    R.textAlign = nomangle('left');
                    if (!G.selectedPromptOption) {
                        fillText(actualText, (CANVAS_WIDTH - textWidth) / 2, 50);
                    }

                    if (actualText.length >= promptText.length) {
                        R.textAlign = nomangle('center');
                        R.textBaseline = nomangle('middle');
                        R.font = '16pt ' + monoFont;

                        G.promptOptions.forEach((option, i) => {
                            fs('#fff');

                            if (G.selectedPromptOption) {
                                if (G.selectedPromptOption != option) {
                                    return;
                                }

                                R.globalAlpha = (sin(G.clock * TWO_PI * 4) + 1) / 2;
                            }

                            const promptText = '[' + option.label[0] + ']' + option.label.slice(1);
                            const x = (i + 1) * (CANVAS_WIDTH / (G.promptOptions.length + 1));

                            fr(x - PROMPT_OPTION_BOX_WIDTH / 2, 100 - PROMPT_OPTION_BOX_HEIGHT / 2, PROMPT_OPTION_BOX_WIDTH, PROMPT_OPTION_BOX_HEIGHT);

                            R.globalAlpha = 1;
                            fs('#000');
                            fillText(promptText, x, 100);
                        });
                    }
                });
            }

            const currentWarning = U.playerShip.currentWarning();
            if (currentWarning && currentWarning != G.currentWarning) {
                G.currentWarningEnd = G.clock + 3;
                G.currentWarning = currentWarning;

                warningSound();
            }

            if (!currentWarning) {
                G.currentWarning = 0;
            }

            if (G.currentWarning && G.clock < G.currentWarningEnd) {
                fs('rgba(255,0,0,0.5)');
                fr(0, 200, CANVAS_WIDTH, 125);

                R.font = '36pt ' + monoFont;
                R.textBaseline = 'middle';
                R.textAlign = nomangle('center');
                fs('#fff');
                fillText(nomangle('/!\\ WARNING /!\\'), CANVAS_WIDTH / 2, 250);

                R.font = '18pt ' + monoFont;
                fillText(G.currentWarning, CANVAS_WIDTH / 2, 300);

                G.message = 0; // don't want to have a warning and a message at the same time
            }

            R.strokeStyle = '#fff';
            R.lineCap = 'round';

            // Message
            if (G.message && G.messageProgress) {
                wrap(() => {
                    R.lineWidth = 4;

                    const messageWidth = G.message.width * 20;
                    translate((CANVAS_WIDTH - messageWidth) / 2, (CANVAS_HEIGHT - 100) / 2 - 200);
                    renderStickString(G.message, 20, 30, G.messageProgress, 0.1, 1);
                });
            }

            // Game title
            wrap(() => {
                translate(0, G.titleYOffset);

                fs('#000');
                fr(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

                R.lineWidth = 8;

                const everyonesY = (CANVAS_HEIGHT - G.titleCharHeight * 12 / 5) / 2;
                wrap(() => {
                    translate((CANVAS_WIDTH - G.titleStickString.width * G.titleCharWidth) / 2, everyonesY);
                    renderStickString(G.titleStickString, G.titleCharWidth, G.titleCharHeight, G.clock - 0.5, 0.1, 1);
                });

                wrap(() => {
                    R.lineWidth = G.subtitleCharThickness;
                    translate((CANVAS_WIDTH - G.subtitleStickString.width * G.subtitleCharWidth) / 2, everyonesY + G.titleCharHeight * 7 / 5);
                    renderStickString(G.subtitleStickString, G.subtitleCharWidth, G.subtitleCharHeight, G.clock - 0.5, 0.1 * (G.titleStickString.segments.length / G.subtitleStickString.segments.length), 1);
                });

                R.lineWidth = 4;

                const instructionCharWidth = 20;
                const instructionCharHeight = 30;
                wrap(() => {
                    if (G.clock % 1 > 0.5 && G.clock > 6 || G.titleYOffset) {
                        return;
                    }

                    translate((CANVAS_WIDTH - G.instructionsStickString.width * instructionCharWidth) / 2, CANVAS_HEIGHT - instructionCharHeight - 100);
                    renderStickString(G.instructionsStickString, instructionCharWidth, instructionCharHeight, G.clock - 5, 0.01, 0.2);
                });

                R.font = '20pt ' + monoFont;
                fs('#fff');
                R.textAlign = nomangle('center');

                G.gameRecap.forEach((line, i) => {
                    fillText(line, CANVAS_WIDTH / 2, CANVAS_HEIGHT * 3 / 4 - 50 + i * 30);
                });
            });
        });

        // Touch controls
        wrap(() => {
            if (!isTouch) {
                return;
            }

            translate(0, CANVAS_HEIGHT - 200);

            R.globalAlpha = 0.8;
            fs('#000');
            fr(0, 0, CANVAS_WIDTH, 200);

            fs('#fff');

            translate(0, 100);

            wrap(() => {
                R.globalAlpha = w.down[37] ? 1 : 0.5;

                translate(CANVAS_WIDTH * 1 / 8, 0);
                rotate(PI);

                G.mobileArrow();
            });

            wrap(() => {
                R.globalAlpha = w.down[39] ? 1 : 0.5;

                translate(CANVAS_WIDTH * 3 / 8, 0);

                G.mobileArrow();
            });

            wrap(() => {
                R.globalAlpha = w.down[32] ? 1 : 0.5;

                translate(CANVAS_WIDTH * 5 / 8, 0);

                beginPath();
                moveTo(0, 0);
                arc(0, 0, MOBILE_BUTTON_SIZE / 2, 0, TWO_PI);
                fill();
            });

            wrap(() => {
                R.globalAlpha = w.down[38] ? 1 : 0.5;

                translate(CANVAS_WIDTH * 7 / 8, 0);
                rotate(-PI / 2);

                G.mobileArrow();
            });
        });

        // if (DEBUG) {
        //     wrap(() => {
        //         R.font = '10pt ' + monoFont;
        //         fs('#fff');
        //
        //         const info = [
        //             'fps: ' + G.fps,
        //             'planets: ' + G.renderedPlanets,
        //             'stars: ' + G.renderedStars,
        //             'orbits: ' + G.renderedOrbits,
        //             'asteroids: ' + G.renderedAsteroids,
        //             'ships: ' + G.renderedShips,
        //             'particles: ' + G.renderedParticles
        //         ];
        //         let y = 20;
        //         info.forEach(info => {
        //             fillText(info, CANVAS_WIDTH - 200, y);
        //             y += 20;
        //         });
        //     });
        // }
    }

    mobileArrow() {
        beginPath();
        moveTo(MOBILE_BUTTON_SIZE / 2, 0);
        lineTo(-MOBILE_BUTTON_SIZE / 2, -MOBILE_BUTTON_SIZE / 2);
        lineTo(-MOBILE_BUTTON_SIZE / 2, MOBILE_BUTTON_SIZE / 2);
        fill();
    }

    showPrompt(promptText, options) {
        G.promptText = promptText && promptText.call ? promptText : () => promptText;
        G.promptClock = G.clock;
        G.promptOptions = options || [];
        G.selectedPromptOption = 0;

        if (G.promptText()) {
            promptSound();
        }
    }

    selectPromptOption(characterOrIndex) {
        const actualText = G.currentPromptText();
        if (actualText.length < (G.promptText() || '').length || G.selectedPromptOption) {
            return;
        }

        (G.promptOptions || []).forEach((option, i) => {
            if (i == characterOrIndex || option.label[0].toLowerCase() === characterOrIndex) {
                G.selectedPromptOption = option;
                setTimeout(option.action, 500); // add a short delay so we can show that the option was selected
                selectSound();
            }
        });
    }

    showMessage(message) {
        G.message = stickString(message);
        interp(G, 'messageProgress', G.message.segments.length, 0, G.message.segments.length * 0.1, 3);
        interp(G, 'messageProgress', 0, G.message.segments.length, G.message.segments.length * 0.1);

        findSytemSound();
    }

    promptRandomMission() {
        // Missions only come from the closest planet
        const planet = U.bodies
            .filter(body => body.orbitsAround)
            .reduce((closest, body) => !closest || dist(U.playerShip, body) < dist(U.playerShip, closest) ? body : closest, null);

        if (planet && !G.missionStep) {
            // Pick another planet that's not too far yet not too close
            const close = body => between(1000, dist(body, planet), 10000);
            const otherPlanets = () => U.bodies.filter(body => body.orbitsAround).filter(close);
            const otherPlanetAndStars = () => otherPlanets().concat(U.stars.filter(close));

            const missionStep = pick([
                new AttackPlanet(pick(otherPlanets())),
                new StudyBody(pick(otherPlanetAndStars())),
                new CollectResources(),
                new Asteroids(),
                new Pirates()
            ]);
            missionStep.civilization = planet.civilization;

            G.proceedToMissionStep(new PromptMission(missionStep));

            for (let i = 0, d = max(planet.radius, dist(U.playerShip, planet) - V.visibleWidth) ; d < dist(U.playerShip, planet) ; i++, d += 50) {
                const angle = angleBetween(planet, U.playerShip);
                // const particle = {
                //     'alpha': 0,
                //     'render': () => wrap()
                // };
                // U.particles.push(particle);

                particle(0, [
                    ['alpha', 1, 0, 0.1, i * 0.02 + 0.2],
                    ['alpha', 0, 1, 0.1, i * 0.02]
                ], particle => {
                    R.strokeStyle = '#fff';
                    R.lineWidth = 2;
                    R.globalAlpha = particle.alpha;
                    beginPath();
                    arc(planet.x, planet.y, d, angle - PI / 16, angle + PI / 16);
                    stroke();
                });
            }
        }

    }

    // Prompt a mission specifically for a given planet (used when player clicks the offer icon)
    promptMissionFromPlanet(planet) {
        try {
            if (!planet || !planet.civilization || G.missionStep) return;

            // Choose a mission similar to promptRandomMission but anchored to the clicked planet
            const close = body => between(1000, dist(body, planet), 10000);
            const otherPlanets = () => U.bodies.filter(body => body.orbitsAround).filter(close);
            const otherPlanetAndStars = () => otherPlanets().concat(U.stars.filter(close));

            const missionStep = pick([
                new AttackPlanet(pick(otherPlanets())),
                new StudyBody(pick(otherPlanetAndStars())),
                new CollectResources(),
                new Asteroids(),
                new Pirates()
            ]);
            missionStep.civilization = planet.civilization;

            G.proceedToMissionStep(new PromptMission(missionStep));
        } catch (e) { /* ignore */ }
    }

    missionDone(success) {
        const missionStep = G.missionStep;
        G.proceedToMissionStep();

        // Update reputation in addition to relationship: +100 on success, -100 on failure
        try {
            if (missionStep && missionStep.civilization && typeof missionStep.civilization.reputation === 'number') {
                missionStep.civilization.reputation += success ? 100 : -100;
                // Apply the reputation mapping so a large reputation change can flip ally/enemy state
                if (typeof missionStep.civilization.applyReputationToRelationship === 'function') {
                    missionStep.civilization.applyReputationToRelationship();
                }
            }
        } catch (e) {}

        // Persist state after reputation/relationship changes
        try { if (typeof U !== 'undefined' && typeof U.saveState === 'function') U.saveState(); } catch (e) {}

        // Also apply the standard relationship delta from mission outcome
        missionStep.civilization.updateRelationship(success ? RELATIONSHIP_UPDATE_MISSION_SUCCESS : RELATIONSHIP_UPDATE_MISSION_FAILED);

        G.showPrompt(nomangle('Mission ') + (success ? nomangle('SUCCESS') : nomangle('FAILED')) + '. ' + missionStep.civilization.center.name + nomangle(' will remember that.'), [{
            'label': dismiss,
            'action': () => G.showPrompt()
        }]);
    }

    start() {
        if (G.started || !G.startable) {
            return;
        }

        U.createPlayerShip();

        // Ensure some planet offers exist when the player starts
        try {
            if (typeof U !== 'undefined' && typeof U.refreshOffers === 'function') {
                U.refreshOffers();
                U.offerRefreshTimer = 600;
            }
        } catch (e) { /* ignore */ }

        interp(G, 'titleYOffset', 0, -CANVAS_HEIGHT, 0.3);

        if (!G.startedOnce) {
            V.zoomScale = V.targetScaleOverride = 1;
            setTimeout(() => G.proceedToMissionStep(new PromptTutorialStep()), 3000);
        }

    // Increase mission cadence baseline for less frequent incoming communications
    G.nextMission = G.startedOnce ? 200 : 90;
        G.started = G.startedOnce = true;

        introSound();
    }

    gameOver() {
        const civilizations = U.bodies
            .filter(body => body.civilization && body.civilization.relationshipType() != body.civilization.initialRelationship)
            .map(body => body.civilization);

        const enemiesMade = civilizations.filter(civilization => civilization.relationshipType() == RELATIONSHIP_ENEMY).length;
        const alliesMade = civilizations.filter(civilization => civilization.relationshipType() == RELATIONSHIP_ALLY).length;

        let subtitle;
        if (enemiesMade + alliesMade < GAME_RECAP_MIN_RELATIONSHIP_CHANGES) {
            subtitle = nomangle('you were barely noticed');
        } else if (abs(enemiesMade - alliesMade) < GAME_RECAP_RELATIONSHIP_CHANGES_NEUTRAL_THRESHOLD) {
            subtitle = nomangle('little has changed');
        } else if (enemiesMade > alliesMade) {
            subtitle = nomangle('you brought war');
        } else {
            subtitle = nomangle('you brought peace');
        }

        G.titleStickString = stickString(nomangle('game over'));
        G.subtitleStickString = stickString(subtitle);
        G.instructionsStickString = stickString(nomangle('press enter to send another ship'));

        G.subtitleCharWidth = 25;
        G.subtitleCharHeight = 50;
        G.subtitleCharThickness = 6;

        G.startable = G.started = false;

        G.clock = 0;

        interp(G, 'titleYOffset', -CANVAS_HEIGHT, 0, 0.3, 0, 0, () => G.setupNewGame());

        setTimeout(() => {
            G.gameRecap = [
                enemiesMade + nomangle(' planets have declared war against you'),
                alliesMade + nomangle(' species have become your allies')
            ];
            G.startable = true;
        }, 4000);
    }

    setupNewGame() {
        G.eventHub = new EventHub();

        G.promptText = () => 0;

        G.started = false;

        G.titleYOffset = 0;

        G.missionStep = 0;
        G.currentWarning = 0;

        G.gameRecap = [];
        // Clear any persisted save when starting a fresh new game so reputation, credits, and other
        // global state are reset. Upgrades will still be persisted for respawn via localStorage
        // but a deliberate New Game should wipe saved state.
        try {
            if (typeof localStorage !== 'undefined') {
                localStorage.removeItem('ss_save_v1');
                try { console.debug('setupNewGame: cleared persistent save'); } catch (e) {}
            }
        } catch (e) { /* ignore */ }
        // Reset lives for a fresh new game
        try { G.lives = 3; } catch (e) {}
    }

    currentPromptText() {
        const promptText = G.promptText() || '';
        const length = ~~min((G.clock - G.promptClock) * 20, promptText.length);
        return promptText.slice(0, length) + (length < promptText.length || (G.clock % 1) > 0.5 ? '_' : '');
    }

}
