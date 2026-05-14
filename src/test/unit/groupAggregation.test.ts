/**
 * 單元測試：多 scope 群組合併邏輯
 *
 * 測試從多個 ConfigScope 載入群組並聚合的邏輯：
 * - 各 scope 的群組應正確合併
 * - sourceScopeId 應正確注入
 * - 群組總數應等於各 scope 群組數之和
 */

// ─── 模擬群組聚合邏輯 ─────────────────────────────────────────────────────────

interface MockGroup {
    id: string;
    name: string;
    files?: string[];
    sourceScopeId?: string;
}

interface MockScope {
    id: string;
    groups: MockGroup[];
}

function aggregateGroups(scopes: MockScope[]): MockGroup[] {
    const allGroups: MockGroup[] = [];

    for (const scope of scopes) {
        for (const group of scope.groups) {
            allGroups.push({
                ...group,
                sourceScopeId: scope.id // 注入 sourceScopeId
            });
        }
    }

    return allGroups;
}

// ─── 測試 ─────────────────────────────────────────────────────────────────────

describe('群組聚合邏輯單元測試', () => {
    test('應正確合併多個 scope 的群組', () => {
        const scopes: MockScope[] = [
            {
                id: 'scope-1',
                groups: [
                    { id: 'g1', name: 'Group 1' },
                    { id: 'g2', name: 'Group 2' }
                ]
            },
            {
                id: 'scope-2',
                groups: [
                    { id: 'g3', name: 'Group 3' }
                ]
            }
        ];

        const aggregated = aggregateGroups(scopes);
        expect(aggregated).toHaveLength(3);
    });

    test('聚合後的群組總數應等於各 scope 群組數之和', () => {
        const scopes: MockScope[] = [
            { id: 'scope-1', groups: [{ id: 'g1', name: 'G1' }, { id: 'g2', name: 'G2' }] },
            { id: 'scope-2', groups: [{ id: 'g3', name: 'G3' }, { id: 'g4', name: 'G4' }, { id: 'g5', name: 'G5' }] }
        ];

        const aggregated = aggregateGroups(scopes);
        const expectedTotal = scopes.reduce((sum, s) => sum + s.groups.length, 0);
        expect(aggregated).toHaveLength(expectedTotal);
    });

    test('每個群組應注入正確的 sourceScopeId', () => {
        const scopes: MockScope[] = [
            {
                id: 'scope-A',
                groups: [{ id: 'g1', name: 'Group 1' }]
            },
            {
                id: 'scope-B',
                groups: [{ id: 'g2', name: 'Group 2' }]
            }
        ];

        const aggregated = aggregateGroups(scopes);

        expect(aggregated[0].sourceScopeId).toBe('scope-A');
        expect(aggregated[1].sourceScopeId).toBe('scope-B');
    });

    test('空 scope 陣列應回傳空群組陣列', () => {
        const aggregated = aggregateGroups([]);
        expect(aggregated).toHaveLength(0);
    });

    test('含空群組的 scope 應正確處理', () => {
        const scopes: MockScope[] = [
            { id: 'scope-1', groups: [] },
            { id: 'scope-2', groups: [{ id: 'g1', name: 'Group 1' }] }
        ];

        const aggregated = aggregateGroups(scopes);
        expect(aggregated).toHaveLength(1);
        expect(aggregated[0].sourceScopeId).toBe('scope-2');
    });

    test('群組的其他欄位應保持不變', () => {
        const scopes: MockScope[] = [
            {
                id: 'scope-1',
                groups: [{ id: 'g1', name: 'My Group', files: ['file1.ts', 'file2.ts'] }]
            }
        ];

        const aggregated = aggregateGroups(scopes);
        expect(aggregated[0].id).toBe('g1');
        expect(aggregated[0].name).toBe('My Group');
        expect(aggregated[0].files).toEqual(['file1.ts', 'file2.ts']);
    });
});

export {};
