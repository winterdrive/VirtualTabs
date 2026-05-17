import * as path from 'path';
import { pathToFileURL } from 'url';
import { removeStoredFileEntriesFromGroup } from '../../core/GroupFileRemoval';
import type { TempGroup } from '../../types';

function createTarget(scopeRoot: string, relativePath: string) {
    const fsPath = path.join(scopeRoot, relativePath);
    return {
        uri: pathToFileURL(fsPath).toString(),
        fsPath
    };
}

describe('removeStoredFileEntriesFromGroup', () => {
    test('returns false when the group has no files', () => {
        const group: Pick<TempGroup, 'files' | 'bookmarks'> = {};
        const target = createTarget(path.resolve('/workspace/project'), 'src/extension.ts');

        expect(removeStoredFileEntriesFromGroup(group, [target], '/workspace/project')).toBe(false);
        expect(group.files).toBeUndefined();
    });

    test('returns false when there are no selected targets', () => {
        const group: Pick<TempGroup, 'files' | 'bookmarks'> = {
            files: ['src/extension.ts']
        };

        expect(removeStoredFileEntriesFromGroup(group, [], '/workspace/project')).toBe(false);
        expect(group.files).toEqual(['src/extension.ts']);
    });

    test('removes every selected relative file and keeps unmatched bookmarks', () => {
        const scopeRoot = path.resolve('/workspace/project');
        const group: Pick<TempGroup, 'files' | 'bookmarks'> = {
            files: ['src/extension.ts', 'src/commands.ts', 'README.md'],
            bookmarks: {
                'src/extension.ts': [{ id: 'b1', line: 1, label: 'extension', created: 1 }],
                'README.md': [{ id: 'b2', line: 2, label: 'readme', created: 2 }]
            }
        };

        const removed = removeStoredFileEntriesFromGroup(
            group,
            [
                createTarget(scopeRoot, 'src/extension.ts'),
                createTarget(scopeRoot, 'src/commands.ts')
            ],
            scopeRoot
        );

        expect(removed).toBe(true);
        expect(group.files).toEqual(['README.md']);
        expect(group.bookmarks).toEqual({
            'README.md': [{ id: 'b2', line: 2, label: 'readme', created: 2 }]
        });
    });
});
