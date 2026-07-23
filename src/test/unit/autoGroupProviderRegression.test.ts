/**
 * Regression test for the real provider.ts Auto Group commands.
 *
 * autoGrouperBookmarks.test.ts and autoGroupScopeId.test.ts only exercise
 * core/AutoGrouper.ts (the MCP-tool layer) or a hand-mirrored copy of the
 * creation logic — neither calls TempFoldersProvider.addAutoGroupsByExt()
 * or .autoGroupByModifiedDate() themselves, which is what the tree view's
 * "Auto Group by Extension/Date" commands actually invoke. That gap let a
 * real regression ship in v0.7.7: bookmarks were dropped on auto-group, and
 * auto sub-groups created from the built-in "Currently Open Files" group
 * were invisible whenever a scope filter was active.
 */

import * as fs from 'fs';
import * as os from 'os';
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
        collapsibleState?: number;

        constructor(public readonly label: unknown, collapsibleState?: number) {
            this.collapsibleState = collapsibleState;
        }
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
            tabGroups: { all: [] },
            showErrorMessage: jest.fn(),
            showInformationMessage: jest.fn()
        },
        workspace: {
            workspaceFolders: []
        }
    };
}, { virtual: true });

import { TempFoldersProvider, BUILTIN_SCOPE_ID } from '../../provider';
import { TempFolderItem } from '../../treeItems';

function makeTempWorkspace(): string {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'vt-provider-autogroup-test-'));
    return dir;
}

function createProviderHarness(groups: TempGroup[], configScopes: ConfigScope[]): TempFoldersProvider {
    const provider = Object.create(TempFoldersProvider.prototype) as TempFoldersProvider;
    provider.groups = groups;
    provider.configScopes = configScopes;
    (provider as unknown as { activeScopeIds: Set<string> }).activeScopeIds = new Set();
    (provider as unknown as { expandedGroupIds: Set<string> }).expandedGroupIds = new Set();
    jest.spyOn(provider, 'refresh').mockImplementation(jest.fn());
    return provider;
}

function selectGroup(provider: TempFoldersProvider, groupIdx: number, group: TempGroup): void {
    const item = new TempFolderItem(group.name, groupIdx, group.id, group.builtIn);
    (provider as unknown as { treeView: { selection: unknown[] } }).treeView = {
        selection: [item]
    };
}

describe('TempFoldersProvider auto-group commands (real provider.ts code path)', () => {
    let workspaceDir: string;

    beforeEach(() => {
        workspaceDir = makeTempWorkspace();
    });

    afterEach(() => {
        fs.rmSync(workspaceDir, { recursive: true, force: true });
    });

    test('addAutoGroupsByExt moves bookmarks to the new extension sub-groups', () => {
        const tsFile = pathToFileURL(path.join(workspaceDir, 'a.ts')).toString();
        const mdFile = pathToFileURL(path.join(workspaceDir, 'b.md')).toString();

        const group: TempGroup = {
            id: 'group-1',
            name: 'Source',
            files: [tsFile, mdFile],
            bookmarks: {
                [tsFile]: [{ id: 'bm-1', line: 5, label: 'ts bookmark', created: 1 }],
                [mdFile]: [{ id: 'bm-2', line: 1, label: 'md bookmark', created: 2 }]
            }
        };

        const provider = createProviderHarness([group], []);
        selectGroup(provider, 0, group);

        provider.addAutoGroupsByExt();

        // Bookmarks must not be left orphaned on the source group.
        expect(group.bookmarks).toBeUndefined();

        const tsGroup = provider.groups.find(g => g.files?.includes(tsFile) && g.id !== group.id);
        const mdGroup = provider.groups.find(g => g.files?.includes(mdFile) && g.id !== group.id);

        expect(tsGroup?.bookmarks?.[tsFile]).toEqual([{ id: 'bm-1', line: 5, label: 'ts bookmark', created: 1 }]);
        expect(mdGroup?.bookmarks?.[mdFile]).toEqual([{ id: 'bm-2', line: 1, label: 'md bookmark', created: 2 }]);
    });

    test('autoGroupByModifiedDate moves bookmarks to the new date sub-groups', () => {
        const filePath = path.join(workspaceDir, 'today.ts');
        fs.writeFileSync(filePath, 'export {};');
        const fileUri = pathToFileURL(filePath).toString();

        const group: TempGroup = {
            id: 'group-1',
            name: 'Source',
            files: [fileUri],
            bookmarks: {
                [fileUri]: [{ id: 'bm-1', line: 3, label: 'date bookmark', created: 1 }]
            }
        };

        const provider = createProviderHarness([group], []);
        selectGroup(provider, 0, group);

        provider.autoGroupByModifiedDate();

        expect(group.bookmarks).toBeUndefined();

        const dateGroup = provider.groups.find(g => g.files?.includes(fileUri) && g.id !== group.id);
        expect(dateGroup?.bookmarks?.[fileUri]).toEqual([{ id: 'bm-1', line: 3, label: 'date bookmark', created: 1 }]);
    });

    test('auto sub-groups created from the built-in group stay visible when a scope filter is active', () => {
        const tsFile = pathToFileURL(path.join(workspaceDir, 'a.ts')).toString();

        const builtInGroup: TempGroup = {
            id: 'builtin_group_id',
            name: 'Currently Open Files',
            files: [tsFile],
            builtIn: true
        };

        // A real (non-built-in) scope must exist for the "isFiltered" branch
        // in getChildren() to be exercised the same way a multi-root
        // workspace would.
        const scope: ConfigScope = {
            id: 'scope:project',
            type: 'folder',
            label: 'project',
            uri: { fsPath: workspaceDir } as never,
            groups: []
        };

        const provider = createProviderHarness([builtInGroup], [scope]);
        selectGroup(provider, 0, builtInGroup);

        provider.addAutoGroupsByExt();

        // Only the built-in scope is active in the sidebar filter.
        (provider as unknown as { activeScopeIds: Set<string> }).activeScopeIds = new Set([BUILTIN_SCOPE_ID]);

        const children = provider.getChildren() as TempFolderItem[];
        const labels = children.map(c => c.label);

        expect(labels).toContain('Currently Open Files');
        expect(children.length).toBeGreaterThan(1);
    });

    test('resetToDefault(scopeId) does not leave a duplicate built-in group', () => {
        // Reproduces the FileSystemWatcher onDidDelete path in extension.ts,
        // which calls provider.resetToDefault(scopeId) when a scope's
        // virtualTab.json is deleted on disk.
        const builtInGroup: TempGroup = {
            id: 'builtin_group_id',
            name: 'Currently Open Files',
            files: [],
            builtIn: true
        };

        const scopedGroup: TempGroup = {
            id: 'group-1',
            name: 'Scoped',
            files: [],
            sourceScopeId: 'scope:project'
        };

        const provider = createProviderHarness([builtInGroup, scopedGroup], []);

        provider.resetToDefault('scope:project');

        const builtInGroups = provider.groups.filter(g => g.builtIn);
        expect(builtInGroups).toHaveLength(1);
        expect(provider.groups.find(g => g.id === 'group-1')).toBeUndefined();
    });
});
