/**
 * Unit test: AutoGrouper.groupByExtension() / groupByDate() must move each
 * file's bookmarks to the newly created sub-group instead of leaving them
 * orphaned on the (now empty) source group.
 */

import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { GroupManager } from '../../core/GroupManager';
import { FileManager } from '../../core/FileManager';
import { AutoGrouper } from '../../core/AutoGrouper';
import type { TempGroup, VTBookmark } from '../../types';

function makeTempWorkspace(): string {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'vt-autogroup-test-'));
    fs.mkdirSync(path.join(dir, '.vscode'));
    return dir;
}

function writeConfig(dir: string, groups: TempGroup[]): void {
    fs.writeFileSync(
        path.join(dir, '.vscode', 'virtualTab.json'),
        JSON.stringify(groups, null, 2),
        'utf8'
    );
}

function makeBookmark(): VTBookmark {
    return { id: 'bm-1', line: 0, label: 'Test Bookmark', created: Date.now() };
}

describe('AutoGrouper — bookmark migration on auto-grouping', () => {
    let tmpDir: string;
    let groupManager: GroupManager;
    let fileManager: FileManager;
    let autoGrouper: AutoGrouper;

    beforeEach(() => {
        tmpDir = makeTempWorkspace();
        groupManager = new GroupManager(tmpDir);
        fileManager = new FileManager(tmpDir, groupManager);
        autoGrouper = new AutoGrouper(groupManager, fileManager);
    });

    afterEach(() => {
        fs.rmSync(tmpDir, { recursive: true, force: true });
    });

    test('groupByExtension moves bookmarks to the new sub-group and clears the source', () => {
        const tsUri = fileManager.toFileUri(path.join(tmpDir, 'a.ts'));
        const jsonUri = fileManager.toFileUri(path.join(tmpDir, 'b.json'));

        writeConfig(tmpDir, [{
            id: 'g1',
            name: 'Mixed',
            files: [tsUri, jsonUri],
            bookmarks: { [tsUri]: [makeBookmark()] }
        }]);

        const result = autoGrouper.groupByExtension('g1');
        expect(result.created).toBe(2);

        const { groups } = groupManager.loadGroups();
        const source = groups.find(g => g.id === 'g1')!;
        const tsGroup = groups.find(g => g.autoGroupType === 'extension' && g.files?.includes(tsUri))!;
        const jsonGroup = groups.find(g => g.autoGroupType === 'extension' && g.files?.includes(jsonUri))!;

        expect(source.bookmarks).toBeUndefined();
        expect(tsGroup.bookmarks?.[tsUri]).toHaveLength(1);
        expect(jsonGroup.bookmarks).toBeUndefined();
    });

    test('groupByDate moves bookmarks to the new sub-group and clears the source', () => {
        const fileUri = fileManager.toFileUri(path.join(tmpDir, 'missing-file.ts'));

        writeConfig(tmpDir, [{
            id: 'g1',
            name: 'Dated',
            files: [fileUri],
            bookmarks: { [fileUri]: [makeBookmark()] }
        }]);

        const result = autoGrouper.groupByDate('g1');
        expect(result.created).toBe(1);

        const { groups } = groupManager.loadGroups();
        const source = groups.find(g => g.id === 'g1')!;
        const dateGroup = groups.find(g => g.autoGroupType === 'modifiedDate')!;

        expect(source.bookmarks).toBeUndefined();
        expect(dateGroup.bookmarks?.[fileUri]).toHaveLength(1);
    });

    test('groupByExtension moves bookmarks even when the stored key differs in encoding from the file URI', () => {
        // Mirrors dragAndDrop.ts: the bookmark key on disk can be a raw fs path
        // while group.files stores the file:// URI form of the same file.
        const tsPath = path.join(tmpDir, 'a.ts');
        const tsUri = fileManager.toFileUri(tsPath);

        writeConfig(tmpDir, [{
            id: 'g1',
            name: 'Mixed',
            files: [tsUri],
            bookmarks: { [tsPath]: [makeBookmark()] }
        }]);

        const result = autoGrouper.groupByExtension('g1');
        expect(result.created).toBe(1);

        const { groups } = groupManager.loadGroups();
        const source = groups.find(g => g.id === 'g1')!;
        const tsGroup = groups.find(g => g.autoGroupType === 'extension' && g.files?.includes(tsUri))!;

        expect(source.bookmarks).toBeUndefined();
        expect(tsGroup.bookmarks?.[tsPath]).toHaveLength(1);
    });

    test('groupByExtension leaves source untouched when it has no bookmarks', () => {
        const tsUri = fileManager.toFileUri(path.join(tmpDir, 'a.ts'));

        writeConfig(tmpDir, [{
            id: 'g1',
            name: 'NoBookmarks',
            files: [tsUri]
        }]);

        autoGrouper.groupByExtension('g1');

        const { groups } = groupManager.loadGroups();
        const tsGroup = groups.find(g => g.autoGroupType === 'extension')!;
        expect(tsGroup.bookmarks).toBeUndefined();
    });
});

export {};
