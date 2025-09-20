// Reusable menu panel creator
(function(){
    // Basic CSS for menu panels (kept consistent with prior trading panel look)
    const css = `
/* Styling applies to the generic menu panel id, the legacy trading-panel id, and any element with class .menu-panel */
.menu-panel, #menu-panel, #trading-panel {
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
    min-width: 360px;
    max-width: 520px;
    z-index: 10000;
    box-shadow: 0 0 20px rgba(0, 255, 255, 0.3);
}
.menu-panel h2, #menu-panel h2, #trading-panel h2 { color: #00ffff; text-align: center; margin: 0 0 12px 0; font-size: 18px; }
.menu-panel .section, #menu-panel .section, #trading-panel .section { margin-bottom: 12px; padding: 10px; background: rgba(0,0,0,0.3); border-radius: 5px; }
.menu-panel .section h3, #menu-panel .section h3, #trading-panel .section h3 { color: #ffff00; margin: 0 0 8px 0; font-size: 14px; }
.menu-panel .info-row, #menu-panel .info-row, #trading-panel .info-row { display:flex; justify-content:space-between; margin:6px 0; }
.menu-panel .buttons, #menu-panel .buttons, #trading-panel .buttons { display:flex; gap:10px; justify-content:center; margin-top:12px; flex-wrap:wrap; }
.menu-panel button, #menu-panel button, #trading-panel button { background:#004080; border:1px solid #00ffff; color:#fff; padding:8px 14px; border-radius:5px; cursor:pointer; font-family:monospace; font-size:12px; }
.menu-panel button:hover, #menu-panel button:hover, #trading-panel button:hover { background:#0066cc; box-shadow:0 0 5px rgba(0,255,255,0.5); }
.menu-panel button:disabled, #menu-panel button:disabled, #trading-panel button:disabled { background:#333; color:#666; cursor:not-allowed; }
`;

    // Inject CSS once
    let injected = false;
    function ensureCSS() {
        if (injected) return;
        injected = true;
        try {
            console.debug('menu-panel: injecting CSS');
            const style = document.createElement('style');
            style.setAttribute('id', 'menu-panel-css');
            style.innerHTML = css;
            document.head.appendChild(style);
        } catch (e) { /* ignore */ }
    }

    // Helper to create a panel
    window.createMenuPanel = function(options) {
        try { console.debug('createMenuPanel called', options && options.id, options && options.title); } catch(e) {}
        // options: { id?, title, sections: [{title, rows: [{label, value}] , html?}], buttons: [{label, onClick, disabled}], onClose }
        ensureCSS();

        const existing = document.getElementById(options.id || 'menu-panel');
        if (existing) existing.remove();

    const panel = document.createElement('div');
    panel.id = options.id || 'menu-panel';
    // Also add a class so CSS can target it regardless of id
    try { panel.classList.add('menu-panel'); } catch (e) {}

        const titleHtml = `<h2>${options.title || ''}</h2>`;

        let bodyHtml = '';
        if (options.sections && options.sections.length) {
            options.sections.forEach(sec => {
                if (sec.html) {
                    bodyHtml += `<div class="section">${sec.html}</div>`;
                } else {
                    bodyHtml += `<div class="section">`;
                    if (sec.title) bodyHtml += `<h3>${sec.title}</h3>`;
                    if (sec.rows && sec.rows.length) {
                        sec.rows.forEach(r => {
                            bodyHtml += `<div class="info-row"><span>${r.label}</span><span>${r.value}</span></div>`;
                        });
                    }
                    if (sec.extraHtml) bodyHtml += sec.extraHtml;
                    bodyHtml += `</div>`;
                }
            });
        }

        // Buttons
        let buttonsHtml = '<div class="buttons">';
        if (options.buttons && options.buttons.length) {
            options.buttons.forEach((b, i) => {
                const disabled = b.disabled ? 'disabled' : '';
                // We need unique handlers; use data attributes and attach after
                buttonsHtml += `<button data-menu-button-index="${i}" ${disabled}>${b.label}</button>`;
            });
        }
        // Always include a Close button unless explicitly disabled
        if (!options.noClose) {
            buttonsHtml += `<button data-menu-button-index="_close">Close</button>`;
        }
        buttonsHtml += '</div>';

        panel.innerHTML = titleHtml + bodyHtml + buttonsHtml;

        document.body.appendChild(panel);

        // Attach handlers
        if (options.buttons && options.buttons.length) {
            options.buttons.forEach((b, i) => {
                const btn = panel.querySelector(`button[data-menu-button-index="${i}"]`);
                if (!btn) return;
                btn.addEventListener('click', (ev) => {
                    try { b.onClick(ev); } catch (e) { console.error(e); }
                    // If button requested autoClose, remove the panel
                    if (b.autoClose !== false) panel.remove();
                    if (options.onClose) options.onClose();
                });
            });
        }

        const closeBtn = panel.querySelector('button[data-menu-button-index="_close"]');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => {
                panel.remove();
                if (options.onClose) options.onClose();
            });
        }

        return panel;
    };

})();
