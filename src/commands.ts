import * as vscode from 'vscode';
import { TempFoldersProvider } from './provider';
import { TempFileItem, TempFolderItem, BookmarkItem } from './treeItems';
import { I18n } from './i18n';
import { BookmarkManager } from './bookmarks';
import { TempGroup } from './types';

// Global clipboard for VirtualTabs items
let globalClipboardItems: (TempFileItem | TempFolderItem)[] = [];

type FileCommandTarget = TempFileItem | vscode.Uri | { resourceUri?: vscode.Uri } | undefined;
type ShellKind = 'powershell' | 'cmd' | 'posix' | 'other';

let execTerminal: vscode.Terminal | undefined;

function getFileUri(target: FileCommandTarget): vscode.Uri | undefined {
    if (!target) {
        return undefined;
    }
    if (target instanceof vscode.Uri) {
        return target;
    }
    if (target instanceof TempFileItem) {
        return target.uri;
    }
    if (typeof target === 'object' && target && 'resourceUri' in target && target.resourceUri instanceof vscode.Uri) {
        return target.resourceUri;
    }
    return undefined;
}

function isExecutableExtension(uri: vscode.Uri): boolean {
    const path = require('path');
    const ext = path.extname(uri.fsPath).toLowerCase();
    return ext === '.bat' || ext === '.exe';
}

function getExecutionCwd(uri: vscode.Uri): string {
    const folder = vscode.workspace.getWorkspaceFolder(uri);
    if (folder) {
        return folder.uri.fsPath;
    }
    const firstFolder = vscode.workspace.workspaceFolders?.[0];
    if (firstFolder) {
        return firstFolder.uri.fsPath;
    }
    const path = require('path');
    return path.dirname(uri.fsPath);
}

function normalizeShellKind(shellId: string): ShellKind {
    switch (shellId) {
        case 'pwsh':
        case 'powershell':
            return 'powershell';
        case 'cmd':
            return 'cmd';
        case 'bash':
        case 'sh':
        case 'zsh':
        case 'fish':
        case 'gitbash':
        case 'ksh':
        case 'csh':
        case 'wsl':
            return 'posix';
        default:
            return 'other';
    }
}

function detectShellKindFromPath(shellPath?: string): ShellKind {
    if (!shellPath) {
        return 'other';
    }
    const path = require('path');
    const name = path.basename(shellPath).toLowerCase();
    if (name.includes('pwsh') || name.includes('powershell')) {
        return 'powershell';
    }
    if (name === 'cmd.exe' || name === 'cmd') {
        return 'cmd';
    }
    if (name.includes('bash') || name.includes('zsh') || name.includes('sh') || name.includes('fish')) {
        return 'posix';
    }
    return 'other';
}

function getShellKind(terminal?: vscode.Terminal): ShellKind {
    if (terminal?.state?.shell) {
        return normalizeShellKind(terminal.state.shell);
    }
    return detectShellKindFromPath(vscode.env.shell);
}

/**
 * Shell Command Quoting Functions
 * 
 * IMPLEMENTATION NOTE:
 * These functions manually construct shell command strings with proper quoting for different shells.
 * 
 * VS Code Native Approach:
 * - VS Code's built-in run buttons use `vscode.ShellExecution(command, args[])` 
 * - Arguments are passed as an array, avoiding string concatenation
 * - VS Code handles shell-specific quoting automatically via `vscode.ShellQuotedString`
 * 
 * Our Current Implementation:
 * - Manual string construction with shell-specific quoting rules
 * - Simpler and more direct for our use case (executing local workspace files)
 * - Adequate for paths within user's trusted workspace
 * 
 * Risk Assessment:
 * - Security risk: LOW (user can only execute files they already control in their workspace)
 * - Maintenance risk: MEDIUM (manual quoting requires shell-specific knowledge)
 * 
 * Future Consideration:
 * If we need to support user-provided arguments (not just file paths), consider migrating to:
 * ```typescript
 * const execution = new vscode.ShellExecution(filePath, [], { cwd });
 * const terminal = vscode.window.createTerminal({ shellPath, shellArgs });
 * terminal.sendText(execution.commandLine);
 * ```
 */

function quoteCmd(value: string): string {
    return `"${value.replace(/"/g, '""')}"`;
}

function quotePowerShell(value: string): string {
    return `'${value.replace(/'/g, "''")}'`;
}

function quotePosix(value: string): string {
    if (!value) {
        return "''";
    }
    return `'${value.replace(/'/g, "'\\''")}'`;
}

function buildExecutionCommand(filePath: string, cwd: string, shellKind: ShellKind): string {
    switch (shellKind) {
        case 'cmd':
            return `cd /d ${quoteCmd(cwd)} & ${quoteCmd(filePath)}`;
        case 'powershell':
            return `Set-Location -Path ${quotePowerShell(cwd)}; & ${quotePowerShell(filePath)}`;
        case 'posix':
            return `cd ${quotePosix(cwd)}; ${quotePosix(filePath)}`;
        default:
            return `cd ${quotePosix(cwd)}; ${quotePosix(filePath)}`;
    }
}

function getExecTerminal(cwd: string): vscode.Terminal {
    if (execTerminal) {
        return execTerminal;
    }
    execTerminal = vscode.window.createTerminal({
        name: 'Virtual Tabs Run',
        cwd
    });
    return execTerminal;
}

