import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { TempGroup, SortCriteria, DateGroup, VTBookmark } from './types';
import { TempFileItem, TempFolderItem, BookmarkItem } from './treeItems';
import { I18n } from './i18n';
import { FileSorter } from './sorting';
import { FileGrouper } from './grouping';
import { BookmarkManager } from './bookmarks';

// TreeDataProvider implementation
export class TempFoldersProvider implements vscode.TreeDataProvider<vscode.TreeItem> {
    private _onDidChangeTreeData: vscode.EventEmitter<vscode.TreeItem | undefined | null> = new vscode.EventEmitter();
    readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

    // In-memory group array
    public groups: TempGroup[] = [];
    private expandedGroupIds: Set<string> = new Set();
    private treeView?: vscode.TreeView<vscode.TreeItem>;

    // Debounce timer for saving groups to reduce disk I/O
    private saveDebounceTimer: ReturnType<typeof setTimeout> | undefined;

    // Flag to ignore file system events triggered by the extension itself
    private isInternalSaving: boolean = false;

    constructor(context?: vscode.ExtensionContext) {
        this.loadGroups();
        if (this.groups.length === 0) {
            this.initBuiltInGroup();
        }
    }

    // Save TreeView reference for multi-select management
    setTreeView(treeView: vscode.TreeView<vscode.TreeItem>): void {
        this.treeView = treeView;
    }

    setExpandedGroupIds(ids: string[]): void {
        this.expandedGroupIds = new Set(ids);
    }

    updateGroupExpanded(id: string, expanded: boolean): string[] {
        if (expanded) {
            this.expandedGroupIds.add(id);
        } else {
            this.expandedGroupIds.delete(id);
        }
        return Array.from(this.expandedGroupIds);
    }

    isGroupExpanded(id: string): boolean {
        return this.expandedGroupIds.has(id);
    }

    // Get currently selected file items
    getSelectedFileItems(): TempFileItem[] {
        if (!this.treeView) return [];

        // Ensure selection is an array
        const selection = this.treeView.selection || [];

        // Filter all items of type TempFileItem
        const fileItems = selection.filter((item): item is TempFileItem => item instanceof TempFileItem);

        // Log the number of selected items for debugging
        if (fileItems.length > 0) {
            console.log(`已選取 ${fileItems.length} 個檔案項目`);
        }

        return fileItems;
    }

    getSelection(): vscode.TreeItem[] {
        return this.treeView ? [...this.treeView.selection] : [];
    }

    private saveGroups() {
        // Debounce: Clear any pending save and schedule a new one
        if (this.saveDebounceTimer) {
            clearTimeout(this.saveDebounceTimer);
        }
        this.saveDebounceTimer = setTimeout(() => {
            this.saveGroupsImmediate();
        }, 500);
    }

