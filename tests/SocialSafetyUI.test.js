import { jest } from '@jest/globals';
import { socialSafetyActions, socialSafetySettings } from '../src/ui/SocialSafetyUI.js';

test('blocking requires confirmation while reporting only opens a contextual draft', () => {
    const action = jest.fn();
    const panel = socialSafetyActions('Bob', 'Recruitment note', action);
    const [block, ignore, report] = panel.querySelectorAll('button');
    block.click(); expect(action).not.toHaveBeenCalled();
    block.click(); expect(action).toHaveBeenLastCalledWith('block', 'Bob', 'Recruitment note');
    ignore.click(); ignore.click(); expect(action).toHaveBeenLastCalledWith('ignore', 'Bob', 'Recruitment note');
    report.click(); expect(action).toHaveBeenLastCalledWith('report', 'Bob', 'Recruitment note');
});

test('safety settings let players explicitly undo persisted blocks and ignores', () => {
    const action = jest.fn();
    const panel = socialSafetySettings(action);
    panel.querySelector('input').value = ' Bob ';
    panel.querySelector('select').value = 'unignore';
    panel.querySelector('form').dispatchEvent(new Event('submit', { cancelable: true }));
    expect(action).toHaveBeenCalledWith('unignore', 'Bob', 'Social safety settings');
});