async function runFileInTerminal(uri: vscode.Uri): Promise<void> {
    const cwd = getExecutionCwd(uri);
    const terminal = getExecTerminal(cwd);
    const shellKind = getShellKind(terminal);
    const commandLine = buildExecutionCommand(uri.fsPath, cwd, shellKind);

    terminal.show(true);
    if (terminal.shellIntegration) {
        terminal.shellIntegration.executeCommand(commandLine);
    } else {
        terminal.sendText(commandLine, true);
    }
}

async function openFileInEditor(uri: vscode.Uri): Promise<void> {
    await vscode.commands.executeCommand('vscode.open', uri);
}

async function openFileDefault(uri: vscode.Uri): Promise<void> {
    if (isExecutableExtension(uri)) {
        await runFileInTerminal(uri);
        return;
    }
    await openFileInEditor(uri);
}

/**
 * Get all files from a group and its child groups (recursive)
 */
function getAllFilesInGroupRecursive(groups: TempGroup[], groupId: string): string[] {
    const allFiles: string[] = [];

    const collectFiles = (gId: string) => {
        const group = groups.find(g => g.id === gId);
        if (group && group.files) {
            allFiles.push(...group.files);
        }
        // Find child groups
        const children = groups.filter(g => g.parentGroupId === gId);
        for (const child of children) {
            collectFiles(child.id);
        }
    };

    collectFiles(groupId);
    return allFiles;
}

