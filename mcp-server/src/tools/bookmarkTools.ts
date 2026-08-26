import { BookmarkManager } from '../managers/BookmarkManager.js';
import { ErrorType, ToolResponse, BookmarkInfo } from '../types.js';
import { Logger } from '../utils/Logger.js';

export class BookmarkTools {
  constructor(private bookmarkManager: BookmarkManager) {}

  /**
   * Create a bookmark
   */
  async createBookmark(args: {
    groupId: string,
    filePath: string,
    line: number,
    label: string,
    description?: string
  }): Promise<ToolResponse<{
    id: string,
    groupId: string,
    filePath: string,
    line: number,
    label: string,
    description?: string,
    created: number
  }>> {
    try {
      const { groupId, filePath, line, label, description } = args;

      if (!groupId || !filePath || typeof line !== 'number' || !label) {
        return Logger.createError(ErrorType.VALIDATION_ERROR, 'Arguments groupId, filePath, line, and label are all required with correct types');
      }

      const bookmark = this.bookmarkManager.createBookmark(groupId, filePath, line, label, description);

      return Logger.createSuccess({
        id: bookmark.id,
        groupId,
        filePath,
        line: bookmark.line,
        label: bookmark.label,
        description: bookmark.description,
        created: bookmark.created
      }, `Successfully created bookmark: ${label}`);
    } catch (error) {
      Logger.logError('create_bookmark', error);
      const errMsg = error instanceof Error ? error.message : String(error);
      
      if (errMsg.includes('does not exist')) {
        return Logger.createError(ErrorType.NOT_FOUND, errMsg);
      }
      if (errMsg.includes('not in group') || errMsg.includes('must be a non-negative integer') || errMsg.includes('must not be empty')) {
        return Logger.createError(ErrorType.VALIDATION_ERROR, errMsg);
      }
      return Logger.createError(ErrorType.INTERNAL_ERROR, `Failed to create bookmark: ${errMsg}`);
    }
  }

  /**
   * Delete a bookmark
   */
  async deleteBookmark(args: { bookmarkId: string }): Promise<ToolResponse<{ id: string, deleted: boolean }>> {
    try {
      if (!args.bookmarkId) {
        return Logger.createError(ErrorType.VALIDATION_ERROR, 'bookmarkId is a required parameter');
      }

      const deleted = this.bookmarkManager.deleteBookmark(args.bookmarkId);
      
      if (!deleted) {
        return Logger.createError(ErrorType.NOT_FOUND, `Bookmark ID not found: ${args.bookmarkId}`);
      }

      return Logger.createSuccess({
        id: args.bookmarkId,
        deleted: true
      }, 'Successfully deleted bookmark');
    } catch (error) {
      Logger.logError('delete_bookmark', error);
      return Logger.createError(ErrorType.INTERNAL_ERROR, `Failed to delete bookmark: ${error}`);
    }
  }

  /**
   * List bookmarks
   */
  async listBookmarks(args: { groupId?: string }): Promise<ToolResponse<{ bookmarks: BookmarkInfo[], count: number }>> {
    try {
      const { groupId } = args;
      const bookmarks = this.bookmarkManager.listBookmarks(groupId);

      return Logger.createSuccess({
        bookmarks,
        count: bookmarks.length
      }, `Found ${bookmarks.length} bookmark(s)`);
    } catch (error) {
      Logger.logError('list_bookmarks', error);
      return Logger.createError(ErrorType.INTERNAL_ERROR, `Failed to list bookmarks: ${error}`);
    }
  }
}
