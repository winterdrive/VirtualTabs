import * as path from 'path';
import { pathToFileURL } from 'url';
import { matchesStoredFileEntry } from '../../core/FileEntryMatcher';

describe('matchesStoredFileEntry', () => {
    test('returns false for an empty stored path', () => {
        const targetFsPath = path.resolve('/workspace/project/src/extension.ts');
        const targetUri = pathToFileURL(targetFsPath).toString();

        expect(matchesStoredFileEntry('', targetUri, targetFsPath, '/workspace/project')).toBe(false);
    });

    test('matches relative stored path against file URI/fsPath using scope root', () => {
        const scopeRoot = path.resolve('/workspace/project');
        const targetFsPath = path.resolve(scopeRoot, 'src/extension.ts');
        const targetUri = pathToFileURL(targetFsPath).toString();

        expect(matchesStoredFileEntry('src/extension.ts', targetUri, targetFsPath, scopeRoot)).toBe(true);
    });

    test('does not match a relative stored path without a scope root', () => {
        const targetFsPath = path.resolve('/workspace/project/src/extension.ts');
        const targetUri = pathToFileURL(targetFsPath).toString();

        expect(matchesStoredFileEntry('src/extension.ts', targetUri, targetFsPath)).toBe(false);
    });

    test('matches absolute stored paths by normalized filesystem path', () => {
        const targetFsPath = path.resolve('/workspace/project/src/provider.ts');
        const targetUri = pathToFileURL(targetFsPath).toString();

        expect(matchesStoredFileEntry(targetFsPath, targetUri, targetFsPath, '/workspace/project')).toBe(true);
    });

    test('matches file URI stored path directly', () => {
        const targetFsPath = path.resolve('/workspace/project/src/commands.ts');
        const targetUri = pathToFileURL(targetFsPath).toString();

        expect(matchesStoredFileEntry(targetUri, targetUri, targetFsPath, '/workspace/project')).toBe(true);
    });

    test('matches file URI stored path by filesystem path when URI strings differ but resolve to the same file', () => {
        const targetFsPath = path.resolve('/workspace/project/src/file with spaces.ts');
        const targetUri = pathToFileURL(targetFsPath).toString();
        const localhostUri = targetUri.replace('file:///', 'file://localhost/');

        expect(matchesStoredFileEntry(localhostUri, targetUri, targetFsPath, '/workspace/project')).toBe(true);
    });

    test('returns false for different file', () => {
        const scopeRoot = path.resolve('/workspace/project');
        const targetFsPath = path.resolve(scopeRoot, 'src/extension.ts');
        const targetUri = pathToFileURL(targetFsPath).toString();

        expect(matchesStoredFileEntry('src/provider.ts', targetUri, targetFsPath, scopeRoot)).toBe(false);
    });
});
