import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { BookmarkManager } from '../../core/BookmarkManager';
import { GroupManager } from '../../core/GroupManager';
import { FileManager } from '../../core/FileManager';
import type { TempGroup } from '../../types';

describe('BookmarkManager URI matching', () => {
    test('finds bookmarks when the lookup URI serializes differently from the stored key', () => {
        const group: TempGroup = {
            id: 'group-1',
            name: 'Group 1',
            files: [],
            bookmarks: {
                '/workspace/project/src/bookmarked.ts': [
                    { id: 'bm-1', line: 3, label: 'Bookmark', created: 1 }
                ]
            }
        };

        const bookmarks = BookmarkManager.getBookmarksForFile(
            group,
            'file:///workspace/project/src/bookmarked.ts'
        );

        expect(bookmarks).toHaveLength(1);
        expect(bookmarks[0].label).toBe('Bookmark');
    });

    test('updates and removes bookmarks through normalized URI matching', () => {
        const group: TempGroup = {
            id: 'group-1',
            name: 'Group 1',
            files: [],
            bookmarks: {
                '/workspace/project/src/bookmarked.ts': [
                    { id: 'bm-1', line: 3, label: 'Bookmark', created: 1 }
                ]
            }
        };

        const updated = BookmarkManager.updateBookmarkInGroup(
            group,
            'file:///workspace/project/src/bookmarked.ts',
            'bm-1',
            { id: 'bm-1', line: 3, label: 'Updated', created: 1 }
        );

        expect(updated).toBe(true);
        expect(group.bookmarks?.['/workspace/project/src/bookmarked.ts'][0].label).toBe('Updated');

        const removed = BookmarkManager.removeBookmarkFromGroup(
            group,
            'file:///workspace/project/src/bookmarked.ts',
            'bm-1'
        );

        expect(removed).toBe(true);
        expect(group.bookmarks).toEqual({});
    });
});

describe('BookmarkManager.createBookmark file membership', () => {
    let tmpDir: string;

    beforeEach(() => {
        tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vt-bm-test-'));
    });

    afterEach(() => {
        fs.rmSync(tmpDir, { recursive: true, force: true });
    });

    function setupWorkspace(groups: TempGroup[]): { gm: GroupManager; fm: FileManager; bm: BookmarkManager } {
        fs.mkdirSync(path.join(tmpDir, '.vscode'), { recursive: true });
        fs.writeFileSync(path.join(tmpDir, '.vscode', 'virtualTab.json'), JSON.stringify(groups));
        const gm = new GroupManager(tmpDir);
        const fm = new FileManager(tmpDir, gm);
        return { gm, fm, bm: new BookmarkManager(gm, fm) };
    }

    test('createBookmark succeeds when the file is stored as a workspace-relative path', () => {
        const { bm } = setupWorkspace([{
            id: 'group-1',
            name: 'Test Group',
            files: ['src/foo.ts']
        }]);

        const bookmark = bm.createBookmark('group-1', path.join(tmpDir, 'src', 'foo.ts'), 0, 'My label');
        expect(bookmark.label).toBe('My label');
    });

    test('createBookmark still throws when the file is genuinely absent from the group', () => {
        const { bm } = setupWorkspace([{
            id: 'group-1',
            name: 'Test Group',
            files: ['src/foo.ts']
        }]);

        expect(() =>
            bm.createBookmark('group-1', path.join(tmpDir, 'src', 'bar.ts'), 0, 'label')
        ).toThrow('File is not in group');
    });
});