// VirtualTabs command registration
export function registerCommands(context: vscode.ExtensionContext, provider: TempFoldersProvider): void {
    // Run executable file in terminal (explicit action via inline button)
    context.subscriptions.push(vscode.commands.registerCommand('virtualTabs.runFile', async (target?: FileCommandTarget) => {
        const uri = getFileUri(target);
        if (!uri) {
            return;
        }
        await runFileInTerminal(uri);
    }));

    context.subscriptions.push(vscode.window.onDidCloseTerminal((terminal) => {
        if (terminal === execTerminal) {
            execTerminal = undefined;
        }
    }));

    // Register add group command
    context.subscriptions.push(vscode.commands.registerCommand('virtualTabs.addGroup', () => {
        provider.addGroup();
    }));

    // Register add sub-group command
    context.subscriptions.push(vscode.commands.registerCommand('virtualTabs.addSubGroup', (item: TempFolderItem) => {
        if (item && item.groupId) {
            provider.addSubGroup(item.groupId);
        }
    }));

    context.subscriptions.push(vscode.commands.registerCommand('virtualTabs.moveGroupUp', (item: TempFolderItem) => {
        if (item && item.groupId) {
            provider.moveGroup(item.groupId, 'up');
        }
    }));

    context.subscriptions.push(vscode.commands.registerCommand('virtualTabs.moveGroupDown', (item: TempFolderItem) => {
        if (item && item.groupId) {
            provider.moveGroup(item.groupId, 'down');
        }
    }));

    // Register remove group command (supports multi-select)
    context.subscriptions.push(vscode.commands.registerCommand('virtualTabs.removeGroup', async (item: TempFolderItem, selectedItems?: TempFolderItem[]) => {
        // Check if multiple groups are selected
        const itemsToRemove: TempFolderItem[] = [];

        if (selectedItems && selectedItems.length > 1) {
            // Multi-select: use all selected items
            itemsToRemove.push(...selectedItems.filter(i => i instanceof TempFolderItem));
        } else if (item instanceof TempFolderItem) {
            // Single select
            itemsToRemove.push(item);
        }

        if (itemsToRemove.length === 0) return;

        // Check user preference for confirmation
        const config = vscode.workspace.getConfiguration('virtualTabs');
        const confirmBeforeDelete = config.get<boolean>('confirmBeforeDelete', true);

        const executeDelete = () => {
            for (const groupItem of itemsToRemove) {
                if (groupItem.groupId) {
                    provider.removeGroupById(groupItem.groupId);
                } else if (typeof groupItem.groupIdx === 'number') {
                    provider.removeGroup(groupItem.groupIdx);
                }
            }
        };

        // Show confirmation dialog if enabled
        if (confirmBeforeDelete) {
            const groupLabel = typeof itemsToRemove[0].label === 'string'
                ? itemsToRemove[0].label
                : (itemsToRemove[0].label?.label || '');

            const message = itemsToRemove.length > 1
                ? I18n.getMessage('confirm.deleteGroups', itemsToRemove.length.toString())
                : I18n.getMessage('confirm.deleteGroup', groupLabel);

            const choice = await vscode.window.showWarningMessage(
                message,
                { modal: true },
                I18n.getMessage('confirm.delete')
            );

            if (choice === I18n.getMessage('confirm.delete')) {
                executeDelete();
            }
        } else {
            // No confirmation needed, delete directly
            executeDelete();
        }
    }));

    // Register auto group by extension command
    context.subscriptions.push(vscode.commands.registerCommand('virtualTabs.autoGroupByExt', () => {
        provider.addAutoGroupsByExt();
    }));

    // One-click open group command (only for custom groups)
    context.subscriptions.push(vscode.commands.registerCommand('virtualTabs.openAllFiles', async (item: TempFolderItem) => {
        if (typeof item?.groupIdx === 'number') {
            // Check if it is a built-in group, if so, do not execute
            const group = provider.groups[item.groupIdx];
            if (group?.builtIn) {
                vscode.window.showInformationMessage(I18n.getMessage('message.builtInGroupNotSupported'));
                return;
            }
            await provider.openAllFilesInGroup(item.groupIdx);
        }
    }));

    // One-click close group command (only for custom groups)
    context.subscriptions.push(vscode.commands.registerCommand('virtualTabs.closeAllFiles', async (item: TempFolderItem) => {
        if (typeof item?.groupIdx === 'number') {
            // Check if it is a built-in group, if so, do not execute
            const group = provider.groups[item.groupIdx];
            if (group?.builtIn) {
                vscode.window.showInformationMessage(I18n.getMessage('message.builtInGroupNotSupported'));
                return;
            }
            await provider.closeAllFilesInGroup(item.groupIdx);
        }
    }));

    // Group duplication
    context.subscriptions.push(vscode.commands.registerCommand('virtualTabs.duplicateGroup', (item: TempFolderItem) => {
        if (typeof item?.groupIdx !== 'number') return;
        const group = provider.groups[item.groupIdx];
        if (!group || group.builtIn) return;

        // Generate new name
        let base = group.name.replace(/\s*Copy( \d+)?$/, '');
        let idx = 1;
        let newName = I18n.getCopyGroupName(base);
        while (provider.groups.some(g => g.name === newName)) {
            idx++;
            newName = I18n.getCopyGroupName(base, idx);
        }

        // Duplicate group
        provider.groups.push({
            id: Date.now().toString() + Math.random().toString(36).substring(2, 9),
            name: newName,
            files: group.files ? [...group.files] : []
        });
        provider.refresh();
    }));

    // Group rename
    context.subscriptions.push(vscode.commands.registerCommand('virtualTabs.renameGroup', async (item: TempFolderItem) => {
        if (typeof item?.groupIdx !== 'number') return;
        const group = provider.groups[item.groupIdx];
        if (!group || group.builtIn) return;

        const newName = await vscode.window.showInputBox({
            prompt: I18n.getMessage('input.groupNamePrompt'),
            value: group.name,
            validateInput: (val) => {
                if (!val.trim()) return I18n.getMessage('input.groupNameError.empty');
                return null;
            }
        });

        if (newName && newName !== group.name) {
            group.name = newName;
            provider.refresh();
        }
    }));

    // File right-click "delete" is changed to remove from group
    context.subscriptions.push(vscode.commands.registerCommand('deleteFile', async (item: TempFileItem, selectedItems?: TempFileItem[]) => {
        // Handle calls from browser or file explorer, forward to original command
        if (!(item instanceof TempFileItem)) {
            vscode.commands.executeCommand('workbench.action.files.delete');
            return;
        }

        // Check if multiple files are selected
        const allSelectedItems = provider.getSelectedFileItems();
        const filesToRemove = allSelectedItems.length > 1 ? allSelectedItems : [item];

        // Check user preference for confirmation
        const config = vscode.workspace.getConfiguration('virtualTabs');
        const confirmBeforeDelete = config.get<boolean>('confirmBeforeDelete', true);

        const executeDelete = () => {
            if (filesToRemove.length > 1) {
                provider.removeFilesFromGroup(item.groupIdx, filesToRemove);
            } else {
                const group = provider.groups[item.groupIdx];
                if (!group || !group.files) return;
                group.files = group.files.filter(uri => uri !== item.uri.toString());
                provider.refresh();
            }
        };

        // Show confirmation dialog if enabled
        if (confirmBeforeDelete) {
            const message = filesToRemove.length > 1
                ? I18n.getMessage('confirm.deleteFiles', filesToRemove.length.toString())
                : I18n.getMessage('confirm.deleteFile', vscode.workspace.asRelativePath(item.uri));

            const choice = await vscode.window.showWarningMessage(
                message,
                { modal: true },
                I18n.getMessage('confirm.delete')
            );

            if (choice === I18n.getMessage('confirm.delete')) {
                executeDelete();
            }
        } else {
            // No confirmation needed, delete directly
            executeDelete();
        }
    }));

    // Handle opening multiple selected files
    context.subscriptions.push(vscode.commands.registerCommand('virtualTabs.openSelectedFiles', async () => {
        const selectedItems = provider.getSelectedFileItems();
        if (selectedItems.length === 0) return;

        await provider.openSelectedFiles(selectedItems);
    }));

    // Handle closing multiple selected files
    context.subscriptions.push(vscode.commands.registerCommand('virtualTabs.closeSelectedFiles', async () => {
        const selectedItems = provider.getSelectedFileItems();
        if (selectedItems.length === 0) return;

        await provider.closeSelectedFiles(selectedItems);
    }));
    // Handle removing multiple selected files from group
    context.subscriptions.push(vscode.commands.registerCommand('virtualTabs.removeSelectedFilesFromGroup', (item: TempFileItem) => {
        const selectedItems = provider.getSelectedFileItems();
        if (selectedItems.length === 0) return;

        // If no specific item is provided or item is not TempFileItem, use the first selected item
        const fileItem = (item instanceof TempFileItem) ? item : selectedItems[0];

        // Use the group index of the file item directly
        provider.removeFilesFromGroup(fileItem.groupIdx, selectedItems);
    }));

    // Group context menu "Add selected files to group"
    context.subscriptions.push(vscode.commands.registerCommand('virtualTabs.addSelectedFilesToGroup', (item: TempFolderItem) => {
        if (typeof item?.groupIdx !== 'number') return;

        const selectedItems = provider.getSelectedFileItems();
        if (selectedItems.length === 0) return;

        provider.addMultipleFilesToGroup(item.groupIdx, selectedItems);
    }));

    // Copy file name command (works for both files and groups)
    context.subscriptions.push(vscode.commands.registerCommand('virtualTabs.copyFileName', async (item: TempFileItem | TempFolderItem) => {
        const path = require('path');

        if (item instanceof TempFileItem) {
            // Single file: copy file name
            const fileName = path.basename(item.uri.fsPath);
            await vscode.env.clipboard.writeText(fileName);
            vscode.window.showInformationMessage(`Copied: ${fileName}`);
        } else if (item && 'groupIdx' in item && typeof item.groupIdx === 'number') {
            // Group: copy all file names (including children)
            const group = provider.groups[item.groupIdx];
            if (!group || !group.id) {
                vscode.window.showInformationMessage('No files in group.');
                return;
            }
            const allFiles = getAllFilesInGroupRecursive(provider.groups, group.id);
            if (allFiles.length === 0) {
                vscode.window.showInformationMessage('No files in group.');
                return;
            }
            const fileNames = allFiles.map(uriStr => {
                try {
                    const uri = vscode.Uri.parse(uriStr);
                    return path.basename(uri.fsPath);
                } catch {
                    return uriStr;
                }
            });
            await vscode.env.clipboard.writeText(fileNames.join('\n'));
            vscode.window.showInformationMessage(`Copied ${fileNames.length} file names.`);
        }
    }));

    // Copy relative path command (works for both files and groups)
    context.subscriptions.push(vscode.commands.registerCommand('virtualTabs.copyRelativePath', async (item: TempFileItem | TempFolderItem) => {
        if (item instanceof TempFileItem) {
            // Single file: copy relative path
            const relativePath = vscode.workspace.asRelativePath(item.uri);
            await vscode.env.clipboard.writeText(relativePath);
            vscode.window.showInformationMessage(`Copied: ${relativePath}`);
        } else if (item && 'groupIdx' in item && typeof item.groupIdx === 'number') {
            // Group: copy all relative paths (including children)
            const group = provider.groups[item.groupIdx];
            if (!group || !group.id) {
                vscode.window.showInformationMessage('No files in group.');
                return;
            }
            const allFiles = getAllFilesInGroupRecursive(provider.groups, group.id);
            if (allFiles.length === 0) {
                vscode.window.showInformationMessage('No files in group.');
                return;
            }
            const paths = allFiles.map(uriStr => {
                try {
                    return vscode.workspace.asRelativePath(vscode.Uri.parse(uriStr));
                } catch {
                    return uriStr;
                }
            });
            await vscode.env.clipboard.writeText(paths.join('\n'));
            vscode.window.showInformationMessage(`Copied ${paths.length} relative paths.`);
        }
    }));

    // Copy absolute path command (works for both files and groups)
    context.subscriptions.push(vscode.commands.registerCommand('virtualTabs.copyAbsolutePath', async (item: TempFileItem | TempFolderItem) => {
        if (item instanceof TempFileItem) {
            // Single file: copy absolute path
            const absolutePath = item.uri.fsPath;
            await vscode.env.clipboard.writeText(absolutePath);
            vscode.window.showInformationMessage(`Copied: ${absolutePath}`);
        } else if (item && 'groupIdx' in item && typeof item.groupIdx === 'number') {
            // Group: copy all absolute paths (including children)
            const group = provider.groups[item.groupIdx];
            if (!group || !group.id) {
                vscode.window.showInformationMessage('No files in group.');
                return;
            }
            const allFiles = getAllFilesInGroupRecursive(provider.groups, group.id);
            if (allFiles.length === 0) {
                vscode.window.showInformationMessage('No files in group.');
                return;
            }
            const paths = allFiles.map(uriStr => {
                try {
                    return vscode.Uri.parse(uriStr).fsPath;
                } catch {
                    return uriStr;
                }
            });
            await vscode.env.clipboard.writeText(paths.join('\n'));
            vscode.window.showInformationMessage(`Copied ${paths.length} absolute paths.`);
        }
    }));

    // Duplicate built-in group
    context.subscriptions.push(vscode.commands.registerCommand('virtualTabs.duplicateBuiltInGroup', (item: TempFolderItem) => {
        if (typeof item?.groupIdx !== 'number') return;
        const group = provider.groups[item.groupIdx];
        if (!group || !group.builtIn) return;

        // Generate new name
        let base = I18n.getBuiltInGroupName();
        let idx = 1;
        let newName = I18n.getCopyGroupName(base);
        while (provider.groups.some(g => g.name === newName)) {
            idx++;
            newName = I18n.getCopyGroupName(base, idx);
        }

        provider.groups.push({
            id: Date.now().toString() + Math.random().toString(36).substring(2, 9),
            name: newName,
            files: group.files ? [...group.files] : []
        });
        provider.refresh();
    }));

    // Refresh built-in group
    context.subscriptions.push(vscode.commands.registerCommand('virtualTabs.refreshBuiltInGroup', (item: TempFolderItem) => {
        if (typeof item?.groupIdx !== 'number') return;
        const group = provider.groups[item.groupIdx];
        if (!group || !group.builtIn) return;
        provider.refresh();
    }));

    // Remove single file from group
    context.subscriptions.push(vscode.commands.registerCommand('virtualTabs.removeFileFromGroup', async (item: TempFileItem, selectedItems?: TempFileItem[]) => {
        const filesToRemove = (selectedItems && Array.isArray(selectedItems) && selectedItems.length > 0)
            ? selectedItems
            : (item ? [item] : []);

        if (filesToRemove.length === 0) return;

        // Check user preference for confirmation
        const config = vscode.workspace.getConfiguration('virtualTabs');
        const confirmBeforeDelete = config.get<boolean>('confirmBeforeDelete', true);

        const executeRemove = () => {
            let hasChanges = false;

            for (const fileItem of filesToRemove) {
                if (!(fileItem instanceof TempFileItem)) continue;

                const groupIdx = fileItem.groupIdx;
                const group = provider.groups[groupIdx];

                if (group && group.files) {
                    const fileUri = fileItem.uri.toString();
                    const originalLength = group.files.length;
                    group.files = group.files.filter(uri => uri !== fileUri);

                    if (group.files.length < originalLength) {
                        hasChanges = true;
                        // Remove associated bookmarks
                        if (group.bookmarks && group.bookmarks[fileUri]) {
                            delete group.bookmarks[fileUri];
                            if (Object.keys(group.bookmarks).length === 0) {
                                delete group.bookmarks;
                            }
                        }
                    }
                }
            }

            if (hasChanges) {
                provider.refresh();
            }
        };

        // Show confirmation dialog if enabled
        if (confirmBeforeDelete) {
            const message = filesToRemove.length > 1
                ? I18n.getMessage('confirm.removeFiles', filesToRemove.length.toString())
                : I18n.getMessage('confirm.removeFile', vscode.workspace.asRelativePath(filesToRemove[0].uri));

            const choice = await vscode.window.showWarningMessage(
                message,
                { modal: true },
                I18n.getMessage('confirm.remove')
            );

            if (choice === I18n.getMessage('confirm.remove')) {
                executeRemove();
            }
        } else {
            // No confirmation needed, remove directly
            executeRemove();
        }
    }));

    // Generic Delete Command (for Delete key)
    context.subscriptions.push(vscode.commands.registerCommand('virtualTabs.delete', (item?: TempFileItem | TempFolderItem, selectedItems?: (TempFileItem | TempFolderItem)[]) => {
        console.log('[DEBUG] virtualTabs.delete triggered');
        console.log('[DEBUG] item:', item);
        console.log('[DEBUG] selectedItems:', selectedItems);

        let selection: (TempFileItem | TempFolderItem)[] = [];

        // Priority: selectedItems > item > provider.getSelection()
        if (selectedItems && selectedItems.length > 0) {
            console.log('[DEBUG] Using selectedItems');
            selection = selectedItems;
        } else if (item) {
            console.log('[DEBUG] Using single item');
            selection = [item];
        } else {
            console.log('[DEBUG] Using provider.getSelection()');
            selection = provider.getSelection() as (TempFileItem | TempFolderItem)[];
        }

        console.log('[DEBUG] Selection:', selection);
        console.log('[DEBUG] Selection length:', selection.length);

        if (selection.length === 0) {
            console.log('[DEBUG] No selection, returning');
            return;
        }

        // Categorize items
        const filesToRemove = selection.filter(i => i instanceof TempFileItem) as TempFileItem[];
        const groupsToRemove = selection.filter(i => i instanceof TempFolderItem) as TempFolderItem[];
        console.log('[DEBUG] Files to remove:', filesToRemove.length);
        console.log('[DEBUG] Groups to remove:', groupsToRemove.length);

        // 1. Remove files
        if (filesToRemove.length > 0) {
            console.log('[DEBUG] Executing removeFileFromGroup');
            vscode.commands.executeCommand('virtualTabs.removeFileFromGroup', filesToRemove[0], filesToRemove);
        }

        // 2. Remove groups
        if (groupsToRemove.length > 0) {
            console.log('[DEBUG] Executing removeGroup');
            vscode.commands.executeCommand('virtualTabs.removeGroup', groupsToRemove[0], groupsToRemove);
        }
    }));

    // Copy Command
    context.subscriptions.push(vscode.commands.registerCommand('virtualTabs.copy', async (item: TempFileItem | TempFolderItem | undefined, selectedItems?: (TempFileItem | TempFolderItem)[]) => {
        console.log('[DEBUG] virtualTabs.copy triggered');
        console.log('[DEBUG] item:', item);
        console.log('[DEBUG] selectedItems:', selectedItems);

        let itemsToCopy: (TempFileItem | TempFolderItem)[] = [];

        if (selectedItems && Array.isArray(selectedItems) && selectedItems.length > 0) {
            console.log('[DEBUG] Using selectedItems');
            itemsToCopy = selectedItems;
        } else if (item) {
            console.log('[DEBUG] Using single item');
            itemsToCopy = [item];
        } else {
            // Keybinding case: get from provider
            console.log('[DEBUG] Keybinding case: getting selection from provider');
            const selection = provider.getSelection();
            console.log('[DEBUG] Provider selection:', selection);
            if (selection.length > 0) {
                itemsToCopy = selection.filter(i => i instanceof TempFileItem || i instanceof TempFolderItem) as (TempFileItem | TempFolderItem)[];
            }
        }

        console.log('[DEBUG] Items to copy:', itemsToCopy.length);
        if (itemsToCopy.length === 0) {
            console.log('[DEBUG] No items to copy, returning');
            return;
        }

        // 1. Update internal clipboard
        globalClipboardItems = [...itemsToCopy];
        console.log('[DEBUG] Updated globalClipboardItems:', globalClipboardItems.length);

        // 2. Update system clipboard (text/plain)
        const textToCopy = itemsToCopy
            .map(i => {
                if (i instanceof TempFileItem) return i.uri.fsPath; // Absolute path
                if (i instanceof TempFolderItem) return `[Group] ${i.label}`;
                return '';
            })
            .filter(Boolean)
            .join('\n');

        await vscode.env.clipboard.writeText(textToCopy);
        console.log('[DEBUG] Copied to clipboard');
        vscode.window.setStatusBarMessage(`✓ Copied ${itemsToCopy.length} item(s)`, 3000);
    }));

    // Paste Command
    context.subscriptions.push(vscode.commands.registerCommand('virtualTabs.paste', (target: TempFolderItem | TempFileItem | undefined) => {
        console.log('[DEBUG] virtualTabs.paste triggered');
        console.log('[DEBUG] target:', target);
        console.log('[DEBUG] globalClipboardItems:', globalClipboardItems.length);

        let actualTarget = target;

        // Handle keybinding invocation
        if (!actualTarget) {
            console.log('[DEBUG] No target, getting from selection');
            const selection = provider.getSelection();
            console.log('[DEBUG] Selection:', selection);
            if (selection.length > 0) {
                const first = selection[0];
                if (first instanceof TempFolderItem || first instanceof TempFileItem) {
                    actualTarget = first;
                    console.log('[DEBUG] Using first selection as target');
                }
            }
        }

        if (!actualTarget) {
            console.log('[DEBUG] No actual target, returning');
            return;
        }

        let targetGroupIdx: number | undefined;

        if (actualTarget instanceof TempFolderItem) {
            targetGroupIdx = actualTarget.groupIdx;
            console.log('[DEBUG] Target is folder, groupIdx:', targetGroupIdx);
        } else if (actualTarget instanceof TempFileItem) {
            targetGroupIdx = actualTarget.groupIdx;
            console.log('[DEBUG] Target is file, groupIdx:', targetGroupIdx);
        }

        if (targetGroupIdx === undefined) {
            console.log('[DEBUG] No target group index, returning');
            return;
        }

        if (globalClipboardItems.length === 0) {
            console.log('[DEBUG] No items in clipboard, returning');
            return;
        }

        const group = provider.groups[targetGroupIdx];
        if (!group) {
            console.log('[DEBUG] Group not found, returning');
            return;
        }

        // Process items
        const urisToAdd = globalClipboardItems
            .filter(i => i instanceof TempFileItem)
            .map(i => (i as TempFileItem).uri.toString());

        console.log('[DEBUG] URIs to add:', urisToAdd.length);

        if (urisToAdd.length > 0) {
            if (!group.files) group.files = [];
            let addedCount = 0;
            for (const uri of urisToAdd) {
                if (!group.files.includes(uri)) {
                    group.files.push(uri);
                    addedCount++;
                }
            }

            console.log('[DEBUG] Added count:', addedCount);
            if (addedCount > 0) {
                provider.refresh();
                vscode.window.setStatusBarMessage(`✓ Pasted ${addedCount} item(s)`, 3000);
            }
        }
    }));

    // Sort by name command
    context.subscriptions.push(vscode.commands.registerCommand('virtualTabs.sortByName', (item: TempFolderItem) => {
        if (typeof item?.groupIdx === 'number') {
            provider.setSortPreference(item.groupIdx, 'name', 'asc');
        }
    }));

    // Sort by path command
    context.subscriptions.push(vscode.commands.registerCommand('virtualTabs.sortByPath', (item: TempFolderItem) => {
        if (typeof item?.groupIdx === 'number') {
            provider.setSortPreference(item.groupIdx, 'path', 'asc');
        }
    }));

    // Sort by extension command
    context.subscriptions.push(vscode.commands.registerCommand('virtualTabs.sortByExtension', (item: TempFolderItem) => {
        if (typeof item?.groupIdx === 'number') {
            provider.setSortPreference(item.groupIdx, 'extension', 'asc');
        }
    }));

    // Sort by modified time command
    context.subscriptions.push(vscode.commands.registerCommand('virtualTabs.sortByModified', (item: TempFolderItem) => {
        if (typeof item?.groupIdx === 'number') {
            provider.setSortPreference(item.groupIdx, 'modified', 'asc');
        }
    }));

    // Toggle sort order command
    context.subscriptions.push(vscode.commands.registerCommand('virtualTabs.toggleSortOrder', (item: TempFolderItem) => {
        if (typeof item?.groupIdx === 'number') {
            const group = provider.groups[item.groupIdx];
            if (group && group.sortBy && group.sortBy !== 'none') {
                const newOrder = group.sortOrder === 'asc' ? 'desc' : 'asc';
                provider.setSortPreference(item.groupIdx, group.sortBy, newOrder);
            }
        }
    }));

    // Clear sorting command
    context.subscriptions.push(vscode.commands.registerCommand('virtualTabs.clearSort', (item: TempFolderItem) => {
        if (typeof item?.groupIdx === 'number') {
            provider.setSortPreference(item.groupIdx, 'none', 'asc');
        }
    }));

    // Auto group by modified date command
    context.subscriptions.push(vscode.commands.registerCommand('virtualTabs.autoGroupByModifiedDate', () => {
        provider.autoGroupByModifiedDate();
    }));

    // ========== Bookmark Commands (v0.2.0) ==========

    // Add bookmark to group (Smart Flow)
    context.subscriptions.push(
        vscode.commands.registerCommand('virtualTabs.addBookmark', async () => {
            const editor = vscode.window.activeTextEditor;
            if (!editor) {
                vscode.window.showErrorMessage(I18n.getMessage('bookmark.noActiveEditor'));
                return;
            }

            const fileUri = editor.document.uri.toString();
            const position = editor.selection.active;

            // 1. Smart Labeling: Line {n} ({code snippet})
            const lineContent = editor.document.lineAt(position.line).text.trim();
            let snippet = lineContent;
            if (snippet.length > 20) {
                snippet = snippet.substring(0, 20) + '...';
            }

            let label = `Line ${position.line + 1}`;
            if (snippet) {
                label += ` (${snippet})`;
            }

            // 2. Smart Grouping
            const customGroups = provider.groups.filter(g => !g.builtIn);

            // Scenario: No custom groups available
            if (customGroups.length === 0) {
                const createOption = I18n.getMessage('command.addGroup.title'); // Reuse "Add Group" string or similar
                const selection = await vscode.window.showInformationMessage(
                    "No custom groups found. Create a new group?",
                    "Create Group"
                );

                if (selection === "Create Group") {
                    await provider.addGroup();
                    // After creating, we could try to continue, but simpler to ask user to try again
                    // or we could auto-select the new group. Let's just return for now to keep it simple.
                }
                return;
            }

            // Find groups containing this file
            const containingGroups = customGroups.filter(g => g.files?.includes(fileUri));

            let targetGroup;

            if (containingGroups.length === 1) {
                // Scenario A: File belongs to exactly one group -> Auto pick
                targetGroup = containingGroups[0];
            } else if (containingGroups.length > 1) {
                // Scenario B: File belongs to multiple groups -> Ask user
                const groupItems = containingGroups.map(g => ({
                    label: g.name,
                    group: g
                }));
                const selected = await vscode.window.showQuickPick(groupItems, {
                    placeHolder: I18n.getMessage('bookmark.selectGroup')
                });
                if (!selected) return;
                targetGroup = selected.group;
            } else {
                // Scenario C: File not in any group -> Ask user to pick any group
                const groupItems = customGroups.map(g => ({
                    label: g.name,
                    group: g
                }));
                const selected = await vscode.window.showQuickPick(groupItems, {
                    placeHolder: I18n.getMessage('bookmark.selectGroup')
                });
                if (!selected) return;
                targetGroup = selected.group;

                // Add file to group automatically
                if (!targetGroup.files) targetGroup.files = [];
                targetGroup.files.push(fileUri);
            }

            // 3. Create Bookmark (No Input Box!)
            const bookmark = BookmarkManager.createBookmark(
                position.line,
                label,
                position.character,
                '' // Description empty by default
            );

            BookmarkManager.addBookmarkToGroup(targetGroup, fileUri, bookmark);
            provider.refresh();

            // Subtle feedback
            vscode.window.setStatusBarMessage(`Bookmark added to ${targetGroup.name}`, 3000);
        })
    );

    // Jump to bookmark
    context.subscriptions.push(
        vscode.commands.registerCommand('virtualTabs.jumpToBookmark', async (item: BookmarkItem) => {
            if (!(item instanceof BookmarkItem)) {
                return;
            }

            try {
                const document = await vscode.workspace.openTextDocument(item.fileUri);
                const editor = await vscode.window.showTextDocument(document);

                const position = new vscode.Position(
                    item.bookmark.line,
                    item.bookmark.character || 0
                );

                const range = new vscode.Range(position, position);

                // Jump and scroll to center
                editor.selection = new vscode.Selection(position, position);
                editor.revealRange(range, vscode.TextEditorRevealType.InCenter);

                // Removed highlight logic based on user feedback

            } catch (error) {
                vscode.window.showErrorMessage(
                    I18n.getMessage('bookmark.jumpFailed', String(error))
                );
            }
        })
    );

    // Edit bookmark label
    context.subscriptions.push(
        vscode.commands.registerCommand('virtualTabs.editBookmarkLabel', async (item: BookmarkItem) => {
            if (!(item instanceof BookmarkItem)) {
                return;
            }

            const newLabel = await vscode.window.showInputBox({
                prompt: I18n.getMessage('bookmark.editLabel'),
                value: item.bookmark.label,
                validateInput: (value) => {
                    if (!value.trim()) {
                        return I18n.getMessage('bookmark.labelRequired');
                    }
                    return null;
                }
            });

            if (!newLabel || newLabel === item.bookmark.label) {
                return;
            }

            const group = provider.groups[item.groupIdx];
            const updatedBookmark = BookmarkManager.updateLabel(item.bookmark, newLabel);

            BookmarkManager.updateBookmark(
                group,
                item.fileUri.toString(),
                item.bookmark.id,
                updatedBookmark
            );

            provider.refresh();
            vscode.window.showInformationMessage(
                I18n.getMessage('bookmark.labelUpdated', newLabel)
            );
        })
    );

    // Edit bookmark description
    context.subscriptions.push(
        vscode.commands.registerCommand('virtualTabs.editBookmarkDescription', async (item: BookmarkItem) => {
            if (!(item instanceof BookmarkItem)) {
                return;
            }

            const newDescription = await vscode.window.showInputBox({
                prompt: I18n.getMessage('bookmark.editDescription'),
                value: item.bookmark.description || '',
                placeHolder: I18n.getMessage('bookmark.descriptionPlaceholder')
            });

            if (newDescription === undefined) {
                return; // User cancelled
            }

            const group = provider.groups[item.groupIdx];
            const updatedBookmark = BookmarkManager.updateDescription(
                item.bookmark,
                newDescription || undefined
            );

            BookmarkManager.updateBookmark(
                group,
                item.fileUri.toString(),
                item.bookmark.id,
                updatedBookmark
            );

            provider.refresh();
            vscode.window.showInformationMessage(
                I18n.getMessage('bookmark.descriptionUpdated')
            );
        })
    );

    // Remove bookmark
    context.subscriptions.push(
        vscode.commands.registerCommand('virtualTabs.removeBookmark', async (item: BookmarkItem) => {
            if (!(item instanceof BookmarkItem)) {
                return;
            }

            const group = provider.groups[item.groupIdx];
            const removed = BookmarkManager.removeBookmark(
                group,
                item.fileUri.toString(),
                item.bookmark.id
            );

            if (removed) {
                provider.refresh();
                vscode.window.setStatusBarMessage(`Bookmark removed`, 3000);
            }
        })
    );


    // AI Context: Copy Group Context (works for both groups and files)
    context.subscriptions.push(
        vscode.commands.registerCommand('virtualTabs.copyGroupContext', async (item: TempFolderItem | TempFileItem) => {
            let filesToProcess: string[] = [];
            let contextTitle = '';

            // Check if it's a group or a file
            if (item && 'groupIdx' in item && typeof item.groupIdx === 'number' && !('resourceUri' in item && item.resourceUri)) {
                // It's a group - get all files recursively (including children)
                const group = provider.groups[item.groupIdx];
                if (!group || !group.id) {
                    vscode.window.showInformationMessage(I18n.getMessage('message.noFilesToGroup'));
                    return;
                }
                filesToProcess = getAllFilesInGroupRecursive(provider.groups, group.id);
                if (filesToProcess.length === 0) {
                    vscode.window.showInformationMessage(I18n.getMessage('message.noFilesToGroup'));
                    return;
                }
                contextTitle = `Context from Group: ${group.name}`;
            } else if (item && 'resourceUri' in item && item.resourceUri) {
                // It's a file
                filesToProcess = [item.resourceUri.toString()];
                contextTitle = `Context from File: ${vscode.workspace.asRelativePath(item.resourceUri)}`;
            } else {
                vscode.window.showWarningMessage('Please select a group or file.');
                return;
            }

            const total = filesToProcess.length;
            if (total > 20) {
                vscode.window.showInformationMessage(I18n.getMessage('error.tooManyFiles', total.toString()));
            }

            // Binary extension check
            const BINARY_EXTENSIONS = new Set([
                'png', 'jpg', 'jpeg', 'gif', 'bmp', 'ico', 'svg', 'webp',
                'mp3', 'wav', 'ogg', 'mp4', 'webm', 'mov',
                'zip', 'tar', 'gz', '7z', 'rar',
                'exe', 'dll', 'so', 'dylib', 'bin',
                'pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx',
                'class', 'pyc', 'pyo', 'db', 'sqlite'
            ]);

            let content = `${contextTitle}\n\n`;
            let isCancelled = false;

            await vscode.window.withProgress({
                location: vscode.ProgressLocation.Notification,
                title: I18n.getMessage('progress.generatingContext'),
                cancellable: true
            }, async (progress, token) => {
                const step = 100 / total;
                let processed = 0;

                for (const uriStr of filesToProcess) {
                    if (token.isCancellationRequested) {
                        isCancelled = true;
                        break;
                    }

                    try {
                        const uri = vscode.Uri.parse(uriStr);
                        const ext = uri.fsPath.split('.').pop()?.toLowerCase() || '';

                        // Skip binary files by extension
                        if (BINARY_EXTENSIONS.has(ext)) {
                            processed++;
                            progress.report({ increment: step });
                            continue;
                        }

                        // Read file
                        const fileData = await vscode.workspace.fs.readFile(uri);
                        const fileText = new TextDecoder('utf-8').decode(fileData);

                        // Simple binary check: look for null bytes in the first 1000 chars
                        if (fileText.slice(0, 1000).indexOf('\0') !== -1) {
                            processed++;
                            progress.report({ increment: step });
                            continue;
                        }

                        // Format
                        const relativePath = vscode.workspace.asRelativePath(uri);
                        content += `## File: ${relativePath}\n`;
                        content += '```' + (ext || '') + '\n';
                        content += fileText + '\n';
                        content += '```\n\n';

                    } catch (e) {
                        console.error(`Failed to read file ${uriStr}`, e);
                        content += `## File: ${uriStr}\n(Error reading file)\n\n`;
                    }

                    processed++;
                    progress.report({ increment: step, message: `(${processed}/${total})` });
                }
            });

            if (isCancelled) return;

            // Smart Handling Logic
            // Threshold for smart handling (50KB)
            const SIZE_THRESHOLD = 50 * 1024;

            if (content.length > SIZE_THRESHOLD) {
                // Too large -> Open in Untitled Document
                try {
                    const doc = await vscode.workspace.openTextDocument({
                        content: content,
                        language: 'markdown'
                    });
                    await vscode.window.showTextDocument(doc);
                    vscode.window.showInformationMessage(
                        I18n.getMessage('message.contextTooLargeOpenEditor', (content.length / 1024 / 1024).toFixed(1))
                    );
                } catch (e) {
                    vscode.window.showErrorMessage(I18n.getMessage('error.cannotOpenEditor'));
                }
            } else {
                // Small enough -> Copy to Clipboard
                await vscode.env.clipboard.writeText(content);
                vscode.window.showInformationMessage(I18n.getMessage('message.contextCopied'));
            }
        })
    );

    // AI Context: Copy Group Paths
    context.subscriptions.push(
        vscode.commands.registerCommand('virtualTabs.copyGroupPaths', async (item: TempFolderItem) => {
            if (typeof item?.groupIdx !== 'number') return;
            const group = provider.groups[item.groupIdx];
            if (!group || !group.files || group.files.length === 0) return;

            const paths = group.files.map(uriStr => {
                try {
                    return vscode.workspace.asRelativePath(vscode.Uri.parse(uriStr));
                } catch {
                    return uriStr;
                }
            });

            await vscode.env.clipboard.writeText(paths.join('\n'));
            vscode.window.showInformationMessage(I18n.getMessage('message.pathsCopied'));
        })
    );
}