    private saveGroupsImmediate() {
        const filePath = this.getStorageFilePath();
        if (!filePath) {
            console.warn('Cannot save VirtualTabs data: workspace root not found');
            return;
        }

        try {
            // Ensure .vscode directory exists
            const dir = path.dirname(filePath);
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }

            const storageGroups = this.toStorageGroups(this.groups);

            // Set flag to ignore the next file system event
            this.isInternalSaving = true;
            fs.writeFileSync(filePath, JSON.stringify(storageGroups, null, 2), 'utf8');

            // Reset flag after a short delay to ensure the event is captured
            setTimeout(() => {
                this.isInternalSaving = false;
            }, 500);
        } catch (error) {
            this.isInternalSaving = false;
            console.error('Failed to save VirtualTabs data file:', error);
        }
    }

    /**
     * Handle external changes to the data file
     */
    public onExternalFileChange() {
        if (this.isInternalSaving) {
            return;
        }

        console.log('VirtualTabs: Detected external change to virtualTab.json, reloading UI...');

        // Option A: Silent reload of UI
        const success = this.loadGroups();
        if (success) {
            this.refresh(false); // UI only, do NOT save back to disk to avoid overwriting user's manual edit

            // Use a persistent status bar message
            const msg = I18n.getMessage('message.configReloaded') || 'VirtualTabs: Config reloaded';
            vscode.window.showInformationMessage(msg); // Shift to notification because status bar is too subtle/volatile
        }
    }

    /**
     * Reset groups to default state (called when config file is deleted)
     */
    public resetToDefault() {
        console.log('VirtualTabs: Resetting to default state...');
        this.groups = [];
        this.initBuiltInGroup();
        this.refresh(true); // Save to recreate the config file
    }



    private loadGroups(): boolean {
        const filePath = this.getStorageFilePath();
        if (filePath && fs.existsSync(filePath)) {
            try {
                const content = fs.readFileSync(filePath, 'utf8');
                if (!content || content.trim() === '') return false;

                const saved = JSON.parse(content);
                if (this.validateGroups(saved)) {
                    this.groups = this.fromStorageGroups(this.migrateGroups(saved));
                    return true;
                } else {
                    console.error('VirtualTabs: Loaded data failed validation');
                    vscode.window.showErrorMessage(I18n.getMessage('error.invalidConfigFormat') || 'Invalid format in virtualTab.json. Please check the file structure.');
                    return false;
                }
            } catch (error) {
                console.error('Failed to load VirtualTabs data file:', error);
                vscode.window.showErrorMessage(`${I18n.getMessage('error.loadConfigFailed') || 'Failed to load virtualTab.json'}: ${error instanceof Error ? error.message : String(error)}`);
                return false;
            }
        }
        return false;
    }

    private validateGroups(data: any): data is TempGroup[] {
        if (!Array.isArray(data)) return false;

        for (let i = 0; i < data.length; i++) {
            const g = data[i];
            if (typeof g !== 'object' || g === null) return false;

            // Critical: name is required for Tree View
            if (typeof g.name !== 'string' || g.name.trim() === '') {
                console.warn(`VirtualTabs: Group at index ${i} is missing a name`);
                return false;
            }

            // files array is optional but must be array of strings if present
            if (g.files !== undefined) {
                if (!Array.isArray(g.files)) return false;
                const originalLength = g.files.length;
                const validFiles = g.files.filter((f: any) => typeof f === 'string');
                if (validFiles.length !== originalLength) {
                    console.warn(`VirtualTabs: Group "${g.name}" at index ${i} has ${originalLength - validFiles.length} invalid file entries (filtered out)`);
                }
                g.files = validFiles;
            }

            // id is optional (generated if missing), but if present must be string
            if (g.id !== undefined && typeof g.id !== 'string' && typeof g.id !== 'number') return false;

            // parentGroupId must be string if present
            if (g.parentGroupId !== undefined && g.parentGroupId !== null && typeof g.parentGroupId !== 'string') return false;
        }

        return true;
    }

    private migrateGroups(saved: TempGroup[]): TempGroup[] {
        return saved.map(group => ({
            ...group,
            bookmarks: group.bookmarks || {},
            id: group.id || Date.now().toString() + Math.random().toString(36).substring(2, 9)
        }));
    }

    private toStorageGroups(groups: TempGroup[]): TempGroup[] {
        const workspaceRoot = this.getWorkspaceRootPath();
        if (!workspaceRoot) {
            return groups;
        }

        return groups.map(group => ({
            ...group,
            files: group.files ? group.files.map(uriStr => this.toRelativePath(uriStr, workspaceRoot)) : group.files,
            bookmarks: group.bookmarks ? this.toRelativeBookmarks(group.bookmarks, workspaceRoot) : group.bookmarks
        }));
    }

    private fromStorageGroups(groups: TempGroup[]): TempGroup[] {
        const workspaceRoot = this.getWorkspaceRootPath();
        if (!workspaceRoot) {
            return groups;
        }

        return groups.map(group => ({
            ...group,
            files: group.files ? group.files.map(pathStr => this.toAbsoluteUri(pathStr, workspaceRoot)) : group.files,
            bookmarks: group.bookmarks ? this.fromStorageBookmarks(group.bookmarks, workspaceRoot) : group.bookmarks
        }));
    }

    private toRelativeBookmarks(bookmarks: Record<string, VTBookmark[]>, workspaceRoot: string): Record<string, VTBookmark[]> {
        const result: Record<string, VTBookmark[]> = {};
        for (const [fileUri, items] of Object.entries(bookmarks)) {
            const key = this.toRelativePath(fileUri, workspaceRoot);
            result[key] = items;
        }
        return result;
    }

    private fromStorageBookmarks(bookmarks: Record<string, VTBookmark[]>, workspaceRoot: string): Record<string, VTBookmark[]> {
        const result: Record<string, VTBookmark[]> = {};
        for (const [storedPath, items] of Object.entries(bookmarks)) {
            const key = this.toAbsoluteUri(storedPath, workspaceRoot);
            result[key] = items;
        }
        return result;
    }

    private toRelativePath(value: string, workspaceRoot: string): string {
        try {
            if (this.isUriString(value) && !this.isWindowsDrivePath(value)) {
                const uri = vscode.Uri.parse(value);
                if (uri.scheme !== 'file') {
                    return value;
                }
                const relativePath = path.relative(workspaceRoot, uri.fsPath);
                // Normalize to forward slashes for cross-platform compatibility and JSON safety
                return relativePath.replace(/\\/g, '/');
            }

            const absolutePath = path.isAbsolute(value)
                ? value
                : path.resolve(workspaceRoot, value);
            const relativePath = path.relative(workspaceRoot, absolutePath);
            // Normalize to forward slashes for cross-platform compatibility and JSON safety
            return relativePath.replace(/\\/g, '/');
        } catch (error) {
            console.error('Failed to convert path to relative:', error);
            return value;
        }
    }

    private toAbsoluteUri(value: string, workspaceRoot: string): string {
        try {
            if (this.isUriString(value) && !this.isWindowsDrivePath(value)) {
                return value;
            }

            const absolutePath = path.isAbsolute(value)
                ? value
                : path.resolve(workspaceRoot, value);
            return vscode.Uri.file(absolutePath).toString();
        } catch (error) {
            console.error('Failed to convert path to file URI:', error);
            return value;
        }
    }

    private isUriString(value: string): boolean {
        return /^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(value);
    }

    private isWindowsDrivePath(value: string): boolean {
        return /^[a-zA-Z]:[\\/]/.test(value);
    }

    private getStorageFilePath(): string | undefined {
        const workspaceRoot = this.getWorkspaceRootPath();
        if (!workspaceRoot) {
            return undefined;
        }
        return path.join(workspaceRoot, '.vscode', 'virtualTab.json');
    }

    private getWorkspaceRootPath(): string | undefined {
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        return workspaceFolder?.uri.fsPath;
    }

    private initBuiltInGroup() {
        // Get all open editor files
        const openUris = vscode.window.tabGroups.all
            .flatMap(g => g.tabs)
            .map(tab => (tab.input as any)?.uri as vscode.Uri)
            .filter((uri): uri is vscode.Uri => !!uri)
            .map(uri => uri.toString());
        this.groups.unshift({
            id: 'builtin_group_id', // Fixed ID for built-in group
            name: I18n.getBuiltInGroupName(),
            files: openUris,
            builtIn: true
        });
    }

    refresh(save: boolean = true): void {
        // Resync built-in group content
        const builtIn = this.groups.find(g => g.builtIn);
        if (builtIn) {
            const openUris = vscode.window.tabGroups.all
                .flatMap(g => g.tabs)
                .map(tab => (tab.input as any)?.uri as vscode.Uri)
                .filter((uri): uri is vscode.Uri => !!uri)
                .map(uri => uri.toString());
            builtIn.files = openUris;
        }

        if (save) {
            this.saveGroups();
        }
        this._onDidChangeTreeData.fire(undefined);
    }

    addGroup() {
        // Auto-generate name: New Group 1, 2, ...
        let idx = 1;
        let name = I18n.getGroupName(undefined, idx);
        while (this.groups.some(g => g.name === name)) {
            idx++;
            name = I18n.getGroupName(undefined, idx);
        }
        this.groups.push({
            id: Date.now().toString() + Math.random().toString(36).substring(2, 9),
            name,
            files: []
        });
        this.refresh();
    }

    addSubGroup(parentGroupId: string) {
        // Validation: Parent must exist (unless it's null, but view logic handles that)
        const parent = this.groups.find(g => g.id === parentGroupId);
        if (!parent) return;

        // Auto-generate name with prefix
        let idx = 1;
        let name = I18n.getGroupName(undefined, idx);
        // Scoped name check (global check is safer for simplicity)
        while (this.groups.some(g => g.name === name)) {
            idx++;
            name = I18n.getGroupName(undefined, idx);
        }

        this.groups.push({
            id: Date.now().toString() + Math.random().toString(36).substring(2, 9),
            name,
            files: [],
            parentGroupId: parentGroupId
        });
        this.refresh();
    }

    moveGroup(groupId: string, direction: 'up' | 'down') {
        const currentIndex = this.groups.findIndex(group => group.id === groupId);
        if (currentIndex < 0) return;

        const group = this.groups[currentIndex];
        if (!group || group.builtIn) return;

        const parentId = group.parentGroupId ?? null;
        const siblings = this.groups
            .map((g, idx) => ({ group: g, idx }))
            .filter(({ group: g }) => (g.parentGroupId ?? null) === parentId);

        const currentPosition = siblings.findIndex(sibling => sibling.idx === currentIndex);
        if (currentPosition < 0) return;

        const offset = direction === 'up' ? -1 : 1;
        const targetPosition = currentPosition + offset;
        if (targetPosition < 0 || targetPosition >= siblings.length) return;

        const target = siblings[targetPosition].group;
        if (target.builtIn) return;

        let insertIndex = siblings[targetPosition].idx + (direction === 'down' ? 1 : 0);
        if (insertIndex > currentIndex) {
            insertIndex -= 1;
        }

        this.groups.splice(currentIndex, 1);
        this.groups.splice(insertIndex, 0, group);
        this.refresh();
    }

    /**
     * Remove group by ID (recursive)
     * Recommended over index-based removal for nested structures
     */
    removeGroupById(id: string) {
        const group = this.groups.find(g => g.id === id);
        if (!group || group.builtIn) return;

        // 1. Find all descendants recursively
        const idsToRemove = new Set<string>();
        const collectIds = (currentId: string) => {
            idsToRemove.add(currentId);
            const children = this.groups.filter(g => g.parentGroupId === currentId);
            for (const child of children) {
                collectIds(child.id);
            }
        };
        collectIds(id);

        // 2. Filter out all collected IDs
        this.groups = this.groups.filter(g => !idsToRemove.has(g.id));
        this.refresh();
    }

    /**
     * @deprecated Use removeGroupById instead
     */
    removeGroup(idx: number) {
        // Cannot remove built-in group
        if (this.groups[idx]?.builtIn) return;

        const group = this.groups[idx];
        if (group && group.id) {
            this.removeGroupById(group.id);
        } else {
            // Fallback for limited cases
            this.groups.splice(idx, 1);
            this.refresh();
        }
    }

    addFilesToGroup(groupIdx: number, uris: string[]) {
        const group = this.groups[groupIdx];
        if (!group) return;
        if (!group.files) group.files = [];
        // Avoid duplicates
        for (const uri of uris) {
            if (!group.files.includes(uri)) {
                group.files.push(uri);
            }
        }
        this.refresh();
    }

    // One-click open all files in group (only for custom groups)
    async openAllFilesInGroup(idx: number) {
        const group = this.groups[idx];
        // Skip if built-in group
        if (!group || group.builtIn) return;

        const files = group.files || [];
        if (files.length > 0) {
            await vscode.window.withProgress({
                location: vscode.ProgressLocation.Notification,
                title: I18n.getMessage('progress.openingFiles', group.name),
                cancellable: false
            }, async (progress) => {
                const total = files.length;
                let openedCount = 0;
                const step = 100 / total;

                // 有序地開啟檔案，每次開啟後等待一小段時間
                for (const uriStr of files) {
                    try {
                        const uri = vscode.Uri.parse(uriStr);
                        await vscode.commands.executeCommand('vscode.open', uri, { preview: false });
                        openedCount++;
                        progress.report({
                            increment: step,
                            message: I18n.getMessage('progress.fileCount', openedCount.toString(), total.toString())
                        });
                        // 給系統一點時間處理
                        await new Promise(resolve => setTimeout(resolve, 100));
                    } catch (e) {
                        console.error(I18n.getMessage('error.cannotOpenFile', uriStr), e);
                    }
                }
            });
        } else {
            vscode.window.showInformationMessage(I18n.getMessage('message.noFilesToOpen', group.name));
        }
    }

    // One-click close all files in group (only for custom groups)
    async closeAllFilesInGroup(idx: number) {
        const group = this.groups[idx];
        // Skip if built-in group
        if (!group || group.builtIn) return;

        const files = group.files || [];
        if (files.length > 0) {
            // 顯示進度通知
            vscode.window.withProgress({
                location: vscode.ProgressLocation.Notification,
                title: I18n.getMessage('progress.closingFiles', group.name),
                cancellable: false
            }, async (progress) => {
                const total = files.length;
                let closedCount = 0;
                const step = 100 / total;

                // 轉換為 URI 對象

                // 找出所有已開啟的標籤頁
                const tabsToClose: vscode.Tab[] = [];
                vscode.window.tabGroups.all.forEach(tabGroup => {
                    tabGroup.tabs.forEach(tab => {
                        const tabUri = (tab.input as any)?.uri;
                        if (tabUri) {
                            const tabUriStr = tabUri.toString();
                            if (files.includes(tabUriStr)) {
                                tabsToClose.push(tab);
                            }
                        }
                    });
                });

                // 逐一關閉標籤頁，每次關閉後等待一小段時間
                for (const tab of tabsToClose) {
                    try {
                        await vscode.window.tabGroups.close(tab);
                        closedCount++;
                        progress.report({
                            increment: step,
                            message: I18n.getMessage('progress.fileCount', closedCount.toString(), tabsToClose.length.toString())
                        });
                        // 給系統一點時間處理
                        await new Promise(resolve => setTimeout(resolve, 50));
                    } catch (e) {
                        console.error(I18n.getMessage('error.cannotCloseTab'), e);
                    }
                }

            });
        } else {
            vscode.window.showInformationMessage(I18n.getMessage('message.noFilesToClose', group.name));
        }
    }

    // 開啟多個選取的檔案
    async openSelectedFiles(fileItems: TempFileItem[]) {
        if (fileItems.length === 0) return;

        // 顯示進度通知
        vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: I18n.getMessage('progress.openingSelected'),
            cancellable: false
        }, async (progress) => {
            const total = fileItems.length;
            let openedCount = 0;
            const step = 100 / total;

            // 有序地開啟檔案
            for (const item of fileItems) {
                try {
                    await vscode.commands.executeCommand('vscode.open', item.uri);
                    openedCount++;
                    progress.report({
                        increment: step,
                        message: I18n.getMessage('progress.fileCount', openedCount.toString(), total.toString())
                    });
                    // 給系統一點時間處理
                    await new Promise(resolve => setTimeout(resolve, 100));
                } catch (e) {
                    console.error(I18n.getMessage('error.cannotOpenFile', item.uri.toString()), e);
                }
            }
        });
    }

    // 關閉多個選取的檔案
    async closeSelectedFiles(fileItems: TempFileItem[]) {
        if (fileItems.length === 0) return;

        // 顯示進度通知
        vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: I18n.getMessage('progress.closingSelected'),
            cancellable: false
        }, async (progress) => {
            const total = fileItems.length;
            let closedCount = 0;
            const step = 100 / total;

            const uriStrings = fileItems.map(item => item.uri.toString());

            // 收集要關閉的標籤頁
            const tabsToClose: vscode.Tab[] = [];
            vscode.window.tabGroups.all.forEach(tabGroup => {
                tabGroup.tabs.forEach(tab => {
                    const tabUri = (tab.input as any)?.uri;
                    if (tabUri && uriStrings.includes(tabUri.toString())) {
                        tabsToClose.push(tab);
                    }
                });
            });

            // 逐一關閉標籤頁
            for (const tab of tabsToClose) {
                try {
                    await vscode.window.tabGroups.close(tab);
                    closedCount++;
                    progress.report({
                        increment: step,
                        message: I18n.getMessage('progress.fileCount', closedCount.toString(), tabsToClose.length.toString())
                    });
                    // 給系統一點時間處理
                    await new Promise(resolve => setTimeout(resolve, 50));
                } catch (e) {
                    console.error(I18n.getMessage('error.cannotCloseTab'), e);
                }
            }

        });
    }

    // 從群組中移除多個選取的檔案
    removeFilesFromGroup(groupIdx: number, fileItems: TempFileItem[]) {
        const group = this.groups[groupIdx];
        if (!group || !group.files || fileItems.length === 0) return;

        // 確保所有選取的檔案都在指定群組中
        const uriStrings = fileItems.map(item => item.uri.toString());

        // 從指定群組中移除檔案
        group.files = group.files.filter(uriStr => !uriStrings.includes(uriStr));


        this.refresh();
    }

    // 將多個選取的檔案加入到指定群組
    addMultipleFilesToGroup(groupIdx: number, fileItems: TempFileItem[]) {
        if (fileItems.length === 0) return;

        const uriStrings = fileItems.map(item => item.uri.toString());
        this.addFilesToGroup(groupIdx, uriStrings);
    }

    /**
     * Only auto-group by extension for files in the user-selected group.
     * If no group is selected, show a prompt. No longer fallback to all open files.
     */
    addAutoGroupsByExt() {
        // Only allow single group selection
        if (!this.treeView || this.treeView.selection.length !== 1 || !(this.treeView.selection[0] instanceof TempFolderItem)) {
            vscode.window.showInformationMessage(I18n.getMessage('message.pleaseSelectGroup'));
            return;
        }
        const groupIdx = (this.treeView.selection[0] as TempFolderItem).groupIdx;
        const group = this.groups[groupIdx];
        if (!group || !group.files || group.files.length === 0) {
            vscode.window.showInformationMessage(I18n.getMessage('message.noFilesToGroup'));
            return;
        }
        // Group by extension
        const extMap: Record<string, string[]> = {};
        for (const uriStr of group.files) {
            try {
                const uri = vscode.Uri.parse(uriStr);
                const ext = uri.fsPath.split('.').pop()?.toLowerCase() || 'other';
                if (!extMap[ext]) extMap[ext] = [];
                extMap[ext].push(uriStr);
            } catch { }
        }
        // Remove old auto groups (cleanup via sourceGroupId or legacy auto check)
        this.groups = this.groups.filter((g) => {
            // Keep if it's the source group itself
            if (g.id === group.id) return true;
            // Remove if it's an auto group sourced from this group
            if (g.auto && (g.sourceGroupId === group.id)) return false;
            // Legacy cleanup (optional, but safer to rely on ID now)
            return true;
        });

        // Insert auto groups at the original group position (after it)
        const newGroups = Object.entries(extMap).map(([ext, files]) => ({
            id: Date.now().toString() + Math.random().toString(36).substring(2, 9),
            name: `${I18n.getAutoGroupName(ext)} @ ${group.name}`, // Naming: .ext @ Source
            files,
            auto: true,
            sourceGroupId: group.id
        }));

        // Find fresh index of group because filtering might have shifted it
        const newGroupIdx = this.groups.findIndex(g => g.id === group.id);
        if (newGroupIdx !== -1) {
            this.groups.splice(newGroupIdx + 1, 0, ...newGroups);
        }
        this.refresh();
    }

    /**
     * Set sort preference for a group
     * @param groupIdx Group index
     * @param criteria Sort criteria
     * @param order Sort order (ascending or descending)
     */
    setSortPreference(groupIdx: number, criteria: SortCriteria, order: 'asc' | 'desc' = 'asc') {
        const group = this.groups[groupIdx];
        if (!group) return;

        group.sortBy = criteria;
        group.sortOrder = order;
        this.refresh();
    }

    /**
     * Auto-group files by modified date
     * Only works on user-selected group
     */
    autoGroupByModifiedDate() {
        // Only allow single group selection
        if (!this.treeView || this.treeView.selection.length !== 1 || !(this.treeView.selection[0] instanceof TempFolderItem)) {
            vscode.window.showInformationMessage(I18n.getMessage('message.pleaseSelectGroup'));
            return;
        }

        const groupIdx = (this.treeView.selection[0] as TempFolderItem).groupIdx;
        const group = this.groups[groupIdx];

        if (!group || !group.files || group.files.length === 0) {
            vscode.window.showInformationMessage(I18n.getMessage('message.noFilesToGroup'));
            return;
        }

        // Group by modified date
        const dateGroups = FileGrouper.groupByModifiedDate(group.files);

        // Remove old auto groups related to this source group
        this.groups = this.groups.filter((g) => {
            if (g.id === group.id) return true;
            if (g.auto && (g.sourceGroupId === group.id)) return false;
            return true;
        });

        // Create new date-based groups
        const newGroups: TempGroup[] = [];
        const dateOrder: DateGroup[] = ['today', 'yesterday', 'thisWeek', 'lastWeek', 'thisMonth', 'older'];

        for (const dateGroup of dateOrder) {
            const files = dateGroups.get(dateGroup);
            if (files && files.length > 0) {
                newGroups.push({
                    id: Date.now().toString() + Math.random().toString(36).substring(2, 9),
                    name: `${I18n.getMessage('group.autoGroupPrefix')} ${FileGrouper.getDateGroupLabel(dateGroup, I18n)} @ ${group.name}`, // Naming: [Auto] Label @ Source
                    files,
                    auto: true,
                    autoGroupType: 'modifiedDate',
                    sourceGroupId: group.id
                    // Removed parentGroupId to make it sibling
                });
            }
        }

        // Find fresh index
        const newGroupIdx = this.groups.findIndex(g => g.id === group.id);
        if (newGroupIdx !== -1) {
            this.groups.splice(newGroupIdx + 1, 0, ...newGroups);
        }

        this.refresh();
    }

    getTreeItem(element: vscode.TreeItem): vscode.TreeItem {
        return element;
    }

    getChildren(element?: vscode.TreeItem): vscode.ProviderResult<vscode.TreeItem[]> {
        if (!element) {
            // Root Level: Show top-level groups (no parentGroupId)
            return this.groups
                .map((g, idx) => ({ group: g, idx })) // Map to preserve original index
                .filter(({ group }) => !group.parentGroupId)
                .map(({ group, idx }) => {
                    const item = new TempFolderItem(group.name, idx, group.id, group.builtIn);
                    item.collapsibleState = this.isGroupExpanded(group.id)
                        ? vscode.TreeItemCollapsibleState.Expanded
                        : vscode.TreeItemCollapsibleState.Collapsed;
                    return item;
                });
        }

        // Expanded Group Node: Show Sub-groups AND Files
        if (element instanceof TempFolderItem) {
            const group = this.groups[element.groupIdx];
            // Safety check: index might be stale if groups array shifted, but for now we rely on refresh() keeping it consistent.
            // Ideally should find group by ID, but that requires O(N) search or Map.
            // Since we rebuild tree on every refresh, index is generally safe *within* a render cycle.

            if (!group) return [];

            const items: vscode.TreeItem[] = [];

            // 1. Sub-groups
            const subGroups = this.groups
                .map((g, idx) => ({ group: g, idx }))
                .filter(({ group: g }) => g.parentGroupId === element.groupId); // Compare with parent's ID

            items.push(...subGroups.map(({ group: g, idx }) =>
                (() => {
                    const item = new TempFolderItem(g.name, idx, g.id, g.builtIn, true); // Mark as sub-group
                    item.collapsibleState = this.isGroupExpanded(g.id)
                        ? vscode.TreeItemCollapsibleState.Expanded
                        : vscode.TreeItemCollapsibleState.Collapsed;
                    return item;
                })()
            ));

            // 2. Files
            if (group.files && group.files.length > 0) {
                // Apply sorting before rendering
                const sortedFiles = FileSorter.sortFiles(
                    group.files,
                    group.sortBy || 'none',
                    group.sortOrder || 'asc'
                );

                const fileItems = sortedFiles.map(uriStr => {
                    const uri = vscode.Uri.parse(uriStr);
                    const fileItem = new TempFileItem(uri, element.groupIdx, group.builtIn);

                    // Check if file has bookmarks (v0.2.0)
                    const bookmarks = BookmarkManager.getBookmarksForFile(group, uriStr);
                    if (bookmarks.length > 0) {
                        // Set file as expandable if it has bookmarks
                        fileItem.collapsibleState = vscode.TreeItemCollapsibleState.Collapsed;
                    }

                    return fileItem;
                });

                items.push(...fileItems);
            }

            return items;
        }

        // 若是檔案節點，顯示書籤 (v0.2.0)
        if (element instanceof TempFileItem) {
            const group = this.groups[element.groupIdx];
            const bookmarks = BookmarkManager.getBookmarksForFile(
                group,
                element.uri.toString()
            );

            return bookmarks.map(bookmark =>
                new BookmarkItem(bookmark, element.uri, element.groupIdx)
            );
        }

        return [];
    }
}
