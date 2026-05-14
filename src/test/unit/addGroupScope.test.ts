/**
 * 單元測試：addGroup 的 scope 自動決定邏輯
 *
 * 對應手動測試 #17–19。
 *
 * 規則（來自 provider.ts addGroup()）：
 *   nonBuiltinActive = activeScopeIds 中排除 BUILTIN_SCOPE_ID 的項目
 *   若 nonBuiltinActive.length === 1 → 自動建立在該 scope，不彈出選擇器
 *   否則 → 需要彈出 scope 選擇器
 */

const BUILTIN_SCOPE_ID = '__builtin__';

type AddGroupAction = 'auto' | 'show-picker';

/**
 * 模擬 addGroup 的決策邏輯。
 * 回傳 'auto'（帶 scopeId）或 'show-picker'。
 */
function resolveAddGroupAction(
    activeScopeIds: Set<string>
): { action: 'auto'; scopeId: string } | { action: 'show-picker' } {
    const nonBuiltinActive = [...activeScopeIds].filter(id => id !== BUILTIN_SCOPE_ID);
    if (nonBuiltinActive.length === 1) {
        return { action: 'auto', scopeId: nonBuiltinActive[0] };
    }
    return { action: 'show-picker' };
}

describe('addGroup scope 自動決定邏輯', () => {
    describe('自動決定（不彈選擇器）的情境（#17）', () => {
        test('只有 1 個 repo scope 被篩選 → auto，並帶出正確 scopeId', () => {
            const result = resolveAddGroupAction(new Set(['scope-a']));
            expect(result.action).toBe('auto');
            if (result.action === 'auto') {
                expect(result.scopeId).toBe('scope-a');
            }
        });

        test('built-in + 1 個 repo scope → auto，scopeId 為 repo scope（#12 組合）', () => {
            const result = resolveAddGroupAction(new Set([BUILTIN_SCOPE_ID, 'scope-a']));
            expect(result.action).toBe('auto');
            if (result.action === 'auto') {
                expect(result.scopeId).toBe('scope-a');
            }
        });
    });

    describe('需要彈出選擇器的情境（#18、#19）', () => {
        test('無篩選（空 set）→ show-picker', () => {
            const result = resolveAddGroupAction(new Set());
            expect(result.action).toBe('show-picker');
        });

        test('只選 built-in（無 repo scope）→ show-picker', () => {
            const result = resolveAddGroupAction(new Set([BUILTIN_SCOPE_ID]));
            expect(result.action).toBe('show-picker');
        });

        test('2 個 repo scope → show-picker', () => {
            const result = resolveAddGroupAction(new Set(['scope-a', 'scope-b']));
            expect(result.action).toBe('show-picker');
        });

        test('built-in + 2 個 repo scope → show-picker', () => {
            const result = resolveAddGroupAction(
                new Set([BUILTIN_SCOPE_ID, 'scope-a', 'scope-b'])
            );
            expect(result.action).toBe('show-picker');
        });

        test('3 個 repo scope → show-picker', () => {
            const result = resolveAddGroupAction(
                new Set(['scope-a', 'scope-b', 'scope-c'])
            );
            expect(result.action).toBe('show-picker');
        });
    });

    describe('BUILTIN_SCOPE_ID 不被算入 nonBuiltinActive', () => {
        test('BUILTIN_SCOPE_ID 不應觸發 auto 路徑', () => {
            const result = resolveAddGroupAction(new Set([BUILTIN_SCOPE_ID]));
            expect(result.action).not.toBe('auto');
        });

        test('正確計算：BUILTIN + 2 repo scope 的 nonBuiltinActive.length 為 2', () => {
            const result = resolveAddGroupAction(
                new Set([BUILTIN_SCOPE_ID, 'scope-x', 'scope-y'])
            );
            expect(result.action).toBe('show-picker');
        });
    });
});

export {};
