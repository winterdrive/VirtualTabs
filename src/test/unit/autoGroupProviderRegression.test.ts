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

    test('addAutoGroupsByExt buckets extension-less files together instead of one group per filename', () => {
        const makefile = pathToFileURL(path.join(workspaceDir, 'Makefile')).toString();
        const dockerfile = pathToFileURL(path.join(workspaceDir, 'Dockerfile')).toString();

        const group: TempGroup = {
            id: 'group-1',
            name: 'Source',
            files: [makefile, dockerfile]
        };

        const provider = createProviderHarness([group], []);
        selectGroup(provider, 0, group);

        provider.addAutoGroupsByExt();

        const autoGroups = provider.groups.filter(g => g.id !== group.id);
        expect(autoGroups).toHaveLength(1);
        expect(autoGroups[0].files).toEqual(expect.arrayContaining([makefile, dockerfile]));
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

    // Regression: auto sub-groups sourced from the built-in group have no
    // sourceScopeId (same as the built-in group itself), so the save-routing
    // "no sourceScopeId -> fall back to first scope" compatibility branch was
    // silently persisting them into whichever real scope's storage file
    // happened to be first. On reload they came back with a real
    // sourceScopeId, so they rendered a second time under that scope's
    // ScopeHeaderItem in addition to the top-level built-in section —
    // reported live as duplicated "[自動] .ts @ 目前已開啟檔案" folders.
    test('auto sub-groups created from the built-in group are never persisted to a real scope', () => {
        const tsFile = pathToFileURL(path.join(workspaceDir, 'a.ts')).toString();

        const builtInGroup: TempGroup = {
            id: 'builtin_group_id',
            name: 'Currently Open Files',
            files: [tsFile],
            builtIn: true
        };

        const scope: ConfigScope = {
            id: 'scope:project',
            type: 'folder',
            label: 'project',
            uri: { fsPath: workspaceDir } as never,
            groups: []
        };

        const provider = Object.create(TempFoldersProvider.prototype) as TempFoldersProvider;
        provider.groups = [builtInGroup];
        provider.configScopes = [scope];
        (provider as unknown as { activeScopeIds: Set<string> }).activeScopeIds = new Set();
        (provider as unknown as { expandedGroupIds: Set<string> }).expandedGroupIds = new Set();
        (provider as unknown as { _onDidChangeTreeData: { fire: jest.Mock } })._onDidChangeTreeData = { fire: jest.fn() };
        (provider as unknown as { builtInEditorGroups: unknown[] }).builtInEditorGroups = [];

        const saveGroups = jest.fn();
        const loadGroups = jest.fn().mockReturnValue({ groups: [], version: 0 });
        (provider as unknown as { groupManagers: Map<string, { saveGroups: typeof saveGroups; loadGroups: typeof loadGroups }> }).groupManagers =
            new Map([['scope:project', { saveGroups, loadGroups }]]);
        (provider as unknown as { loadedVersions: Map<string, number> }).loadedVersions = new Map([['scope:project', 0]]);

        selectGroup(provider, 0, builtInGroup);
        provider.addAutoGroupsByExt();
        provider.flushPendingSave();

        expect(saveGroups).toHaveBeenCalledTimes(1);
        const persistedGroups = saveGroups.mock.calls[0][0] as TempGroup[];
        expect(persistedGroups).toEqual([]);
    });
});
