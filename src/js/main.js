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

    // Click handling: map canvas clicks to world coordinates and check for planet offer icons
    const canvas = document.querySelector('canvas');
    canvas.addEventListener('click', (ev) => {
        try {
            const rect = canvas.getBoundingClientRect();
            const x = (ev.clientX - rect.left) / rect.width;
            const y = (ev.clientY - rect.top) / rect.height;

            // Convert to world coordinates
            const worldX = (x * CANVAS_WIDTH - CANVAS_WIDTH / 2) / V.zoomScale + V.x;
            const worldY = (y * CANVAS_HEIGHT - CANVAS_HEIGHT / 2) / V.zoomScale + V.y;

            // Find planets near the click
            let clickedPlanet = null;
            U.bodies.forEach(body => {
                if (body instanceof Planet) {
                    const d = Math.sqrt((body.x - worldX) * (body.x - worldX) + (body.y - worldY) * (body.y - worldY));
                    if (d <= body.radius + 8 && body.hasOffer) {
                        clickedPlanet = body;
                    }
                }
            });

            if (clickedPlanet) {
                // Trigger incoming communication / mission prompt for that planet
                if (G && typeof G.promptMissionFromPlanet === 'function') {
                    G.promptMissionFromPlanet(clickedPlanet);
                }
            }
        } catch (e) { /* ignore click errors */ }
    });
};
