export const PREVIEW_POSES = Object.freeze([
    ['Idle', 'Standing'], ['CombatIdle', 'Combat stance'], ['Run', 'Running'], ['Attack', 'Attack'],
    ['OffhandAttack', 'Offhand attack'], ['Block', 'Block'], ['Guard', 'Guard'], ['Cast', 'Cast'], ['Channel', 'Channel'],
    ['Shout', 'Shout'], ['Bless', 'Bless'], ['Jump', 'Jump'], ['Death', 'Death']
]);

// Static pose inspection: user input draws one frame, with no animation timer.
export class CharacterPoseControls {
    constructor(host, onChange) {
        this.root = document.createElement('div'); this.root.className = 'character-pose-controls';
        this.root.setAttribute('role', 'group'); this.root.setAttribute('aria-label', 'Appearance poses');
        const poseLabel = document.createElement('label'); poseLabel.append('Pose');
        this.pose = document.createElement('select'); this.pose.setAttribute('aria-label', 'Preview pose');
        poseLabel.append(this.pose);
        const momentLabel = document.createElement('label'), heading = document.createElement('span');
        heading.append('Moment '); this.value = document.createElement('output'); heading.append(this.value);
        this.moment = document.createElement('input'); this.moment.type = 'range';
        this.moment.min = '0'; this.moment.max = '100'; this.moment.step = '1';
        this.moment.setAttribute('aria-label', 'Moment in pose'); momentLabel.append(heading, this.moment);
        this.root.append(poseLabel, momentLabel); host.insertAdjacentElement('afterend', this.root);
        this.changePose = () => { if (!this.pose.disabled) onChange(this.pose.value, .35); };
        this.changeMoment = () => { if (!this.moment.disabled) onChange(this.pose.value, Number(this.moment.value) / 100); };
        this.pose.addEventListener('change', this.changePose); this.moment.addEventListener('input', this.changeMoment);
        this.sync([], 'Idle', 0);
    }

    sync(choices, state, fraction) {
        const signature = choices.map(([value]) => value).join('|');
        if (signature !== this.signature) {
            this.signature = signature;
            this.pose.replaceChildren(...choices.map(([value, label]) => {
                const option = document.createElement('option'); option.value = value; option.textContent = label; return option;
            }));
        }
        this.pose.disabled = this.moment.disabled = !choices.length;
        this.pose.value = state; this.moment.value = String(Math.round(fraction * 100));
        this.value.textContent = `${this.moment.value}%`;
        this.moment.setAttribute('aria-valuetext', `${this.moment.value} percent of ${this.pose.selectedOptions[0]?.textContent || 'pose'}`);
    }

    dispose() {
        this.pose.removeEventListener('change', this.changePose); this.moment.removeEventListener('input', this.changeMoment);
        this.root.remove();
    }
}
