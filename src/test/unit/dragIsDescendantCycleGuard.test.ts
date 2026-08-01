/**
 * 單元測試：isDescendant 的循環父群組防護
 *
 * 驗證：
 * 1. 正常的祖先鏈仍可正確判斷
 * 2. 非祖先關係回傳 false
 * 3. 循環的 parentGroupId 鏈不會造成無窮遞迴（visited 集合防護）
 */

interface FakeParentGroup {
    id: string;
    parentGroupId?: string;
}

/**
 * 模擬 isDescendant 的核心邏輯（修正後版本，含 visited 防護）。
 */
function isDescendant(groups: FakeParentGroup[], groupId: string, potentialAncestorId: string, visited = new Set<string>()): boolean {
    if (visited.has(groupId)) return false;
    visited.add(groupId);

    const group = groups.find(g => g.id === groupId);
    if (!group || !group.parentGroupId) return false;

    if (group.parentGroupId === potentialAncestorId) return true;

    return isDescendant(groups, group.parentGroupId, potentialAncestorId, visited);
}

describe('isDescendant 循環防護', () => {
    test('直接子群組應判斷為後代', () => {
        const groups: FakeParentGroup[] = [
            { id: 'parent', parentGroupId: undefined },
            { id: 'child', parentGroupId: 'parent' }
        ];
        expect(isDescendant(groups, 'child', 'parent')).toBe(true);
    });

    test('多層巢狀後代應判斷為 true', () => {
        const groups: FakeParentGroup[] = [
            { id: 'grandparent' },
            { id: 'parent', parentGroupId: 'grandparent' },
            { id: 'child', parentGroupId: 'parent' }
        ];
        expect(isDescendant(groups, 'child', 'grandparent')).toBe(true);
    });

    test('無關群組應判斷為 false', () => {
        const groups: FakeParentGroup[] = [
            { id: 'a' },
            { id: 'b' }
        ];
        expect(isDescendant(groups, 'a', 'b')).toBe(false);
    });

    test('循環的 parentGroupId 鏈不應無窮遞迴，且回傳 false', () => {
        const groups: FakeParentGroup[] = [
            { id: 'g1', parentGroupId: 'g2' },
            { id: 'g2', parentGroupId: 'g1' }
        ];
        expect(() => isDescendant(groups, 'g1', 'unrelated')).not.toThrow();
        expect(isDescendant(groups, 'g1', 'unrelated')).toBe(false);
    });

    test('自我循環（parentGroupId 指向自己）不應無窮遞迴', () => {
        const groups: FakeParentGroup[] = [{ id: 'g1', parentGroupId: 'g1' }];
        expect(() => isDescendant(groups, 'g1', 'unrelated')).not.toThrow();
    });
});
