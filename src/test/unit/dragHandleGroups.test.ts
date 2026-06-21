/**
 * 單元測試：handleDrag 的 group/editor-group 拖曳收集邏輯
 *
 * 驗證：
 * 1. builtIn group 現在可以產生拖曳 payload（不再被跳過）
 * 2. EditorGroupItem 的檔案能正確被收集
 * 3. 沒有 id 的 group 仍然被跳過
 */

// ─── 模擬資料結構 ──────────────────────────────────────────────────

interface FakeGroup {
    id: string;
    name: string;
    files?: string[];
    builtIn?: boolean;
    parentGroupId?: string;
}

/**
 * 模擬 collectGroupFilesRecursive 的核心邏輯：
 * 從指定 groupId 遞迴收集所有檔案。
 */
function collectGroupFilesRecursive(groups: FakeGroup[], groupId: string): string[] {
    const files: string[] = [];
    const visited = new Set<string>();

    const walk = (id: string) => {
        if (visited.has(id)) return;
        visited.add(id);

        const group = groups.find(g => g.id === id);
        if (!group) return;

        if (group.files) {
            files.push(...group.files);
        }

        const children = groups.filter(g => g.parentGroupId === id);
        for (const child of children) {
            if (child.id) {
                walk(child.id);
            }
        }
    };

    walk(groupId);
    return files;
}

/**
 * 模擬 handleDrag 中 groupItems 的收集邏輯（修正後版本）。
 * builtIn group 不再被跳過；只跳過沒有 id 的 group。
 */
function collectDraggedGroupFiles(
    groups: FakeGroup[],
    draggedGroupIndices: number[]
): string[] {
    const uriSet = new Set<string>();

    for (const groupIdx of draggedGroupIndices) {
        const group = groups[groupIdx];
        if (!group || !group.id) continue; // 只跳過沒有 id 的 group
        const groupFiles = collectGroupFilesRecursive(groups, group.id);
        for (const uri of groupFiles) {
            uriSet.add(uri);
        }
    }

    return Array.from(uriSet);
}

/**
 * 模擬 EditorGroupItem 收集邏輯。
 * 從 editorGroups 中找到對應 viewColumn 的 files。
 */
function collectEditorGroupFiles(
    editorGroups: Array<{ viewColumn: number; files: string[] }>,
    draggedViewColumns: number[]
): string[] {
    const uriSet = new Set<string>();

    for (const viewColumn of draggedViewColumns) {
        const eg = editorGroups.find(g => g.viewColumn === viewColumn);
        if (eg) {
            for (const uri of eg.files) {
                uriSet.add(uri);
            }
        }
    }

    return Array.from(uriSet);
}

// ─── 測試 ─────────────────────────────────────────────────────────────────────

describe('handleDrag group 收集邏輯', () => {
    const groups: FakeGroup[] = [
        {
            id: 'builtin-1',
            name: 'Currently Open Files',
            files: ['file:///workspace/a.ts', 'file:///workspace/b.ts'],
            builtIn: true
        },
        {
            id: 'custom-1',
            name: 'My Group',
            files: ['file:///workspace/c.ts']
        },
        {
            id: 'child-1',
            name: 'Child Group',
            files: ['file:///workspace/d.ts'],
            parentGroupId: 'custom-1'
        }
    ];

    test('builtIn group 拖曳時應能產生 payload', () => {
        const result = collectDraggedGroupFiles(groups, [0]);
        expect(result).toContain('file:///workspace/a.ts');
        expect(result).toContain('file:///workspace/b.ts');
    });

    test('自訂 group 拖曳應正常收集檔案（含子群組）', () => {
        const result = collectDraggedGroupFiles(groups, [1]);
        expect(result).toContain('file:///workspace/c.ts');
        expect(result).toContain('file:///workspace/d.ts');
    });

    test('沒有 id 的 group 仍應被跳過', () => {
        const groupsWithNoId: FakeGroup[] = [
            { id: '', name: 'Bad Group', files: ['file:///workspace/x.ts'] }
        ];
        const result = collectDraggedGroupFiles(groupsWithNoId, [0]);
        expect(result).toEqual([]);
    });

    test('多個 group 同時拖曳時 URI 應正確去重', () => {
        const groupsWithOverlap: FakeGroup[] = [
            { id: 'g1', name: 'G1', files: ['file:///workspace/shared.ts', 'file:///workspace/a.ts'] },
            { id: 'g2', name: 'G2', files: ['file:///workspace/shared.ts', 'file:///workspace/b.ts'] }
        ];
        const result = collectDraggedGroupFiles(groupsWithOverlap, [0, 1]);
        expect(result).toHaveLength(3);
        expect(result).toContain('file:///workspace/shared.ts');
        expect(result).toContain('file:///workspace/a.ts');
        expect(result).toContain('file:///workspace/b.ts');
    });
});

describe('EditorGroupItem 拖曳收集邏輯', () => {
    const editorGroups = [
        { viewColumn: 1, files: ['file:///workspace/left.ts', 'file:///workspace/shared.ts'] },
        { viewColumn: 2, files: ['file:///workspace/right.ts', 'file:///workspace/shared.ts'] }
    ];

    test('應收集指定 viewColumn 的所有檔案', () => {
        const result = collectEditorGroupFiles(editorGroups, [1]);
        expect(result).toEqual(['file:///workspace/left.ts', 'file:///workspace/shared.ts']);
    });

    test('多個 EditorGroupItem 同時拖曳時應去重', () => {
        const result = collectEditorGroupFiles(editorGroups, [1, 2]);
        expect(result).toHaveLength(3);
        expect(result).toContain('file:///workspace/left.ts');
        expect(result).toContain('file:///workspace/right.ts');
        expect(result).toContain('file:///workspace/shared.ts');
    });

    test('不存在的 viewColumn 應回傳空結果', () => {
        const result = collectEditorGroupFiles(editorGroups, [99]);
        expect(result).toEqual([]);
    });

    test('空的 editor groups 陣列應回傳空結果', () => {
        const result = collectEditorGroupFiles([], [1]);
        expect(result).toEqual([]);
    });
});
