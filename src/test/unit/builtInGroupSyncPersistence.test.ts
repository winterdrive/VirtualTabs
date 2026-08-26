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
            constructor(public readonly label: unknown, public readonly collapsibleState?: number) { }
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
        TabInputText: class { },
        TabInputNotebook: class { },
        TabInputCustom: class { },
        TabInputTextDiff: class { },
        commands: { executeCommand: jest.fn() },
        window: {
            tabGroups: { all: [] },
            showErrorMessage: jest.fn(),
            showInformationMessage: jest.fn()
        },
        workspace: { workspaceFolders: [] }
    };
}, { virtual: true });

import { TempFoldersProvider } from '../../provider';

interface ProviderInternals {
    builtInEditorGroups: Array<{ viewColumn: number; label: string; files: string[] }>;
    builtInItemsCache: unknown;
    computeEditorGroups: jest.Mock;
    saveGroups: jest.Mock;
    _onDidChangeTreeData: { fire: jest.Mock };
}

function createProviderHarness(groups: TempGroup[]) {
    const provider = Object.create(TempFoldersProvider.prototype) as TempFoldersProvider;
    provider.groups = groups;

    const internals = provider as unknown as ProviderInternals;
    internals.builtInEditorGroups = [];
    internals.builtInItemsCache = [];
    internals.computeEditorGroups = jest.fn();
    internals.saveGroups = jest.fn();
    internals._onDidChangeTreeData = { fire: jest.fn() };

    return { provider, internals };
}

describe('TempFoldersProvider built-in group persistence', () => {
    test('syncBuiltInGroup updates derived tab state without scheduling a config save', () => {
        const fileA = 'file:///workspace/a.ts';
        const fileB = 'file:///workspace/b.ts';
        const builtIn: TempGroup = {
            id: 'builtin_group_id',
            name: 'Currently Open Files',
            files: [fileA],
            builtIn: true
        };
        const { provider, internals } = createProviderHarness([builtIn]);

        internals.builtInEditorGroups = [
            { viewColumn: 1, label: 'Editor Group 1', files: [fileA] }
        ];
        internals.computeEditorGroups.mockReturnValue([
            { viewColumn: 1, label: 'Editor Group 1', files: [fileA, fileB] }
        ]);

        expect(provider.syncBuiltInGroup()).toBe(true);
        expect(builtIn.files).toEqual([fileA, fileB]);
        expect(internals.builtInItemsCache).toBeNull();
        expect(internals._onDidChangeTreeData.fire).toHaveBeenCalledWith(undefined);
        expect(internals.saveGroups).not.toHaveBeenCalled();
    });

    test('custom group edits still use the normal persistence path', () => {
        const builtIn: TempGroup = {
            id: 'builtin_group_id',
            name: 'Currently Open Files',
            files: [],
            builtIn: true
        };
        const custom: TempGroup = {
            id: 'custom-group',
            name: 'Custom',
            files: []
        };
        const { provider, internals } = createProviderHarness([builtIn, custom]);
        internals.computeEditorGroups.mockReturnValue([]);

        provider.addFilesToGroup(1, ['file:///workspace/custom.ts']);

        expect(custom.files).toEqual(['file:///workspace/custom.ts']);
        expect(internals.saveGroups).toHaveBeenCalledTimes(1);
        expect(internals._onDidChangeTreeData.fire).toHaveBeenCalledWith(undefined);
    });
});
