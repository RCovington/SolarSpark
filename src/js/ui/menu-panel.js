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
    /* Panel header inline message */
    .menu-panel .panel-message, #menu-panel .panel-message, #trading-panel .panel-message {
        color: #f88;
        margin-top: 6px;
        min-height: 18px;
        transition: opacity 0.25s ease;
        opacity: 1;
    }
    .menu-panel .panel-message:empty, #menu-panel .panel-message:empty, #trading-panel .panel-message:empty { opacity: 0; }

    /* Shared price tooltip */
    .menu-panel .price-tooltip, #menu-panel .price-tooltip, #trading-panel .price-tooltip {
        position: absolute;
        pointer-events: none;
        background: rgba(0,0,0,0.85);
        color: #fff;
        padding: 6px 8px;
        border-radius: 4px;
        font-size: 12px;
        z-index: 9999;
        display: none;
        white-space: nowrap;
        box-shadow: 0 0 8px rgba(0,0,0,0.6);
        transition: opacity 0.08s ease;
    }

    /* Price elements */
    .menu-panel .price-el, #menu-panel .price-el, #trading-panel .price-el,
    .menu-panel .inv-price-el, #menu-panel .inv-price-el, #trading-panel .inv-price-el {
        margin-left: 8px;
        font-weight: bold;
    }

    /* Buy controls and qty UI */
    .menu-panel .controls, #menu-panel .controls, #trading-panel .controls { margin-left: 8px; }
    .menu-panel .qty-wrapper, #menu-panel .qty-wrapper, #trading-panel .qty-wrapper { display: none; align-items: center; }
    .menu-panel .qty-wrapper.open, #menu-panel .qty-wrapper.open, #trading-panel .qty-wrapper.open { display: inline-flex; }
    .menu-panel .qty-input, #menu-panel .qty-input, #trading-panel .qty-input { width: 48px; margin-right: 4px; font-family: monospace; }
    .menu-panel .controls button, #menu-panel .controls button, #trading-panel .controls button { margin-right: 6px; }

    /* Utility classes */
    .menu-panel .hidden, #menu-panel .hidden, #trading-panel .hidden { display: none !important; }
    .menu-panel .sell-btn, #menu-panel .sell-btn, #trading-panel .sell-btn { margin-left: 8px; }

    /* Capacity & credits indicators */
    .menu-panel .capacity-indicator, #menu-panel .capacity-indicator, #trading-panel .capacity-indicator,
    .menu-panel .credits-indicator, #menu-panel .credits-indicator, #trading-panel .credits-indicator {
        margin: 6px 0 12px 0;
        font-weight: bold;
        color: #ffd;
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
