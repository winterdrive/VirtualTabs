import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { FileManager } from '../../core/FileManager';
import { GroupManager } from '../../core/GroupManager';
import type { TempGroup } from '../../types';

describe('FileManager relative-path membership', () => {
    let tmpDir: string;

    beforeEach(() => {
        tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vt-fm-test-'));
    });

    afterEach(() => {
        fs.rmSync(tmpDir, { recursive: true, force: true });
    });

    function setupWorkspace(groups: TempGroup[]): { gm: GroupManager; fm: FileManager } {
        fs.mkdirSync(path.join(tmpDir, '.vscode'), { recursive: true });
        fs.writeFileSync(path.join(tmpDir, '.vscode', 'virtualTab.json'), JSON.stringify(groups));
        const gm = new GroupManager(tmpDir);
        const fm = new FileManager(tmpDir, gm);
        return { gm, fm };
    }

    test('addFilesToGroup skips a file already stored as a workspace-relative path', () => {
        const { fm, gm } = setupWorkspace([{
            id: 'group-1',
            name: 'Test Group',
            files: ['src/foo.ts']
        }]);

        const result = fm.addFilesToGroup('group-1', [path.join(tmpDir, 'src', 'foo.ts')]);

        expect(result.added).toEqual([]);
        expect(result.skipped).toEqual([path.join(tmpDir, 'src', 'foo.ts')]);

        const { groups } = gm.loadGroups();
        expect(groups[0].files).toEqual(['src/foo.ts']);
    });

    test('removeFilesFromGroup removes a file stored as a workspace-relative path', () => {
        const { fm, gm } = setupWorkspace([{
            id: 'group-1',
            name: 'Test Group',
            files: ['src/foo.ts', 'src/bar.ts']
        }]);

        const result = fm.removeFilesFromGroup('group-1', [path.join(tmpDir, 'src', 'foo.ts')]);

        expect(result.removed).toEqual([path.join(tmpDir, 'src', 'foo.ts')]);
        expect(result.notFound).toEqual([]);

        const { groups } = gm.loadGroups();
        expect(groups[0].files).toEqual(['src/bar.ts']);
    });

    test('removeFilesFromGroup still reports notFound for genuinely absent files', () => {
        const { fm } = setupWorkspace([{
            id: 'group-1',
            name: 'Test Group',
            files: ['src/foo.ts']
        }]);

        const result = fm.removeFilesFromGroup('group-1', [path.join(tmpDir, 'src', 'missing.ts')]);

        expect(result.removed).toEqual([]);
        expect(result.notFound).toEqual([path.join(tmpDir, 'src', 'missing.ts')]);
    });
});
