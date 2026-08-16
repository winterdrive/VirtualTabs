/**
 * 單元測試：ConfigScopeDiscovery
 *
 * 測試各種工作區配置下的探索結果：
 * - 單一資料夾工作區
 * - 多根工作區（含 workspaceFile）
 * - 無工作區資料夾
 * - folder scope label 使用 folder.name（而非重新以 path.basename 推導）
 */

import * as path from 'path';

// ─── 模擬 vscode API ──────────────────────────────────────────────────────────

interface MockUri {
    fsPath: string;
    toString(): string;
}

function createMockUri(fsPath: string): MockUri {
    const normalized = fsPath.replace(/\\/g, '/');
    return {
        fsPath,
        toString: () => `file://${normalized}`
    };
}

function joinPath(uri: MockUri, ...segments: string[]): MockUri {
    return createMockUri(path.join(uri.fsPath, ...segments));
}

// ─── 模擬 ConfigScopeDiscovery 邏輯 ──────────────────────────────────────────

interface MockConfigScope {
    id: string;
    type: 'workspace' | 'folder';
    label: string;
    uri: MockUri;
    groups: unknown[];
}

function discoverScopes(
    workspaceFile: MockUri | undefined,
    workspaceFolders: Array<{ uri: MockUri; name: string }> | undefined
): MockConfigScope[] {
    const scopes: MockConfigScope[] = [];

    if (workspaceFolders && workspaceFolders.length > 0) {
        for (const folder of workspaceFolders) {
            scopes.push({
                id: folder.uri.toString(),
                type: 'folder',
                label: folder.name,
                uri: folder.uri,
                groups: []
            });
        }
    }

    if (workspaceFile) {
        const parentUri = joinPath(workspaceFile, '..');
        const workspaceScope: MockConfigScope = {
            id: parentUri.toString(),
            type: 'workspace',
            label: 'Workspace',
            uri: parentUri,
            groups: []
        };
        // self-root .code-workspace：workspace 父目錄與某個 folder 相同時，
        // 兩者的 id 會是同一個 uri.toString()。若同時保留，provider.ts 以
        // scope.id 為 key 建立 groupManagers 時，後建立的 GroupManager 會
        // 靜默覆蓋前一個，導致 loadGroups() 對同一份設定檔重複讀取、每次
        // 啟動筆數倍增。因此略過該 workspace scope，只保留 folder scope。
        const isSelfRootAlias = scopes.some(scope => scope.id === workspaceScope.id);
        if (!isSelfRootAlias) {
            scopes.unshift(workspaceScope);
        }
    }

    return scopes;
}

// ─── 測試 ─────────────────────────────────────────────────────────────────────

