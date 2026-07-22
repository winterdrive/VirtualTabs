jest.mock('vscode', () => ({}), { virtual: true });

import { I18n } from '../../i18n';

describe('I18n.getMessage placeholder formatting', () => {
    test('substitutes a plain placeholder argument', () => {
        expect(I18n.getMessage('Hello {0}!', 'world')).toBe('Hello world!');
    });

    test('does not treat a literal $ in an argument as a special replacement pattern', () => {
        // e.g. a UNC path like \\server\C$\path, which String.replace would
        // otherwise mangle when the replacement is passed as a raw string.
        const uncPath = '\\\\server\\C$\\path';
        expect(I18n.getMessage('Copied to {0}', uncPath)).toBe(`Copied to ${uncPath}`);
    });

    test('does not expand $& / $$ / $1 style patterns found in an argument', () => {
        expect(I18n.getMessage('Error: {0}', 'price is $100 (was $$50, ref $&)'))
            .toBe('Error: price is $100 (was $$50, ref $&)');
    });

    test('substitutes multiple placeholders independently', () => {
        expect(I18n.getMessage('{0} -> {1}', 'a$1', 'b')).toBe('a$1 -> b');
    });
});
