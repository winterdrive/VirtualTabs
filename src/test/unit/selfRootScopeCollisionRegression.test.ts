/**
 * Integration regression test for the self-root .code-workspace ConfigScope
 * id collision (#116).
 *
 * ConfigScopeDiscovery.test.ts only exercises a hand-mirrored copy of the
 * discover() logic — it never calls the real TempFoldersProvider code path
 * that actually persists data, so it can't catch a regression in how
 * reinitializeScopes()/loadGroups()/saveGroupsImmediate() route through
 * groupManagers by scope.id. That's exactly the path that doubled real
 * users' virtualTab.json on every reopen before the fix (41 -> 82 entries
 * after a single reopen, reported live).
 *
 * This test drives the real discover() -> reinitializeScopes() -> real
 * GroupManager file I/O -> saveGroupsImmediate() pipeline against a real
 * temp directory across several simulated close/reopen cycles, and asserts
 * the persisted group count never grows.
 */

import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { pathToFileURL } from 'url';
import type { TempGroup } from '../../types';

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

    return {
        Uri,
        TreeItem: class {
            collapsibleState?: number;
            constructor(public readonly label: unknown, collapsibleState?: number) {
                this.collapsibleState = collapsibleState;
            }
        },
        TreeItemCollapsibleState: { None: 0, Collapsed: 1, Expanded: 2 },
        EventEmitter: class {
            event = jest.fn();
            fire = jest.fn();
        },
        ThemeIcon: Object.assign(
            class { constructor(public readonly id: string, public readonly color?: unknown) { } },
            { File: { id: 'file' } }
        ),
        ThemeColor: class { constructor(public readonly id: string) { } },
        commands: { executeCommand: jest.fn() },
        window: {
            tabGroups: { all: [] },
            showErrorMessage: jest.fn(),
            showInformationMessage: jest.fn()
        },
        workspace: { workspaceFolders: [] as unknown[], workspaceFile: undefined as unknown }
    };
}, { virtual: true });

import * as vscode from 'vscode';
import { TempFoldersProvider } from '../../provider';
import { GroupManager } from '../../core/GroupManager';
import type { ConfigScope } from '../../types';

function makeSelfRootProject(): string {
    return fs.mkdtempSync(path.join(os.tmpdir(), 'vt-self-root-'));
}

function seedConfig(projectDir: string, groups: TempGroup[]): string {
    const configPath = path.join(projectDir, '.vscode', 'virtualTab.json');
    fs.mkdirSync(path.dirname(configPath), { recursive: true });
    fs.writeFileSync(configPath, JSON.stringify(groups, null, 2));
    return configPath;
}

/** Bare provider instance bypassing the constructor, mirroring the harness
 * pattern already used in autoGroupProviderRegression.test.ts. */
function createReloadHarness(): TempFoldersProvider {
    const provider = Object.create(TempFoldersProvider.prototype) as TempFoldersProvider;
    provider.groups = [];
    provider.configScopes = [];
    (provider as unknown as { scopeOrderIds: string[] }).scopeOrderIds = [];
    (provider as unknown as { activeScopeIds: Set<string> }).activeScopeIds = new Set();
    (provider as unknown as { expandedScopeIds: Set<string> }).expandedScopeIds = new Set();
    (provider as unknown as { groupManagers: Map<string, unknown> }).groupManagers = new Map();
    (provider as unknown as { loadedVersions: Map<string, number> }).loadedVersions = new Map();
    (provider as unknown as { _onDidChangeTreeData: { fire: jest.Mock } })._onDidChangeTreeData = { fire: jest.fn() };
    return provider;
}

/** Simulates one full "close VS Code, reopen the same self-root workspace" cycle. */
function simulateReopenCycle(provider: TempFoldersProvider): void {
    provider.reinitializeScopes();
    // Some later user action (opening/closing a file, etc.) triggers a
    // default refresh(true), which schedules the debounced persist.
    provider.refresh(true);
    provider.flushPendingSave();
}

describe('Self-root .code-workspace ConfigScope collision (#116 regression)', () => {
    let projectDir: string;

    beforeEach(() => {
        projectDir = makeSelfRootProject();
        (vscode.workspace as unknown as { workspaceFile: unknown }).workspaceFile =
            vscode.Uri.file(path.join(projectDir, 'project.code-workspace'));
        (vscode.workspace as unknown as { workspaceFolders: unknown[] }).workspaceFolders = [
            { uri: vscode.Uri.file(projectDir), name: path.basename(projectDir), index: 0 }
        ];
    });

    afterEach(() => {
        jest.restoreAllMocks();
        fs.rmSync(projectDir, { recursive: true, force: true });
        (vscode.workspace as unknown as { workspaceFile: unknown }).workspaceFile = undefined;
        (vscode.workspace as unknown as { workspaceFolders: unknown[] }).workspaceFolders = [];
    });

    test('fixed discover(): 5 reopen cycles never grow the persisted group count', () => {
        const configPath = seedConfig(projectDir, [{ id: 'g1', name: 'Existing Group', files: [] }]);
        const provider = createReloadHarness();

        for (let cycle = 1; cycle <= 5; cycle++) {
            simulateReopenCycle(provider);

            // Exactly one real scope should survive the self-root collision.
            expect(provider.configScopes).toHaveLength(1);
            expect(provider.configScopes[0].type).toBe('folder');

            const persisted = JSON.parse(fs.readFileSync(configPath, 'utf8')) as TempGroup[];
            expect(persisted).toHaveLength(1);
            expect(persisted[0].id).toBe('g1');
        }
    });

    test('regression check: an id collision that reaches groupManagers still doubles the group on save (isolates the original root cause)', () => {
        // This bypasses ConfigScopeDiscovery.discover() and the new
        // assertUniqueScopeIds() guard entirely (both now prevent the
        // collision from ever reaching this point) so the test isolates the
        // original root cause: groupManagers.set(scope.id, ...) silently
        // overwrites on a duplicate id, but loadGroups()/saveGroupsImmediate()
        // still iterate the configScopes ARRAY, which has two entries for
        // that one id — reading/writing the same real file twice.
        const configPath = seedConfig(projectDir, [{ id: 'g1', name: 'Existing Group', files: [] }]);
        const provider = createReloadHarness();

        const collidingId = vscode.Uri.file(projectDir).toString();
        const collidingScopes: ConfigScope[] = [
            { id: collidingId, type: 'workspace', label: 'Workspace', uri: vscode.Uri.file(projectDir), groups: [] },
            { id: collidingId, type: 'folder', label: path.basename(projectDir), uri: vscode.Uri.file(projectDir), groups: [] }
        ];
        provider.configScopes = collidingScopes;
        const groupManagers = (provider as unknown as { groupManagers: Map<string, GroupManager> }).groupManagers;
        for (const scope of collidingScopes) {
            groupManagers.set(scope.id, new GroupManager(scope.uri.fsPath));
        }

        (provider as unknown as { loadGroups: () => boolean }).loadGroups();
        provider.refresh(true);
        provider.flushPendingSave();

        const persisted = JSON.parse(fs.readFileSync(configPath, 'utf8')) as TempGroup[];
        expect(persisted.length).toBeGreaterThan(1);
        expect(persisted.filter(g => g.id === 'g1')).toHaveLength(2);
    });
});