describe('ConfigScopeDiscovery 單元測試', () => {
    describe('單一資料夾工作區', () => {
        test('應回傳一個 folder scope', () => {
            const folders = [{ uri: createMockUri('/home/user/project'), name: 'project' }];
            const scopes = discoverScopes(undefined, folders);

            expect(scopes).toHaveLength(1);
            expect(scopes[0].type).toBe('folder');
        });

        test('folder scope 的 uri 應等於資料夾的 uri', () => {
            const folderUri = createMockUri('/home/user/project');
            const folders = [{ uri: folderUri, name: 'project' }];
            const scopes = discoverScopes(undefined, folders);

            expect(scopes[0].uri.toString()).toBe(folderUri.toString());
        });

        test('folder scope 的 label 應為資料夾名稱', () => {
            const folders = [{ uri: createMockUri('/home/user/my-project'), name: 'my-project' }];
            const scopes = discoverScopes(undefined, folders);

            expect(scopes[0].label).toBe('my-project');
        });

        test('folder scope 的 id 應等於 uri.toString()', () => {
            const folderUri = createMockUri('/home/user/project');
            const folders = [{ uri: folderUri, name: 'project' }];
            const scopes = discoverScopes(undefined, folders);

            expect(scopes[0].id).toBe(folderUri.toString());
        });

        test('資料夾為磁碟根目錄時，label 仍應使用 folder.name（path.basename 在此情況會回傳空字串）', () => {
            // 例如在 Windows 開啟 "C:\" 或在 POSIX 開啟 "/" 作為工作區資料夾，
            // path.basename(fsPath) 會是 ''，但 VS Code 已在 folder.name 提供正確名稱。
            const folders = [{ uri: createMockUri('/'), name: 'root' }];
            const scopes = discoverScopes(undefined, folders);

            expect(scopes[0].label).toBe('root');
        });

        test('多根工作區自訂資料夾名稱時，label 應使用 folder.name 而非 basename', () => {
            const folders = [{ uri: createMockUri('/home/user/Repo-A'), name: 'Custom Display Name' }];
            const scopes = discoverScopes(undefined, folders);

            expect(scopes[0].label).toBe('Custom Display Name');
        });
    });

    describe('多根工作區', () => {
        test('應回傳一個 workspace scope 加上多個 folder scope', () => {
            const workspaceFile = createMockUri('/home/user/workspace/my.code-workspace');
            const folders = [
                { uri: createMockUri('/home/user/workspace/Repo-A'), name: 'Repo-A' },
                { uri: createMockUri('/home/user/workspace/Repo-B'), name: 'Repo-B' }
            ];
            const scopes = discoverScopes(workspaceFile, folders);

            expect(scopes).toHaveLength(3); // 1 workspace + 2 folder
            expect(scopes[0].type).toBe('workspace');
            expect(scopes[1].type).toBe('folder');
            expect(scopes[2].type).toBe('folder');
        });

        test('workspace scope 的 uri 應為 workspaceFile 的父目錄', () => {
            const workspaceFile = createMockUri('/home/user/workspace/my.code-workspace');
            const scopes = discoverScopes(workspaceFile, []);

            const expectedParent = joinPath(workspaceFile, '..');
            expect(scopes[0].uri.toString()).toBe(expectedParent.toString());
        });

        test('workspace scope 的 label 應為 "Workspace"', () => {
            const workspaceFile = createMockUri('/home/user/workspace/my.code-workspace');
            const scopes = discoverScopes(workspaceFile, []);

            expect(scopes[0].label).toBe('Workspace');
        });

        test('folder scope 的 label 應為各資料夾名稱', () => {
            const workspaceFile = createMockUri('/home/user/workspace/my.code-workspace');
            const folders = [
                { uri: createMockUri('/home/user/workspace/Repo-A'), name: 'Repo-A' },
                { uri: createMockUri('/home/user/workspace/Repo-B'), name: 'Repo-B' }
            ];
            const scopes = discoverScopes(workspaceFile, folders);

            expect(scopes[1].label).toBe('Repo-A');
            expect(scopes[2].label).toBe('Repo-B');
        });
    });

    describe('無工作區資料夾', () => {
        test('應回傳空陣列', () => {
            const scopes = discoverScopes(undefined, undefined);
            expect(scopes).toHaveLength(0);
        });

        test('空 workspaceFolders 陣列應回傳空陣列', () => {
            const scopes = discoverScopes(undefined, []);
            expect(scopes).toHaveLength(0);
        });
    });

    describe('self-root .code-workspace（workspace 父目錄等於某個 folder）', () => {
        test('只應回傳一個 folder scope，不應同時保留碰撞的 workspace scope', () => {
            // "folders": [{ "path": "." }] 的典型情境：
            // .code-workspace 檔案與唯一的 workspace folder 位於同一目錄
            const workspaceFile = createMockUri('/home/user/Dawn3GL/Dawn3GL.code-workspace');
            const folders = [{ uri: createMockUri('/home/user/Dawn3GL'), name: 'Dawn3GL' }];
            const scopes = discoverScopes(workspaceFile, folders);

            expect(scopes).toHaveLength(1);
            expect(scopes[0].type).toBe('folder');
            expect(scopes[0].uri.toString()).toBe(createMockUri('/home/user/Dawn3GL').toString());
        });

        test('所有 scope id 應唯一（避免 provider.ts 的 groupManagers Map key 碰撞）', () => {
            const workspaceFile = createMockUri('/home/user/Dawn3GL/Dawn3GL.code-workspace');
            const folders = [{ uri: createMockUri('/home/user/Dawn3GL'), name: 'Dawn3GL' }];
            const scopes = discoverScopes(workspaceFile, folders);

            const ids = scopes.map(s => s.id);
            expect(new Set(ids).size).toBe(ids.length);
        });

        test('多根工作區中若其中一個 folder 與 workspace 同目錄，仍應保留其餘 folder scope，只略過碰撞的 workspace scope', () => {
            const workspaceFile = createMockUri('/home/user/Dawn3GL/Dawn3GL.code-workspace');
            const folders = [
                { uri: createMockUri('/home/user/Dawn3GL'), name: 'Dawn3GL' },
                { uri: createMockUri('/home/user/OtherRepo'), name: 'OtherRepo' }
            ];
            const scopes = discoverScopes(workspaceFile, folders);

            expect(scopes).toHaveLength(2);
            expect(scopes.every(s => s.type === 'folder')).toBe(true);
            const ids = scopes.map(s => s.id);
            expect(new Set(ids).size).toBe(ids.length);
        });

        test('workspace 父目錄與所有 folder 都不同時，仍應保留 workspace scope（一般多根工作區行為不受影響）', () => {
            const workspaceFile = createMockUri('/home/user/workspace/my.code-workspace');
            const folders = [
                { uri: createMockUri('/home/user/workspace/Repo-A'), name: 'Repo-A' },
                { uri: createMockUri('/home/user/workspace/Repo-B'), name: 'Repo-B' }
            ];
            const scopes = discoverScopes(workspaceFile, folders);

            expect(scopes).toHaveLength(3);
            expect(scopes.filter(s => s.type === 'workspace')).toHaveLength(1);
        });
    });
});
