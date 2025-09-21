class TimedMissionStep extends MissionStep {

    attach() {
        this.timeleft = 120;
        this.listen(EVENT_CYCLE, e => {
            if ((this.timeleft -= e) < 0) {
                G.missionDone(false);
            }
        });

        // Create a stable prompt function so we can re-assert it if other systems overwrite/clear prompts.
        // We only re-assert when necessary (i.e. when another caller changed the prompt), to avoid
        // continuously resetting the prompt clock which drives the typewriter effect.
        this._missionPromptFunc = () => this.instructions() + ' - ' + formatTime(this.timeleft);
        G.showPrompt(this._missionPromptFunc);

        // Defensive: if some other system overwrites or clears the prompt while this mission is active,
        // re-assert our mission prompt on the next cycle. The listener is registered via this.listen so
        // it will be removed automatically when the mission detaches.
        this.listen(EVENT_CYCLE, () => {
            try {
                if (G.missionStep !== this) return;
                if (G.promptText !== this._missionPromptFunc) {
                    G.showPrompt(this._missionPromptFunc);
                }
            } catch (e) { /* ignore */ }
        });
    }

    reach(target, prompt) {
        const step = new ReachTarget(target, prompt);
        step.civilization = this.civilization;
        this.proceed(step);

        step.timeleft = this.timeleft;
    }

}
