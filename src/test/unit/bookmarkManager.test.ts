import { BookmarkManager } from '../../core/BookmarkManager';
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
