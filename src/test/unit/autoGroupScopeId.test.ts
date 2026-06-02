/**
 * 單元測試：auto group 建立時繼承 sourceScopeId
 *
 * 修復 Issue #56：在 multi-root workspace 下，addAutoGroupsByExt()
 * 與 autoGroupByModifiedDate() 建立的 auto group 必須繼承來源群組的
 * sourceScopeId，否則存檔路由會 fallback 至第一個 scope，導致 auto
 * group 存錯位置或 refresh 後消失。
 *
 * 此測試萃取 provider.ts 中兩個方法的核心建立邏輯，以純函式測試。
 */

// ─── 型別 ─────────────────────────────────────────────────────────────────────

interface SourceGroup {
    id: string;
    name: string;
    files: string[];
    sourceScopeId?: string;
}

interface AutoGroup {
    id: string;
    name: string;
    files: string[];
    auto: true;
    sourceGroupId: string;
    sourceScopeId: string | undefined;
    autoGroupType?: 'extension' | 'modifiedDate';
}

// ─── 鏡像 provider.ts 的建立邏輯 ─────────────────────────────────────────────

/**
 * 鏡像 provider.ts addAutoGroupsByExt() 的 auto group 建立邏輯。
 * 依副檔名分桶，產生 auto group 陣列。
 */
function buildExtAutoGroups(source: SourceGroup): AutoGroup[] {
    const extMap: Record<string, string[]> = {};
    for (const uriStr of source.files) {
        const parts = uriStr.split('.');
        const ext = parts.length > 1 ? parts.pop()!.toLowerCase() : 'other';
        if (!extMap[ext]) extMap[ext] = [];
        extMap[ext].push(uriStr);
    }

    return Object.entries(extMap).map(([ext, files]) => ({
        id: `auto_ext_${ext}`,
        name: `.${ext} @ ${source.name}`,
        files,
        auto: true,
        sourceGroupId: source.id,
        sourceScopeId: source.sourceScopeId
    }));
}

/**
 * 鏡像 provider.ts autoGroupByModifiedDate() 的 auto group 建立邏輯。
 * 依日期桶產生 auto group 陣列（桶內容由外部傳入，方便測試）。
 */
function buildDateAutoGroups(
    source: SourceGroup,
    dateAssignments: Map<string, string[]>
): AutoGroup[] {
    const dateOrder = ['today', 'yesterday', 'thisWeek', 'lastWeek', 'thisMonth', 'older'];
    const result: AutoGroup[] = [];

    for (const slot of dateOrder) {
        const files = dateAssignments.get(slot);
        if (files && files.length > 0) {
            result.push({
                id: `auto_date_${slot}`,
                name: `[Auto] ${slot} @ ${source.name}`,
                files,
                auto: true,
                autoGroupType: 'modifiedDate',
                sourceGroupId: source.id,
                sourceScopeId: source.sourceScopeId
            });
        }
    }

    return result;
}

// ─── 測試：按副檔名自動分組 ───────────────────────────────────────────────────

