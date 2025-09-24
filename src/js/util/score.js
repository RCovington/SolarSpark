// Scoring system and persistent high scores
(function(){
    try { console.debug && console.debug('score: module init'); } catch (e) {}

    const HS_KEY = 'ss_highscores_v1';
    const MAX_ENTRIES = 10;

    const Score = {
        _score: 0,
        _materialsCount: 0, // counts resources picked up; 1 point per 50
        _highScores: [],

        reset() {
            this._score = 0;
            this._materialsCount = 0;
        },

        add(points, reason) {
            try {
                points = (typeof points === 'number') ? points : 0;
                if (!isFinite(points) || points === 0) return this._score;
                this._score += points;
                // Broadcast for any HUD listeners
                try { if (window.G && G.eventHub && typeof G.eventHub.emit === 'function') G.eventHub.emit('score:changed', {delta: points, total: this._score, reason}); } catch (e) {}
                return this._score;
            } catch (e) { return this._score; }
        },

        get() { return this._score || 0; },

        onMaterialCollected(units) {
            try {
                const add = Math.max(0, units|0);
                if (!add) return;
                this._materialsCount += add;
                while (this._materialsCount >= 50) {
                    this._materialsCount -= 50;
                    this.add(1, 'materials');
                }
            } catch (e) {}
        },

        loadHighScores() {
            try {
                const raw = (typeof localStorage !== 'undefined') ? localStorage.getItem(HS_KEY) : null;
                const arr = raw ? JSON.parse(raw) : [];
                if (Array.isArray(arr)) this._highScores = arr.filter(x => x && typeof x.score === 'number').slice(0, MAX_ENTRIES);
            } catch (e) { this._highScores = []; }
            return this._highScores;
        },

        saveHighScores() {
            try { if (typeof localStorage !== 'undefined') localStorage.setItem(HS_KEY, JSON.stringify(this._highScores || [])); } catch (e) {}
        },

        top() { return (this._highScores && this._highScores.slice().sort((a,b)=>b.score-a.score)) || []; },

        qualifies(score) {
            try {
                score = (typeof score === 'number') ? score : this.get();
                const list = this.top();
                if (list.length < MAX_ENTRIES) return true;
                const min = list[list.length - 1].score;
                return score > min;
            } catch (e) { return false; }
        },

        addHighScore(name, score) {
            try {
                name = (name && String(name).trim()) || 'Anonymous';
                score = (typeof score === 'number') ? score : this.get();
                const entry = { name, score, date: Date.now() };
                const list = this.top();
                list.push(entry);
                list.sort((a,b)=>b.score-a.score);
                this._highScores = list.slice(0, MAX_ENTRIES);
                this.saveHighScores();
                return true;
            } catch (e) { return false; }
        },

        showHighScoreBoard() {
            try {
                const existing = document.getElementById('ss-highscore-board');
                if (existing) try { existing.remove(); } catch (e) {}
                const wrap = document.createElement('div');
                wrap.id = 'ss-highscore-board';
                wrap.style.position = 'fixed';
                wrap.style.left = '50%';
                wrap.style.top = '50%';
                wrap.style.transform = 'translate(-50%, -50%)';
                wrap.style.background = 'rgba(0,0,0,0.8)';
                wrap.style.color = '#fff';
                wrap.style.padding = '16px 20px';
                wrap.style.border = '1px solid #888';
                wrap.style.borderRadius = '8px';
                wrap.style.fontFamily = 'monospace';
                wrap.style.zIndex = 12000;
                wrap.style.minWidth = '380px';

                const h = document.createElement('div');
                h.textContent = 'High Scores';
                h.style.fontWeight = 'bold';
                h.style.fontSize = '18px';
                h.style.marginBottom = '8px';
                wrap.appendChild(h);

                const list = this.top();
                const ol = document.createElement('ol');
                ol.style.margin = '0 0 12px 20px';
                list.slice(0, MAX_ENTRIES).forEach(e => {
                    const li = document.createElement('li');
                    const d = new Date(e.date || Date.now());
                    li.textContent = `${e.name} — ${e.score} (${d.toLocaleDateString()})`;
                    ol.appendChild(li);
                });
                wrap.appendChild(ol);

                const controls = document.createElement('div');
                controls.style.textAlign = 'right';
                controls.innerHTML = '<button type="button" id="ss-hs-close">Close</button>';
                wrap.appendChild(controls);

                document.body.appendChild(wrap);
                try { document.getElementById('ss-hs-close').addEventListener('click', () => { try { wrap.remove(); } catch (e) {} }); } catch (e) {}
            } catch (e) {}
        },

        showHighScorePromptIfNeeded() {
            try {
                const score = this.get();
                if (!this.qualifies(score)) { this.showHighScoreBoard(); return false; }
                const existing = document.getElementById('ss-highscore-prompt');
                if (existing) return true;
                const wrap = document.createElement('div');
                wrap.id = 'ss-highscore-prompt';
                wrap.style.position = 'fixed';
                wrap.style.left = '50%';
                wrap.style.top = '50%';
                wrap.style.transform = 'translate(-50%, -50%)';
                wrap.style.background = 'rgba(0,0,0,0.9)';
                wrap.style.color = '#fff';
                wrap.style.padding = '16px 20px';
                wrap.style.border = '1px solid #888';
                wrap.style.borderRadius = '8px';
                wrap.style.fontFamily = 'monospace';
                wrap.style.zIndex = 12000;
                wrap.style.minWidth = '380px';

                const title = document.createElement('div');
                title.textContent = 'New High Score!';
                title.style.fontWeight = 'bold';
                title.style.fontSize = '18px';
                title.style.marginBottom = '8px';
                wrap.appendChild(title);

                const label = document.createElement('label');
                label.textContent = 'Enter your name:';
                label.style.display = 'block';
                label.style.marginBottom = '6px';
                wrap.appendChild(label);

                const input = document.createElement('input');
                input.type = 'text';
                input.maxLength = 24;
                input.style.width = '100%';
                input.style.marginBottom = '10px';
                wrap.appendChild(input);

                const buttons = document.createElement('div');
                buttons.style.textAlign = 'right';
                const saveBtn = document.createElement('button');
                saveBtn.type = 'button';
                saveBtn.textContent = 'Save';
                const skipBtn = document.createElement('button');
                skipBtn.type = 'button';
                skipBtn.textContent = 'Skip';
                skipBtn.style.marginLeft = '8px';
                buttons.appendChild(saveBtn);
                buttons.appendChild(skipBtn);
                wrap.appendChild(buttons);

                document.body.appendChild(wrap);
                setTimeout(() => { try { input.focus(); input.select(); } catch (e) {} }, 50);

                const finish = (save) => {
                    try {
                        if (save) {
                            const name = input.value && input.value.trim() ? input.value.trim() : 'Anonymous';
                            this.addHighScore(name, score);
                        }
                        try { wrap.remove(); } catch (e) {}
                        this.showHighScoreBoard();
                    } catch (e) {}
                };
                saveBtn.addEventListener('click', () => finish(true));
                skipBtn.addEventListener('click', () => finish(false));
                input.addEventListener('keydown', (ev) => {
                    if (ev.key === 'Enter') finish(true);
                    if (ev.key === 'Escape') finish(false);
                });
                return true;
            } catch (e) { return false; }
        }
    };

    // expose
    window.Score = Score;
    try { Score.loadHighScores(); } catch (e) {}
    try { Score.reset(); } catch (e) {}
})();
