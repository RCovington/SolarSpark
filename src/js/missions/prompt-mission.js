class PromptMission extends MissionStep {

    constructor(missionStep) {
        super();
        this.missionStep = missionStep;
    }

    attach() {
        super.attach();

        let timeleft = 15;
        this.listen(EVENT_CYCLE, e => {
            if ((timeleft -= e) < 0) {
                this.proceed();
            }
        });

        G.showPrompt(() => nomangle('Incoming communication from ') + this.missionStep.civilization.center.nameWithRelationship() + ' - ' + formatTime(timeleft), [{
            'label': nomangle('Respond'),
            'action': () => {
                timeleft = 15;
                G.showPrompt(() => this.missionStep.prompt + ' - ' + formatTime(timeleft), [{
                    'label': nomangle('Accept'),
                    'action': () => this.proceed(this.missionStep)
                }, {
                    'label': nomangle('Refuse'),
                    'action': () => this.proceed()
                }]);
            }
        }, {
            'label': nomangle('Ignore'),
            'action': () => this.proceed()
        }]);
    }

    proceed(missionStep) {
        super.proceed(missionStep);

        // If a missionStep was provided it means the player accepted the mission.
        // Clear any offer state on the planet so the offer disappears immediately.
        if (missionStep) {
            try {
                const planet = missionStep.civilization && missionStep.civilization.center;
                if (planet) {
                    planet.hasOffer = false;
                    planet.offerExpires = null;
                }
            } catch (e) {
                // defensive: don't break the mission flow if something unexpected is shaped
                console.error('Error clearing planet offer on accept', e);
            }
        }

        if (!missionStep) {
            this.missionStep.civilization.updateRelationship(RELATIONSHIP_UPDATE_MISSION_IGNORED);
            G.showPrompt(nomangle('Communication ignored. ') + this.missionStep.civilization.center.name + nomangle(' will remember that'), [{
                'label': dismiss,
                'action': () => G.showPrompt()
            }]);
            setTimeout(() => G.showPrompt(), 5000);
        }
    }

}
