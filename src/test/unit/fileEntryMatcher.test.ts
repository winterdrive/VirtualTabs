import * as path from 'path';
import { pathToFileURL } from 'url';
import { matchesStoredFileEntry } from '../../core/FileEntryMatcher';

describe('matchesStoredFileEntry', () => {
    test('matches relative stored path against file URI/fsPath using scope root', () => {
        const scopeRoot = path.resolve('/workspace/project');
        const targetFsPath = path.resolve(scopeRoot, 'src/extension.ts');
        const targetUri = pathToFileURL(targetFsPath).toString();

        expect(matchesStoredFileEntry('src/extension.ts', targetUri, targetFsPath, scopeRoot)).toBe(true);
    });

    test('matches file URI stored path directly', () => {
        const targetFsPath = path.resolve('/workspace/project/src/commands.ts');
        const targetUri = pathToFileURL(targetFsPath).toString();

        expect(matchesStoredFileEntry(targetUri, targetUri, targetFsPath, '/workspace/project')).toBe(true);
    });

    test('returns false for different file', () => {
        const scopeRoot = path.resolve('/workspace/project');
        const targetFsPath = path.resolve(scopeRoot, 'src/extension.ts');
        const targetUri = pathToFileURL(targetFsPath).toString();

        expect(matchesStoredFileEntry('src/provider.ts', targetUri, targetFsPath, scopeRoot)).toBe(false);
    });
});
