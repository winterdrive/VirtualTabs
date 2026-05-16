import * as path from 'path';
import { pathToFileURL } from 'url';
import type { TempGroup, ConfigScope } from '../../types';

jest.mock('vscode', () => {
    class Uri {
        private constructor(public readonly fsPath: string) { }

        static file(fsPath: string): Uri {
            return new Uri(path.resolve(fsPath));
        }

        static parse(value: string): Uri {
            if (value.startsWith('file://')) {
                return new Uri(new URL(value).pathname);
            }
            return new Uri(value);
        }

        static joinPath(base: Uri, ...segments: string[]): Uri {
            return new Uri(path.join(base.fsPath, ...segments));
        }

        toString(): string {
            return pathToFileURL(this.fsPath).toString();
        }
    }

    class TreeItem {
        id?: string;
        resourceUri?: Uri;
        command?: unknown;
        iconPath?: unknown;
        tooltip?: unknown;
        contextValue?: string;

        constructor(public readonly label: unknown, public readonly collapsibleState?: number) { }
    }

    return {
        Uri,
        TreeItem,
        TreeItemCollapsibleState: {
            None: 0,
            Collapsed: 1,
            Expanded: 2
        },
        EventEmitter: class {
            event = jest.fn();
            fire = jest.fn();
        },
        ThemeIcon: Object.assign(
            class {
                constructor(public readonly id: string, public readonly color?: unknown) { }
            },
            { File: { id: 'file' } }
        ),
        ThemeColor: class {
            constructor(public readonly id: string) { }
        },
        TabInputText: class { },
        TabInputNotebook: class { },
        TabInputCustom: class { },
        TabInputTextDiff: class { },
        commands: {
            executeCommand: jest.fn()
        },
        window: {
            tabGroups: {
                all: []
            },
            showErrorMessage: jest.fn(),
            showInformationMessage: jest.fn()
        },
        workspace: {
            workspaceFolders: []
        }
    };
}, { virtual: true });

import * as vscode from 'vscode';
import { TempFoldersProvider } from '../../provider';

function createProviderHarness(groups: TempGroup[], configScopes: ConfigScope[]): TempFoldersProvider {
    const provider = Object.create(TempFoldersProvider.prototype) as TempFoldersProvider;
    provider.groups = groups;
    provider.configScopes = configScopes;
    jest.spyOn(provider, 'refresh').mockImplementation(jest.fn());
    return provider;
}

function createFileItem(fsPath: string) {
    const uri = vscode.Uri.file(fsPath);
    return { uri } as never;
}

