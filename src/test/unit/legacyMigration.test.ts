/**
 * 單元測試：virtualTabs.activeScope（單選）→ virtualTabs.activeScopes（多選）遷移邏輯
 *
 * 對應手動測試 #16。
 *
 * 遷移規則（來自 extension.ts）：
 *   1. 優先讀取新 key（activeScopes）
 *   2. 若新 key 不存在，且舊 key（activeScope）有值，則以舊值組成單元素陣列
 *   3. 兩者皆無 → 空陣列
 */

/**
 * 模擬 extension.ts 中的遷移計算：
 *   const legacyId = workspaceState.get('virtualTabs.activeScope', undefined)
 *   const storedIds = workspaceState.get('virtualTabs.activeScopes', legacyId ? [legacyId] : [])
 */
function resolveScopeIds(
    legacyActiveScope: string | undefined,
    activeScopes: string[] | undefined
): string[] {
    const legacyId = legacyActiveScope;
    // workspaceState.get 的 defaultValue 僅在 key 不存在時使用
    const storedIds = activeScopes !== undefined
        ? activeScopes
        : (legacyId ? [legacyId] : []);
    return storedIds;
}

describe('virtualTabs.activeScope → activeScopes 遷移邏輯', () => {
    describe('只有舊 key（首次升級的使用者）', () => {
        test('舊 key 有值時，包裝成單元素陣列', () => {
            const result = resolveScopeIds('scope-a', undefined);
            expect(result).toEqual(['scope-a']);
        });

        test('舊 key 為空字串時，回傳空陣列', () => {
            const result = resolveScopeIds('', undefined);
            expect(result).toEqual([]);
        });

        test('舊 key 為 undefined 時，回傳空陣列', () => {
            const result = resolveScopeIds(undefined, undefined);
            expect(result).toEqual([]);
        });
    });

    describe('只有新 key（正常使用中的使用者）', () => {
        test('新 key 有值時，直接回傳', () => {
            const result = resolveScopeIds(undefined, ['scope-a', 'scope-b']);
            expect(result).toEqual(['scope-a', 'scope-b']);
        });

        test('新 key 為空陣列時，回傳空陣列（無篩選狀態）', () => {
            const result = resolveScopeIds(undefined, []);
            expect(result).toEqual([]);
        });
    });

    describe('新舊 key 皆存在（升級後已更新過的使用者）', () => {
        test('新 key 優先，忽略舊 key', () => {
            const result = resolveScopeIds('old-scope', ['new-scope-a', 'new-scope-b']);
            expect(result).toEqual(['new-scope-a', 'new-scope-b']);
        });

        test('新 key 為空陣列時仍優先（代表使用者主動取消篩選）', () => {
            const result = resolveScopeIds('old-scope', []);
            expect(result).toEqual([]);
        });
    });

    describe('兩者皆無（全新安裝）', () => {
        test('回傳空陣列', () => {
            const result = resolveScopeIds(undefined, undefined);
            expect(result).toEqual([]);
        });
    });
});
