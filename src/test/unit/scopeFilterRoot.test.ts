/**
 * 單元測試：scope 篩選後根層 tree 結構
 *
 * 對應手動測試 #9–14：驗證 getChildren(undefined) 在不同 activeScopeIds 組合下
 * 回傳的節點型別與順序。
 *
 * 節點分三種：
 *   'builtIn'     — 已開啟資料夾（TempFolderItem, builtIn=true）
 *   'scopeGroup'  — 一般自訂群組（TempFolderItem, builtIn=false）
 *   'scopeHeader' — repo scope 標頭（ScopeHeaderItem）
 */

const BUILTIN_SCOPE_ID = '__builtin__';

interface MockGroup {
    id: string;
    name: string;
    builtIn?: boolean;
    parentGroupId?: string;
    sourceScopeId?: string;
}

interface MockScope {
    id: string;
    label: string;
}

type NodeType = 'builtIn' | 'scopeGroup' | 'scopeHeader';

interface MockNode {
    type: NodeType;
    id: string;
}

/**
 * 模擬 getChildren(undefined) 的根層篩選邏輯，與 provider.ts 實作保持一致。
 * 只關注節點的型別與 ID，不依賴 VS Code API。
 */
function getRootNodes(
    groups: MockGroup[],
    configScopes: MockScope[],
    activeScopeIds: Set<string>
): MockNode[] {
    const makeFolderNode = (group: MockGroup): MockNode => ({
        type: group.builtIn ? 'builtIn' : 'scopeGroup',
        id: group.id
    });

    const isFiltered = activeScopeIds.size > 0;

    if (isFiltered) {
        const showBuiltIn = activeScopeIds.has(BUILTIN_SCOPE_ID);
        const visibleScopes = configScopes.filter(s => activeScopeIds.has(s.id));

        const builtInNodes = showBuiltIn
            ? groups.filter(g => g.builtIn).map(makeFolderNode)
            : [];

        // 只有 built-in（沒有 repo scope）
        if (visibleScopes.length === 0) {
            return builtInNodes;
        }

        // 單一 repo scope 且不含 built-in：平面顯示
        if (visibleScopes.length === 1 && !showBuiltIn) {
            return groups
                .filter(g => !g.parentGroupId && !g.builtIn && g.sourceScopeId === visibleScopes[0].id)
                .map(makeFolderNode);
        }

        // 單一 repo scope + built-in：built-in 在前，該 scope 的群組平面顯示
        if (visibleScopes.length === 1 && showBuiltIn) {
            const scopeGroups = groups
                .filter(g => !g.parentGroupId && !g.builtIn && g.sourceScopeId === visibleScopes[0].id)
                .map(makeFolderNode);
            return [...builtInNodes, ...scopeGroups];
        }

        // 多個 repo scope（含或不含 built-in）：ScopeHeaderItem
        const scopeHeaders: MockNode[] = visibleScopes.map(s => ({ type: 'scopeHeader', id: s.id }));
        return [...builtInNodes, ...scopeHeaders];
    }

    // 無篩選：多 scope 顯示 ScopeHeaderItem；單 scope 平面顯示
    const hasMultipleScopes = configScopes.length > 1;

    if (hasMultipleScopes) {
        const scopeHeaders: MockNode[] = configScopes.map(s => ({ type: 'scopeHeader', id: s.id }));
        const builtInNodes = groups.filter(g => g.builtIn).map(makeFolderNode);
        return [...builtInNodes, ...scopeHeaders];
    }

    return groups.filter(g => !g.parentGroupId).map(makeFolderNode);
}

// ─── 測試資料 ─────────────────────────────────────────────────────────────────

const scopeA: MockScope = { id: 'scope-a', label: 'Repo-A' };
const scopeB: MockScope = { id: 'scope-b', label: 'Repo-B' };
const twoScopes = [scopeA, scopeB];

const builtInGroup: MockGroup = { id: 'builtin', name: '目前開啟的檔案', builtIn: true };
const groupA1: MockGroup = { id: 'ga1', name: 'Group A1', sourceScopeId: 'scope-a' };
const groupA2: MockGroup = { id: 'ga2', name: 'Group A2', sourceScopeId: 'scope-a' };
const groupB1: MockGroup = { id: 'gb1', name: 'Group B1', sourceScopeId: 'scope-b' };
const childGroupA1: MockGroup = { id: 'child-ga1', name: 'Child A1', parentGroupId: 'ga1', sourceScopeId: 'scope-a' };

const allGroups = [builtInGroup, groupA1, groupA2, groupB1, childGroupA1];

// ─── 測試 ─────────────────────────────────────────────────────────────────────