describe('buildExtAutoGroups — sourceScopeId 繼承', () => {
    const sourceWithScope: SourceGroup = {
        id: 'grp-1',
        name: 'Feature Files',
        files: ['file:///repo-b/src/index.ts', 'file:///repo-b/src/util.ts', 'file:///repo-b/config/app.json'],
        sourceScopeId: 'scope-repo-b'
    };

    test('每個 auto group 都繼承來源群組的 sourceScopeId', () => {
        const groups = buildExtAutoGroups(sourceWithScope);
        expect(groups.length).toBeGreaterThan(0);
        for (const g of groups) {
            expect(g.sourceScopeId).toBe('scope-repo-b');
        }
    });

    test('.ts 桶與 .json 桶都帶有正確 sourceScopeId', () => {
        const groups = buildExtAutoGroups(sourceWithScope);
        const tsGroup = groups.find(g => g.name.startsWith('.ts'));
        const jsonGroup = groups.find(g => g.name.startsWith('.json'));

        expect(tsGroup).toBeDefined();
        expect(jsonGroup).toBeDefined();
        expect(tsGroup!.sourceScopeId).toBe('scope-repo-b');
        expect(jsonGroup!.sourceScopeId).toBe('scope-repo-b');
    });

    test('sourceGroupId 指向來源群組 id', () => {
        const groups = buildExtAutoGroups(sourceWithScope);
        for (const g of groups) {
            expect(g.sourceGroupId).toBe('grp-1');
        }
    });

    test('來源群組無 sourceScopeId 時，auto group 的 sourceScopeId 為 undefined', () => {
        const sourceWithoutScope: SourceGroup = {
            id: 'grp-x',
            name: 'No Scope',
            files: ['file:///workspace/index.ts']
        };
        const groups = buildExtAutoGroups(sourceWithoutScope);
        expect(groups[0].sourceScopeId).toBeUndefined();
    });

    test('非第一個 scope 的群組產生的 auto group 不會被誤存到第一個 scope', () => {
        const scopeB: SourceGroup = {
            id: 'grp-b',
            name: 'Repo B Group',
            files: ['file:///repo-b/main.ts'],
            sourceScopeId: 'scope-b'
        };
        const scopeA: SourceGroup = {
            id: 'grp-a',
            name: 'Repo A Group',
            files: ['file:///repo-a/main.ts'],
            sourceScopeId: 'scope-a'
        };

        const bGroups = buildExtAutoGroups(scopeB);
        const aGroups = buildExtAutoGroups(scopeA);

        expect(bGroups[0].sourceScopeId).toBe('scope-b');
        expect(aGroups[0].sourceScopeId).toBe('scope-a');
        expect(bGroups[0].sourceScopeId).not.toBe(aGroups[0].sourceScopeId);
    });

    test('空 files 時回傳空陣列', () => {
        const emptySource: SourceGroup = { id: 'g', name: 'Empty', files: [], sourceScopeId: 'scope-b' };
        expect(buildExtAutoGroups(emptySource)).toHaveLength(0);
    });
});

// ─── 測試：按修改日期自動分組 ─────────────────────────────────────────────────

describe('buildDateAutoGroups — sourceScopeId 繼承', () => {
    const sourceWithScope: SourceGroup = {
        id: 'grp-2',
        name: 'Mixed Dates',
        files: ['file:///repo-b/new.ts', 'file:///repo-b/old.ts'],
        sourceScopeId: 'scope-repo-b'
    };

    const dateMap = new Map<string, string[]>([
        ['today', ['file:///repo-b/new.ts']],
        ['older', ['file:///repo-b/old.ts']]
    ]);

    test('每個 date auto group 都繼承來源群組的 sourceScopeId', () => {
        const groups = buildDateAutoGroups(sourceWithScope, dateMap);
        expect(groups.length).toBeGreaterThan(0);
        for (const g of groups) {
            expect(g.sourceScopeId).toBe('scope-repo-b');
        }
    });

    test('autoGroupType 為 modifiedDate', () => {
        const groups = buildDateAutoGroups(sourceWithScope, dateMap);
        for (const g of groups) {
            expect(g.autoGroupType).toBe('modifiedDate');
        }
    });

    test('sourceGroupId 指向來源群組 id', () => {
        const groups = buildDateAutoGroups(sourceWithScope, dateMap);
        for (const g of groups) {
            expect(g.sourceGroupId).toBe('grp-2');
        }
    });

    test('來源群組無 sourceScopeId 時，date auto group 的 sourceScopeId 為 undefined', () => {
        const sourceWithoutScope: SourceGroup = {
            id: 'grp-y',
            name: 'No Scope',
            files: ['file:///workspace/index.ts']
        };
        const groups = buildDateAutoGroups(sourceWithoutScope, new Map([['today', ['file:///workspace/index.ts']]]));
        expect(groups[0].sourceScopeId).toBeUndefined();
    });

    test('日期桶依序輸出（today 先於 older）', () => {
        const multiDateMap = new Map<string, string[]>([
            ['older', ['file:///repo-b/old.ts']],
            ['today', ['file:///repo-b/new.ts']]
        ]);
        const groups = buildDateAutoGroups(sourceWithScope, multiDateMap);
        expect(groups[0].name).toContain('today');
        expect(groups[1].name).toContain('older');
    });

    test('空 dateAssignments 時回傳空陣列', () => {
        expect(buildDateAutoGroups(sourceWithScope, new Map())).toHaveLength(0);
    });

    test('只有空陣列值的桶不產生 auto group', () => {
        const sparseMap = new Map<string, string[]>([
            ['today', []],
            ['older', ['file:///repo-b/old.ts']]
        ]);
        const groups = buildDateAutoGroups(sourceWithScope, sparseMap);
        expect(groups).toHaveLength(1);
        expect(groups[0].name).toContain('older');
    });
});

export {};
