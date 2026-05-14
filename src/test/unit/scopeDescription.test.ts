/**
 * 單元測試：computeScopeDescription 輸出邏輯
 *
 * 驗證 panel header description 在不同 activeScopeIds 組合下的輸出：
 * - 空選（無篩選）→ undefined
 * - 只選 built-in → built-in 名稱
 * - 只選 1 個 repo scope → scope 標籤
 * - 選 2+ 個 → "N scopes"
 * - activeScopeIds 含失效 ID → labels 為空 → undefined
 */

const BUILTIN_SCOPE_ID = '__builtin__';
const BUILTIN_LABEL = '目前開啟的檔案';

interface MockScope {
    id: string;
    label: string;
}

/**
 * 模擬 getScopeLabel：直接回傳 scope.label（省略 I18n 與 workspace folder 邏輯）
 */
function mockGetScopeLabel(scope: MockScope): string {
    return scope.label;
}

/**
 * 模擬 computeScopeDescription 的純邏輯，與 provider.ts 實作保持一致。
 */
function computeScopeDescription(
    activeScopeIds: Set<string>,
    configScopes: MockScope[]
): string | undefined {
    if (activeScopeIds.size === 0) return undefined;
    const labels: string[] = [];
    if (activeScopeIds.has(BUILTIN_SCOPE_ID)) labels.push(BUILTIN_LABEL);
    for (const scope of configScopes) {
        if (activeScopeIds.has(scope.id)) labels.push(mockGetScopeLabel(scope));
    }
    if (labels.length === 0) return undefined;
    return labels.length === 1 ? labels[0] : `${labels.length} scopes`;
}

// ─── 測試資料 ─────────────────────────────────────────────────────────────────

const scopeA: MockScope = { id: 'scope-a', label: 'Project: Repo-A' };
const scopeB: MockScope = { id: 'scope-b', label: 'Project: Repo-B' };
const scopeC: MockScope = { id: 'scope-c', label: 'Project: Repo-C' };
const allScopes = [scopeA, scopeB, scopeC];

// ─── 測試 ─────────────────────────────────────────────────────────────────────

describe('computeScopeDescription', () => {
    describe('無篩選（空選）', () => {
        test('activeScopeIds 為空時回傳 undefined', () => {
            expect(computeScopeDescription(new Set(), allScopes)).toBeUndefined();
        });
    });

    describe('只選 built-in', () => {
        test('只有 BUILTIN_SCOPE_ID → 回傳 built-in 名稱', () => {
            const result = computeScopeDescription(new Set([BUILTIN_SCOPE_ID]), allScopes);
            expect(result).toBe(BUILTIN_LABEL);
        });
    });

    describe('只選單一 repo scope', () => {
        test('只選 scope-a → 回傳 scope-a 標籤', () => {
            const result = computeScopeDescription(new Set(['scope-a']), allScopes);
            expect(result).toBe('Project: Repo-A');
        });

        test('只選 scope-b → 回傳 scope-b 標籤', () => {
            const result = computeScopeDescription(new Set(['scope-b']), allScopes);
            expect(result).toBe('Project: Repo-B');
        });
    });

    describe('多選（2+ 個）', () => {
        test('built-in + 1 repo scope → "2 scopes"', () => {
            const result = computeScopeDescription(new Set([BUILTIN_SCOPE_ID, 'scope-a']), allScopes);
            expect(result).toBe('2 scopes');
        });

        test('2 repo scopes → "2 scopes"', () => {
            const result = computeScopeDescription(new Set(['scope-a', 'scope-b']), allScopes);
            expect(result).toBe('2 scopes');
        });

        test('built-in + 2 repo scopes → "3 scopes"', () => {
            const result = computeScopeDescription(
                new Set([BUILTIN_SCOPE_ID, 'scope-a', 'scope-b']),
                allScopes
            );
            expect(result).toBe('3 scopes');
        });

        test('3 repo scopes → "3 scopes"', () => {
            const result = computeScopeDescription(
                new Set(['scope-a', 'scope-b', 'scope-c']),
                allScopes
            );
            expect(result).toBe('3 scopes');
        });
    });

    describe('含失效 ID 的邊界情況', () => {
        test('activeScopeIds 只含過期 ID（不在 configScopes）→ undefined', () => {
            const result = computeScopeDescription(new Set(['stale-scope-id']), allScopes);
            expect(result).toBeUndefined();
        });

        test('過期 ID 與有效 ID 混合 → 只計算有效的', () => {
            const result = computeScopeDescription(
                new Set(['scope-a', 'stale-scope-id']),
                allScopes
            );
            expect(result).toBe('Project: Repo-A');
        });

        test('configScopes 為空、activeScopeIds 只有 BUILTIN_SCOPE_ID → built-in 名稱', () => {
            const result = computeScopeDescription(new Set([BUILTIN_SCOPE_ID]), []);
            expect(result).toBe(BUILTIN_LABEL);
        });
    });

    describe('N scopes 數量計算', () => {
        test('數量反映 labels 長度，不是 activeScopeIds 的 size', () => {
            // activeScopeIds.size = 3，但其中一個是過期 ID，labels 只有 2 個
            const result = computeScopeDescription(
                new Set(['scope-a', 'scope-b', 'stale-id']),
                allScopes
            );
            expect(result).toBe('2 scopes');
        });
    });
});

export {};
