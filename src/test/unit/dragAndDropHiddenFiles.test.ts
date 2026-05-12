/**
 * 單元測試：拖曳資料夾時隱藏資料夾過濾邏輯
 *
 * 驗證遞迴取得資料夾檔案時，應跳過以 '.' 開頭的隱藏「資料夾」，
 * 但保留以 '.' 開頭的隱藏「檔案」（如 .gitignore、.editorconfig），
 * 以與 VSCode 原生 tree view 行為保持一致。
 */

// ─── 模擬隱藏資料夾過濾邏輯 ──────────────────────────────────────────────────

interface FakeEntry {
    name: string;
    type: 'file' | 'directory';
    children?: FakeEntry[];
}

/**
 * 模擬 getFilesInDirectoryRecursive 的核心過濾邏輯：
 * 僅跳過名稱以 '.' 開頭的隱藏「資料夾」；隱藏檔案仍會納入。
 */
function getFilesRecursive(entries: FakeEntry[], parentPath = ''): string[] {
    const files: string[] = [];

    for (const entry of entries) {
        const fullPath = parentPath ? `${parentPath}/${entry.name}` : entry.name;

        if (entry.type === 'file') {
            files.push(fullPath);
        } else if (entry.type === 'directory') {
            // Skip hidden directories (names starting with '.') such as .git, .github
            // Hidden files (e.g. .gitignore) are still included.
            if (entry.name.startsWith('.')) {
                continue;
            }
            if (entry.children) {
                const subFiles = getFilesRecursive(entry.children, fullPath);
                files.push(...subFiles);
            }
        }
    }

    return files;
}

// ─── 測試 ─────────────────────────────────────────────────────────────────────

describe('拖曳資料夾時隱藏資料夾過濾', () => {
    test('應跳過以 "." 開頭的隱藏資料夾（如 .git）', () => {
        const entries: FakeEntry[] = [
            { name: 'src', type: 'directory', children: [{ name: 'index.ts', type: 'file' }] },
            { name: '.git', type: 'directory', children: [{ name: 'config', type: 'file' }] }
        ];

        const result = getFilesRecursive(entries);
        expect(result).toContain('src/index.ts');
        expect(result).not.toContain('.git/config');
    });

    test('應保留以 "." 開頭的隱藏檔案（如 .gitignore、.editorconfig）', () => {
        const entries: FakeEntry[] = [
            { name: 'README.md', type: 'file' },
            { name: '.gitignore', type: 'file' },
            { name: '.editorconfig', type: 'file' }
        ];

        const result = getFilesRecursive(entries);
        expect(result).toContain('README.md');
        expect(result).toContain('.gitignore');
        expect(result).toContain('.editorconfig');
    });

    test('應包含所有不以 "." 開頭的正常檔案', () => {
        const entries: FakeEntry[] = [
            { name: 'package.json', type: 'file' },
            { name: 'tsconfig.json', type: 'file' },
            { name: 'src', type: 'directory', children: [
                { name: 'main.ts', type: 'file' },
                { name: 'util.ts', type: 'file' }
            ]}
        ];

        const result = getFilesRecursive(entries);
        expect(result).toEqual(['package.json', 'tsconfig.json', 'src/main.ts', 'src/util.ts']);
    });

    test('應忽略隱藏資料夾中的所有子檔案', () => {
        const entries: FakeEntry[] = [
            {
                name: '.github',
                type: 'directory',
                children: [
                    { name: 'workflows', type: 'directory', children: [{ name: 'ci.yml', type: 'file' }] }
                ]
            },
            { name: 'index.ts', type: 'file' }
        ];

        const result = getFilesRecursive(entries);
        expect(result).toEqual(['index.ts']);
    });

    test('空目錄應回傳空陣列', () => {
        const result = getFilesRecursive([]);
        expect(result).toEqual([]);
    });

    test('僅含隱藏資料夾的目錄中，隱藏檔案仍應被回傳', () => {
        const entries: FakeEntry[] = [
            { name: '.git', type: 'directory', children: [] },
            { name: '.DS_Store', type: 'file' }
        ];

        const result = getFilesRecursive(entries);
        // .git directory is skipped; .DS_Store file is kept
        expect(result).toEqual(['.DS_Store']);
    });
});
