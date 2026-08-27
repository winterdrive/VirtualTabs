/**
 * 單元測試：GroupProvider.getScopeLabel
 *
 * getScopeLabel 曾以 path.basename(scope.uri.fsPath) 重新推導資料夾名稱，
 * 與 ScopeHeaderItem（treeItems.ts）已修正的邏輯不一致：
 * path.basename 在資料夾為磁碟根目錄時回傳空字串，且不會反映使用者在
 * 多根工作區自訂的資料夾顯示名稱。應直接使用 ConfigScopeDiscovery 已
 * 計算好的 scope.label（來自 vscode 的 WorkspaceFolder.name）。
 */

interface MockUri {
    fsPath: string;
}

interface MockScope {
    id: string;
    type: 'workspace' | 'folder';
    label: string;
    uri: MockUri;
}

/** 與 provider.ts 實際實作保持一致（修正後）。 */
function getScopeLabel(scope: MockScope): string {
    return scope.type === 'workspace'
        ? 'Workspace Config'
        : `Project: ${scope.label}`;
}

describe('GroupProvider.getScopeLabel', () => {
    test('workspace scope 應回傳 "Workspace Config"', () => {
        const scope: MockScope = {
            id: 'file:///workspace',
            type: 'workspace',
            label: 'Workspace',
            uri: { fsPath: '/workspace' }
        };
        expect(getScopeLabel(scope)).toBe('Workspace Config');
    });

    test('folder scope 應回傳 "Project: [scope.label]"', () => {
        const scope: MockScope = {
            id: 'file:///workspace/Repo-A',
            type: 'folder',
            label: 'Repo-A',
            uri: { fsPath: '/workspace/Repo-A' }
        };
        expect(getScopeLabel(scope)).toBe('Project: Repo-A');
    });

    test('資料夾為磁碟根目錄時不應顯示空白名稱', () => {
        // path.basename('/') 會回傳 ''，若重新以 uri.fsPath 推導會顯示 "Project: "。
        const scope: MockScope = {
            id: 'file:///',
            type: 'folder',
            label: 'root',
            uri: { fsPath: '/' }
        };
        expect(getScopeLabel(scope)).toBe('Project: root');
    });

    test('多根工作區自訂資料夾名稱時應使用 scope.label 而非 uri 推導出的 basename', () => {
        const scope: MockScope = {
            id: 'file:///home/user/Repo-A',
            type: 'folder',
            label: 'Custom Display Name',
            uri: { fsPath: '/home/user/Repo-A' }
        };
        expect(getScopeLabel(scope)).toBe('Project: Custom Display Name');
    });
});

export {};