describe('TempFoldersProvider.removeFilesFromGroup', () => {
    test('removes a reloaded workspace-relative file from its group', () => {
        const workspaceRoot = path.resolve('/workspace/project');
        const targetPath = path.join(workspaceRoot, 'src', 'extension.ts');
        const scopeId = 'scope:project';
        const group: TempGroup = {
            id: 'group-1',
            name: 'New Group 1',
            sourceScopeId: scopeId,
            files: ['src/extension.ts', 'src/commands.ts']
        };

        const provider = createProviderHarness([group], [{
            id: scopeId,
            type: 'folder',
            label: 'project',
            uri: vscode.Uri.file(workspaceRoot),
            groups: []
        }]);

        provider.removeFilesFromGroup(0, [createFileItem(targetPath)]);

        expect(group.files).toEqual(['src/commands.ts']);
        expect(provider.refresh).toHaveBeenCalledTimes(1);
    });

    test('removes multiple selected relative-path files from the same reloaded group', () => {
        const workspaceRoot = path.resolve('/workspace/project');
        const scopeId = 'scope:project';
        const group: TempGroup = {
            id: 'group-1',
            name: 'New Group 1',
            sourceScopeId: scopeId,
            files: ['src/extension.ts', 'src/commands.ts', 'src/provider.ts']
        };

        const provider = createProviderHarness([group], [{
            id: scopeId,
            type: 'folder',
            label: 'project',
            uri: vscode.Uri.file(workspaceRoot),
            groups: []
        }]);

        provider.removeFilesFromGroup(0, [
            createFileItem(path.join(workspaceRoot, 'src', 'extension.ts')),
            createFileItem(path.join(workspaceRoot, 'src', 'commands.ts'))
        ]);

        expect(group.files).toEqual(['src/provider.ts']);
        expect(provider.refresh).toHaveBeenCalledTimes(1);
    });

    test('uses the matching source scope root when groups belong to different folders', () => {
        const repoARoot = path.resolve('/workspace/Repo-A');
        const repoBRoot = path.resolve('/workspace/Repo-B');
        const repoAGroup: TempGroup = {
            id: 'group-a',
            name: 'Repo A Group',
            sourceScopeId: 'scope:a',
            files: ['src/shared.ts']
        };
        const repoBGroup: TempGroup = {
            id: 'group-b',
            name: 'Repo B Group',
            sourceScopeId: 'scope:b',
            files: ['src/shared.ts']
        };

        const provider = createProviderHarness([repoAGroup, repoBGroup], [
            {
                id: 'scope:a',
                type: 'folder',
                label: 'Repo-A',
                uri: vscode.Uri.file(repoARoot),
                groups: []
            },
            {
                id: 'scope:b',
                type: 'folder',
                label: 'Repo-B',
                uri: vscode.Uri.file(repoBRoot),
                groups: []
            }
        ]);

        provider.removeFilesFromGroup(0, [
            createFileItem(path.join(repoARoot, 'src', 'shared.ts'))
        ]);

        expect(repoAGroup.files).toEqual([]);
        expect(repoBGroup.files).toEqual(['src/shared.ts']);
        expect(provider.refresh).toHaveBeenCalledTimes(1);
    });

    test('falls back to the workspace root for legacy groups without source scope', () => {
        const workspaceRoot = path.resolve('/workspace/project');
        const group: TempGroup = {
            id: 'legacy-group',
            name: 'Legacy Group',
            files: ['src/extension.ts']
        };

        const provider = createProviderHarness([group], []);
        (vscode.workspace as unknown as { workspaceFolders: Array<{ uri: { fsPath: string } }> }).workspaceFolders = [
            { uri: vscode.Uri.file(workspaceRoot) }
        ];

        provider.removeFilesFromGroup(0, [
            createFileItem(path.join(workspaceRoot, 'src', 'extension.ts'))
        ]);

        expect(group.files).toEqual([]);
        expect(provider.refresh).toHaveBeenCalledTimes(1);
    });

    test('removes bookmarks stored with the same workspace-relative file path', () => {
        const workspaceRoot = path.resolve('/workspace/project');
        const targetPath = path.join(workspaceRoot, 'src', 'extension.ts');
        const scopeId = 'scope:project';
        const group: TempGroup = {
            id: 'group-1',
            name: 'New Group 1',
            sourceScopeId: scopeId,
            files: ['src/extension.ts'],
            bookmarks: {
                'src/extension.ts': [{
                    id: 'bookmark-1',
                    line: 12,
                    label: 'important',
                    created: 1
                }]
            }
        };

        const provider = createProviderHarness([group], [{
            id: scopeId,
            type: 'folder',
            label: 'project',
            uri: vscode.Uri.file(workspaceRoot),
            groups: []
        }]);

        provider.removeFilesFromGroup(0, [createFileItem(targetPath)]);

        expect(group.files).toEqual([]);
        expect(group.bookmarks).toBeUndefined();
        expect(provider.refresh).toHaveBeenCalledTimes(1);
    });

    test('does not refresh when selected files do not match stored entries', () => {
        const workspaceRoot = path.resolve('/workspace/project');
        const targetPath = path.join(workspaceRoot, 'src', 'provider.ts');
        const scopeId = 'scope:project';
        const group: TempGroup = {
            id: 'group-1',
            name: 'New Group 1',
            sourceScopeId: scopeId,
            files: ['src/extension.ts']
        };

        const provider = createProviderHarness([group], [{
            id: scopeId,
            type: 'folder',
            label: 'project',
            uri: vscode.Uri.file(workspaceRoot),
            groups: []
        }]);

        provider.removeFilesFromGroup(0, [createFileItem(targetPath)]);

        expect(group.files).toEqual(['src/extension.ts']);
        expect(provider.refresh).not.toHaveBeenCalled();
    });
});