describe('scope 篩選後根層 tree 結構', () => {
    describe('無篩選（activeScopeIds 為空）', () => {
        test('多 scope workspace：顯示 built-in + ScopeHeaderItem', () => {
            const nodes = getRootNodes(allGroups, twoScopes, new Set());
            expect(nodes[0].type).toBe('builtIn');
            expect(nodes.filter(n => n.type === 'scopeHeader')).toHaveLength(2);
        });

        test('單一 scope workspace：平面顯示所有頂層群組', () => {
            const nodes = getRootNodes(allGroups, [scopeA], new Set());
            const types = nodes.map(n => n.type);
            expect(types).not.toContain('scopeHeader');
        });
    });

    describe('只選 built-in（#10）', () => {
        test('只顯示 built-in 群組節點', () => {
            const nodes = getRootNodes(allGroups, twoScopes, new Set([BUILTIN_SCOPE_ID]));
            expect(nodes).toHaveLength(1);
            expect(nodes[0].type).toBe('builtIn');
        });

        test('不出現任何 scopeGroup 或 scopeHeader', () => {
            const nodes = getRootNodes(allGroups, twoScopes, new Set([BUILTIN_SCOPE_ID]));
            expect(nodes.some(n => n.type === 'scopeGroup')).toBe(false);
            expect(nodes.some(n => n.type === 'scopeHeader')).toBe(false);
        });
    });

    describe('只選單一 repo scope（#11）', () => {
        test('平面顯示該 scope 的頂層群組，不使用 ScopeHeaderItem', () => {
            const nodes = getRootNodes(allGroups, twoScopes, new Set(['scope-a']));
            expect(nodes.every(n => n.type === 'scopeGroup')).toBe(true);
            expect(nodes.some(n => n.type === 'scopeHeader')).toBe(false);
        });

        test('只顯示該 scope 的群組，不含另一個 scope 的群組', () => {
            const nodes = getRootNodes(allGroups, twoScopes, new Set(['scope-a']));
            const ids = nodes.map(n => n.id);
            expect(ids).toContain('ga1');
            expect(ids).toContain('ga2');
            expect(ids).not.toContain('gb1');
        });

        test('子群組（有 parentGroupId）不出現在根層', () => {
            const nodes = getRootNodes(allGroups, twoScopes, new Set(['scope-a']));
            expect(nodes.some(n => n.id === 'child-ga1')).toBe(false);
        });

        test('不含 built-in 群組', () => {
            const nodes = getRootNodes(allGroups, twoScopes, new Set(['scope-a']));
            expect(nodes.some(n => n.type === 'builtIn')).toBe(false);
        });
    });

    describe('單一 repo scope + built-in（#12）', () => {
        test('built-in 排在第一位', () => {
            const nodes = getRootNodes(allGroups, twoScopes, new Set([BUILTIN_SCOPE_ID, 'scope-a']));
            expect(nodes[0].type).toBe('builtIn');
        });

        test('該 scope 的群組平面顯示在 built-in 之後', () => {
            const nodes = getRootNodes(allGroups, twoScopes, new Set([BUILTIN_SCOPE_ID, 'scope-a']));
            const afterBuiltIn = nodes.slice(1);
            expect(afterBuiltIn.every(n => n.type === 'scopeGroup')).toBe(true);
            expect(afterBuiltIn.map(n => n.id)).toContain('ga1');
        });

        test('不出現 ScopeHeaderItem', () => {
            const nodes = getRootNodes(allGroups, twoScopes, new Set([BUILTIN_SCOPE_ID, 'scope-a']));
            expect(nodes.some(n => n.type === 'scopeHeader')).toBe(false);
        });
    });

    describe('多個 repo scope（#13）', () => {
        test('2 個 repo scope → 顯示 ScopeHeaderItem', () => {
            const nodes = getRootNodes(allGroups, twoScopes, new Set(['scope-a', 'scope-b']));
            expect(nodes.filter(n => n.type === 'scopeHeader')).toHaveLength(2);
        });

        test('ScopeHeaderItem 包含被選取的 scope ID', () => {
            const nodes = getRootNodes(allGroups, twoScopes, new Set(['scope-a', 'scope-b']));
            const headerIds = nodes.filter(n => n.type === 'scopeHeader').map(n => n.id);
            expect(headerIds).toContain('scope-a');
            expect(headerIds).toContain('scope-b');
        });

        test('built-in + 2 repo scope → built-in 在所有 ScopeHeader 前', () => {
            const nodes = getRootNodes(
                allGroups,
                twoScopes,
                new Set([BUILTIN_SCOPE_ID, 'scope-a', 'scope-b'])
            );
            expect(nodes[0].type).toBe('builtIn');
            expect(nodes.slice(1).every(n => n.type === 'scopeHeader')).toBe(true);
        });

        test('ScopeHeaderItem 數量等於被選 repo scope 數量（不含 built-in）', () => {
            const nodes = getRootNodes(
                allGroups,
                twoScopes,
                new Set([BUILTIN_SCOPE_ID, 'scope-a', 'scope-b'])
            );
            expect(nodes.filter(n => n.type === 'scopeHeader')).toHaveLength(2);
        });
    });

    describe('空選後恢復全部（#14）', () => {
        test('空選後，多 scope workspace 恢復顯示所有 ScopeHeaderItem', () => {
            const nodesFiltered = getRootNodes(allGroups, twoScopes, new Set(['scope-a']));
            const nodesAll = getRootNodes(allGroups, twoScopes, new Set());
            expect(nodesFiltered.filter(n => n.type === 'scopeHeader')).toHaveLength(0);
            expect(nodesAll.filter(n => n.type === 'scopeHeader')).toHaveLength(2);
        });
    });
});

export {};
