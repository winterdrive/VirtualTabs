jest.mock('vscode', () => ({}), { virtual: true });

import { I18n } from '../../i18n';

describe('I18n.stripCopyPostfix', () => {
    // With no language file loaded, getMessage('group.copyPostfix') falls back to the
    // key itself, so the postfix used for stripping is the literal string 'group.copyPostfix'.
    const postfix = 'group.copyPostfix';

    test('strips a trailing postfix with no index', () => {
        expect(I18n.stripCopyPostfix(`Notes ${postfix}`)).toBe('Notes');
    });

    test('strips a trailing postfix followed by an index', () => {
        expect(I18n.stripCopyPostfix(`Notes ${postfix} 2`)).toBe('Notes');
    });

    test('leaves a name without the postfix unchanged', () => {
        expect(I18n.stripCopyPostfix('Notes')).toBe('Notes');
    });

    test('is used by getCopyGroupName round-trip so repeated duplication does not stack postfixes', () => {
        const original = 'Notes';
        const firstCopy = I18n.getCopyGroupName(original);
        const strippedAgain = I18n.stripCopyPostfix(firstCopy);
        expect(strippedAgain).toBe(original);
    });
});
