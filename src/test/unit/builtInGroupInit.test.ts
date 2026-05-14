/**
 * 單元測試：built-in 群組初始化條件
 *
 * 回歸測試：multi-root workspace 支援後，若使用者已有儲存的自訂群組，
 * built-in 群組（"已開啟資料夾"）應仍然出現在 Tree view 中。
 *
 * 問題根源：舊程式碼以 `groups.length === 0` 作為初始化條件，
 * 但新程式碼不再將 built-in 群組持久化，導致有舊群組的使用者
 * 在 built-in 群組不在 JSON 中時，永遠不會初始化它。
 */

interface MockGroup {
    id: string;
    name: string;
    files?: string[];
    builtIn?: boolean;
    sourceScopeId?: string;
}

const BUILT_IN_ID = 'builtin_group_id';

function makeBuiltInGroup(): MockGroup {
    return { id: BUILT_IN_ID, name: 'Currently Open Files', builtIn: true, files: [] };
}

/**
 * 模擬修復後的初始化邏輯：
 * 只要沒有任何 builtIn 群組，就注入 built-in 群組。
 */
function ensureBuiltInGroup(groups: MockGroup[]): MockGroup[] {
    if (!groups.some(g => g.builtIn)) {
        return [makeBuiltInGroup(), ...groups];
    }
    return groups;
}

/**
 * 模擬修復前的舊邏輯（回歸比對用）：
 * 只有完全沒有群組時才注入。
 */
function ensureBuiltInGroupOld(groups: MockGroup[]): MockGroup[] {
    if (groups.length === 0) {
        return [makeBuiltInGroup()];
    }
    return groups;
}

describe('Built-in 群組初始化條件', () => {
    describe('修復後的邏輯（!groups.some(g => g.builtIn)）', () => {
        test('沒有任何群組時，應注入 built-in 群組', () => {
            const result = ensureBuiltInGroup([]);
            expect(result).toHaveLength(1);
            expect(result[0].builtIn).toBe(true);
        });

        test('有使用者自訂群組（無 built-in）時，仍應注入 built-in 群組', () => {
            const userGroups: MockGroup[] = [
                { id: 'g1', name: 'My Group', sourceScopeId: 'scope-1' },
                { id: 'g2', name: 'Another Group', sourceScopeId: 'scope-1' }
            ];
            const result = ensureBuiltInGroup(userGroups);
            expect(result.some(g => g.builtIn)).toBe(true);
            expect(result).toHaveLength(3);
        });

        test('built-in 群組應排在第一位', () => {
            const userGroups: MockGroup[] = [{ id: 'g1', name: 'My Group' }];
            const result = ensureBuiltInGroup(userGroups);
            expect(result[0].builtIn).toBe(true);
        });

        test('已有 built-in 群組時，不應重複注入', () => {
            const groups: MockGroup[] = [
                makeBuiltInGroup(),
                { id: 'g1', name: 'My Group' }
            ];
            const result = ensureBuiltInGroup(groups);
            expect(result.filter(g => g.builtIn)).toHaveLength(1);
            expect(result).toHaveLength(2);
        });

        test('使用者群組應保持原有順序', () => {
            const userGroups: MockGroup[] = [
                { id: 'g1', name: 'Alpha' },
                { id: 'g2', name: 'Beta' },
                { id: 'g3', name: 'Gamma' }
            ];
            const result = ensureBuiltInGroup(userGroups);
            const nonBuiltIn = result.filter(g => !g.builtIn);
            expect(nonBuiltIn.map(g => g.name)).toEqual(['Alpha', 'Beta', 'Gamma']);
        });
    });

    describe('回歸驗證：舊邏輯的缺陷', () => {
        test('舊邏輯（groups.length === 0）在有使用者群組時不會注入 built-in 群組', () => {
            const userGroups: MockGroup[] = [{ id: 'g1', name: 'My Group' }];
            const result = ensureBuiltInGroupOld(userGroups);
            // 這就是 bug：有自訂群組但沒有 built-in
            expect(result.some(g => g.builtIn)).toBe(false);
        });

        test('新邏輯修正了這個缺陷', () => {
            const userGroups: MockGroup[] = [{ id: 'g1', name: 'My Group' }];
            const result = ensureBuiltInGroup(userGroups);
            expect(result.some(g => g.builtIn)).toBe(true);
        });
    });
});
