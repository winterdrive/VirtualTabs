/**
 * 單元測試：ScopeHeaderItem
 *
 * 測試 label 生成邏輯和 contextValue 設定：
 * - workspace scope 的 label 應為 'Workspace Config'
 * - folder scope 的 label 應為 'Project: [scope.label]'
 * - 多 scope 時 contextValue 應為 'virtualTabsScopeHeaderWithAdd'
 * - 非互動式（command 應為 undefined）
 */

// ─── 模擬 ScopeHeaderItem 邏輯（不依賴 vscode API）──────────────────────────

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

interface MockScopeHeaderItem {
    label: string;
    contextValue: string;
    command: undefined;
    id: string;
}

function createScopeHeaderItem(
    scope: { id: string; type: 'workspace' | 'folder'; label: string; uri: MockUri },
    hasMultipleScopes: boolean
): MockScopeHeaderItem {
    // ScopeHeaderItem 使用 scope.label（由 ConfigScopeDiscovery 以 folder.name 計算），
    // 而非重新以 path.basename(scope.uri.fsPath) 推導，避免磁碟根目錄等 basename 為空字串的邊緣情況。
    const label = scope.type === 'workspace'
        ? 'Workspace Config'
        : `Project: ${scope.label}`;

    return {
        label,
        contextValue: hasMultipleScopes ? 'virtualTabsScopeHeaderWithAdd' : 'virtualTabsScopeHeader',
        command: undefined,
        id: `virtualTabsScopeHeader:${scope.id}`
    };
}

// ─── 測試 ─────────────────────────────────────────────────────────────────────

describe('ScopeHeaderItem 單元測試', () => {
    describe('workspace scope', () => {
        test('label 應為 "Workspace Config"', () => {
            const scope = {
                id: 'file:///workspace',
                type: 'workspace' as const,
                label: 'Workspace',
                uri: createMockUri('/workspace')
            };
            const item = createScopeHeaderItem(scope, true);
            expect(item.label).toBe('Workspace Config');
        });

        test('多 scope 時 contextValue 應為 "virtualTabsScopeHeaderWithAdd"', () => {
            const scope = {
                id: 'file:///workspace',
                type: 'workspace' as const,
                label: 'Workspace',
                uri: createMockUri('/workspace')
            };
            const item = createScopeHeaderItem(scope, true);
            expect(item.contextValue).toBe('virtualTabsScopeHeaderWithAdd');
        });

        test('單一 scope 時 contextValue 應為 "virtualTabsScopeHeader"', () => {
            const scope = {
                id: 'file:///workspace',
                type: 'workspace' as const,
                label: 'Workspace',
                uri: createMockUri('/workspace')
            };
            const item = createScopeHeaderItem(scope, false);
            expect(item.contextValue).toBe('virtualTabsScopeHeader');
        });
    });

    describe('folder scope', () => {
        test('label 應為 "Project: [scope.label]"', () => {
            const scope = {
                id: 'file:///workspace/Repo-A',
                type: 'folder' as const,
                label: 'Repo-A',
                uri: createMockUri('/workspace/Repo-A')
            };
            const item = createScopeHeaderItem(scope, true);
            expect(item.label).toBe('Project: Repo-A');
        });

        test('label 應直接使用 scope.label', () => {
            const scope = {
                id: 'file:///home/user/my-awesome-project',
                type: 'folder' as const,
                label: 'my-awesome-project',
                uri: createMockUri('/home/user/my-awesome-project')
            };
            const item = createScopeHeaderItem(scope, true);
            expect(item.label).toBe('Project: my-awesome-project');
        });

        test('資料夾為磁碟根目錄（scope.label 由 folder.name 提供）時，label 不應為空白', () => {
            // path.basename('/') 會回傳 ''，若重新以 uri.fsPath 推導會顯示 "Project: "。
            // scope.label 應直接沿用 ConfigScopeDiscovery 已計算好的 folder.name。
            const scope = {
                id: 'file:///',
                type: 'folder' as const,
                label: 'root',
                uri: createMockUri('/')
            };
            const item = createScopeHeaderItem(scope, true);
            expect(item.label).toBe('Project: root');
        });

        test('多根工作區自訂資料夾名稱時，label 應使用 scope.label 而非 uri 推導出的 basename', () => {
            const scope = {
                id: 'file:///home/user/Repo-A',
                type: 'folder' as const,
                label: 'Custom Display Name',
                uri: createMockUri('/home/user/Repo-A')
            };
            const item = createScopeHeaderItem(scope, true);
            expect(item.label).toBe('Project: Custom Display Name');
        });

        test('多 scope 時 contextValue 應為 "virtualTabsScopeHeaderWithAdd"', () => {
            const scope = {
                id: 'file:///workspace/Repo-A',
                type: 'folder' as const,
                label: 'Repo-A',
                uri: createMockUri('/workspace/Repo-A')
            };
            const item = createScopeHeaderItem(scope, true);
            expect(item.contextValue).toBe('virtualTabsScopeHeaderWithAdd');
        });
    });

    describe('非互動式', () => {
        test('command 應為 undefined', () => {
            const scope = {
                id: 'file:///workspace',
                type: 'workspace' as const,
                label: 'Workspace',
                uri: createMockUri('/workspace')
            };
            const item = createScopeHeaderItem(scope, true);
            expect(item.command).toBeUndefined();
        });

        test('id 應包含 scope.id', () => {
            const scope = {
                id: 'file:///workspace',
                type: 'workspace' as const,
                label: 'Workspace',
                uri: createMockUri('/workspace')
            };
            const item = createScopeHeaderItem(scope, true);
            expect(item.id).toContain(scope.id);
        });
    });
});
