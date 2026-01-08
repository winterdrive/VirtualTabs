import * as vscode from 'vscode';
import { TempFoldersProvider } from './provider';
import { TempFoldersDragAndDropController } from './dragAndDrop';
import { registerCommands } from './commands';
import { I18n } from './i18n';
import { TempFolderItem } from './treeItems';

/**
 * Activate the extension
 * @param context Extension context
 */
export async function activate(context: vscode.ExtensionContext) {
    // Initialize i18n
    await I18n.initialize(context);

    // Listen for language configuration changes
    context.subscriptions.push(
        vscode.workspace.onDidChangeConfiguration(async (e) => {
            if (e.affectsConfiguration('locale')) {
                console.log('Language configuration changed, reloading i18n...');
                await I18n.reload(context);
            }
        })
    );

    // Create Provider and DragAndDrop controller
    const provider = new TempFoldersProvider(context);
    const expandedKey = 'virtualTabs.expandedGroups';
    const expandedIds = context.workspaceState.get<string[]>(expandedKey, []);
    provider.setExpandedGroupIds(expandedIds);
    const dragAndDropController = new TempFoldersDragAndDropController(provider);

    // Create tree view, enable multi-select
    const treeView = vscode.window.createTreeView('virtualTabsView', {
        treeDataProvider: provider,
        dragAndDropController,
        canSelectMany: true
    });
    context.subscriptions.push(treeView);

    // Pass the tree view to the provider for selection management
    provider.setTreeView(treeView);

    const updateExpandedState = (element: vscode.TreeItem, expanded: boolean) => {
        if (!(element instanceof TempFolderItem)) {
            return;
        }
        const ids = provider.updateGroupExpanded(element.groupId, expanded);
        context.workspaceState.update(expandedKey, ids);
    };

    treeView.onDidExpandElement(e => updateExpandedState(e.element, true));
    treeView.onDidCollapseElement(e => updateExpandedState(e.element, false));


    // Refresh the view when it becomes visible
    treeView.onDidChangeVisibility(e => {
        if (e.visible) {
            provider.refresh();
        }
    });

    // Listen for editor file open/close events to auto-refresh the tree view
    context.subscriptions.push(
        vscode.window.onDidChangeVisibleTextEditors(() => {
            console.log('Visible text editors changed, refreshing tree view...');
            provider.refresh();
        })
    );

    // Register all commands
    registerCommands(context, provider);

    // Watch for .vscode/virtualTab.json changes
    const configPath = vscode.workspace.workspaceFolders?.[0]
        ? new vscode.RelativePattern(vscode.workspace.workspaceFolders[0], '.vscode/virtualTab.json')
        : null;

    if (configPath) {
        const watcher = vscode.workspace.createFileSystemWatcher(configPath);
        watcher.onDidChange(() => provider.onExternalFileChange());
        watcher.onDidCreate(() => provider.onExternalFileChange());
        watcher.onDidDelete(() => {
            console.log('VirtualTabs: Config file deleted, resetting to default state...');
            provider.resetToDefault();
            const msg = I18n.getMessage('message.configDeleted') || 'VirtualTabs: Config file deleted. Groups reset to default.';
            vscode.window.showWarningMessage(msg);
        });
        context.subscriptions.push(watcher);
    }
}

/**
 * Deactivate the extension
 */
export function deactivate() { }
