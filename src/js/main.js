onload = () => {
    onresize(); // trigger initial sizing pass

    const can = document.querySelector('canvas');
    can.width = CANVAS_WIDTH;
    can.height = CANVAS_HEIGHT;

    R = can.getContext('2d');

    // Shortcut for all canvas methods to the main canvas
    Object.getOwnPropertyNames(p).forEach(n => {
        if (R[n] && R[n].call) {
            w[n] = p[n].bind(R);
        }
    });

    // Detect available fonts
    R.font = nomangle('99pt f'); // Setting a font that obviously doesn't exist
    const reference = measureText(w.title).width;

    for (let fontName of [nomangle('Mono'), nomangle('Courier')]) {
        R.font = '99pt ' + fontName;
        if (measureText(w.title).width != reference) {
            monoFont = fontName;
            break;
        }
    }

    new Game();

    // Start cycle()
    let lf = Date.now();
    let frame = () => {
        let n = Date.now(),
            e = (n - lf) / 1000;

        // if(DEBUG){
        //     G.fps = ~~(1 / e);
        // }

        lf = n;

        G.cycle(e);

        requestAnimationFrame(frame);
    };
    frame();

    // Click handling: first check prompt option boxes for touch/click selection, then map to world coords for planet clicks
    const canvas = document.querySelector('canvas');
    function handleCanvasPointer(ev) {
        try {
            const rect = canvas.getBoundingClientRect();
            const x = (ev.clientX - rect.left) / rect.width;
            const y = (ev.clientY - rect.top) / rect.height;

            // 1) Prompt option hit test (for touch screens): if prompt is visible and fully typed, allow clicking boxes
            try {
                const hasPrompt = typeof G !== 'undefined' && G && typeof G.promptText === 'function' && G.promptText();
                const opts = (G && G.promptOptions) || [];
                if (hasPrompt && opts.length) {
                    const full = (G.currentPromptText && (G.currentPromptText().length >= (G.promptText() || '').length));
                    if (full && !G.selectedPromptOption) {
                        // Special case: if there's only one option, tapping anywhere should activate it
                        if (opts.length === 1) {
                            try { if (typeof G.selectPromptOption === 'function') G.selectPromptOption(0); } catch (e) {}
                            return; // consumed by single-option selection
                        }

                        // Multiple options: check specific option boxes
                        const screenX = x * CANVAS_WIDTH;
                        const screenY = y * CANVAS_HEIGHT;
                        // Match the same transform used in render: prompt area anchored at bottom
                        const promptTop = CANVAS_HEIGHT - (isTouch ? 400 : 200);
                        const centerY = promptTop + 100;
                        for (let i = 0; i < opts.length; i++) {
                            const centerX = (i + 1) * (CANVAS_WIDTH / (opts.length + 1));
                            const x0 = centerX - PROMPT_OPTION_BOX_WIDTH / 2;
                            const y0 = centerY - PROMPT_OPTION_BOX_HEIGHT / 2;
                            const x1 = x0 + PROMPT_OPTION_BOX_WIDTH;
                            const y1 = y0 + PROMPT_OPTION_BOX_HEIGHT;
                            if (screenX >= x0 && screenX <= x1 && screenY >= y0 && screenY <= y1) {
                                try { if (typeof G.selectPromptOption === 'function') G.selectPromptOption(i); } catch (e) {}
                                return; // consumed by prompt selection; do not propagate to planet click
                            }
                        }
                    }
                }
            } catch (e) { /* ignore prompt hit-test errors */ }

            // Convert to world coordinates
            const worldX = (x * CANVAS_WIDTH - CANVAS_WIDTH / 2) / V.zoomScale + V.x;
            const worldY = (y * CANVAS_HEIGHT - CANVAS_HEIGHT / 2) / V.zoomScale + V.y;

            // Find planets near the click - distinguish between planet body and exclamation icon
            let clickedPlanet = null;
            let clickedOfferIcon = false;
            
            U.bodies.forEach(body => {
                if (body instanceof Planet) {
                    const d = Math.sqrt((body.x - worldX) * (body.x - worldX) + (body.y - worldY) * (body.y - worldY));
                    
                    // Check if we clicked on the exclamation icon (if planet has an offer)
                    if (body.hasOffer) {
                        const iconSize = Math.max(12, Math.min(24, ~~(body.radius / 2)));
                        // Icon is centered on the planet, so check if click is within icon bounds
                        if (d <= iconSize + 4) { // small buffer around icon
                            clickedPlanet = body;
                            clickedOfferIcon = true;
                            return;
                        }
                    }
                    
                    // Check if we clicked on the planet body itself (for docking)
                    if (d <= body.radius + 8) {
                        clickedPlanet = body;
                        clickedOfferIcon = false;
                    }
                }
            });

            if (clickedPlanet) {
                if (clickedOfferIcon) {
                    // Clicked exclamation icon: trigger incoming communication / mission prompt
                    if (G && typeof G.promptMissionFromPlanet === 'function') {
                        G.promptMissionFromPlanet(clickedPlanet);
                    }
                } else {
                    // Clicked planet body: attempt to dock if in range
                    const playerShip = U.playerShip;
                    if (playerShip && dist(playerShip, clickedPlanet) <= clickedPlanet.reachRadius) {
                        try {
                            // Trigger docking action directly
                            if (typeof clickedPlanet.dock === 'function') {
                                clickedPlanet.dock(playerShip);
                            } else if (G && typeof G.showPrompt === 'function') {
                                // Fallback: show dock prompt
                                G.showPrompt(nomangle('Press D to dock.'), [{
                                    label: nomangle('Dock'),
                                    action: () => {
                                        try { if (typeof clickedPlanet.dock === 'function') clickedPlanet.dock(playerShip); } catch (e) {}
                                        G.showPrompt();
                                    }
                                }]);
                            }
                        } catch (e) { /* ignore dock errors */ }
                    }
                }
            }
        } catch (e) { /* ignore click errors */ }
    }
    canvas.addEventListener('click', handleCanvasPointer);
    // Also support touchstart for more responsive touch interactions
    try { canvas.addEventListener('touchstart', (te) => {
        try {
            if (te && te.touches && te.touches[0]) {
                const t = te.touches[0];
                // Synthesize a minimal event-like object for handler
                handleCanvasPointer({ clientX: t.clientX, clientY: t.clientY, preventDefault: () => {}, stopPropagation: () => {} });
                te.preventDefault();
            }
        } catch (e) { /* ignore */ }
    }, { passive: false }); } catch (e) { /* ignore */ }
};
