import { groupItemsByGroupIdx } from '../../core/GroupFileTargets';

describe('groupItemsByGroupIdx', () => {
    test('returns an empty map for no selected items', () => {
        expect(groupItemsByGroupIdx([]).size).toBe(0);
    });

    test('keeps one group when all selected items belong to the same group', () => {
        const first = { groupIdx: 1, id: 'a' };
        const second = { groupIdx: 1, id: 'b' };

        const result = groupItemsByGroupIdx([first, second]);

        expect(Array.from(result.keys())).toEqual([1]);
        expect(result.get(1)).toEqual([first, second]);
    });

    test('preserves insertion order while splitting selected items by group index', () => {
        const first = { groupIdx: 2, id: 'a' };
        const second = { groupIdx: 1, id: 'b' };
        const third = { groupIdx: 2, id: 'c' };

        const result = groupItemsByGroupIdx([first, second, third]);

        expect(Array.from(result.keys())).toEqual([2, 1]);
        expect(result.get(2)).toEqual([first, third]);
        expect(result.get(1)).toEqual([second]);
    });
});
