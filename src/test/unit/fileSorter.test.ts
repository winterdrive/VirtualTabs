import * as path from 'path';
import { pathToFileURL } from 'url';
import { FileSorter } from '../../core/FileSorter';
import { PathUtils } from '../../core/PathUtils';

const base = path.resolve('/workspace/project');

function makeUri(...segments: string[]): string {
    return pathToFileURL(path.join(base, ...segments)).toString();
}

function basename(uri: string): string {
    return path.basename(PathUtils.toFsPath(uri));
}

describe('FileSorter.sortFiles', () => {
    describe('none criteria', () => {
        test('preserves original order', () => {
            const uris = [makeUri('c.ts'), makeUri('a.ts'), makeUri('b.ts')];
            const result = FileSorter.sortFiles(uris, 'none');
            expect(result.map(basename)).toEqual(['c.ts', 'a.ts', 'b.ts']);
        });

        test('returns the same array reference (no-copy optimization)', () => {
            const uris = [makeUri('c.ts'), makeUri('a.ts')];
            expect(FileSorter.sortFiles(uris, 'none')).toBe(uris);
        });
    });

    describe('name criteria', () => {
        const uris = [makeUri('c.ts'), makeUri('a.ts'), makeUri('b.ts')];

        test('asc sorts filenames A→Z', () => {
            const result = FileSorter.sortFiles(uris, 'name', 'asc');
            expect(result.map(basename)).toEqual(['a.ts', 'b.ts', 'c.ts']);
        });

        test('desc sorts filenames Z→A', () => {
            const result = FileSorter.sortFiles(uris, 'name', 'desc');
            expect(result.map(basename)).toEqual(['c.ts', 'b.ts', 'a.ts']);
        });

        test('does not mutate the input array', () => {
            const original = [makeUri('c.ts'), makeUri('a.ts'), makeUri('b.ts')];
            const snapshot = [...original];
            FileSorter.sortFiles(original, 'name', 'asc');
            expect(original).toEqual(snapshot);
        });
    });

    describe('path criteria', () => {
        const uris = [
            makeUri('src', 'c.ts'),
            makeUri('lib', 'a.ts'),
            makeUri('src', 'a.ts'),
        ];

        test('asc sorts by full path', () => {
            const result = FileSorter.sortFiles(uris, 'path', 'asc');
            const paths = result.map(u => PathUtils.toFsPath(u).toLowerCase());
            const sorted = [...paths].sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }));
            expect(paths).toEqual(sorted);
        });
    });

    describe('extension criteria', () => {
        const noExtFile = makeUri('Makefile');
        const jsFile = makeUri('bar.js');
        const tsFile1 = makeUri('foo.ts');
        const tsFile2 = makeUri('alpha.ts');
        const uris = [tsFile1, jsFile, noExtFile, tsFile2];

        test('asc puts extensionless files first', () => {
            const result = FileSorter.sortFiles(uris, 'extension', 'asc');
            expect(basename(result[0])).toBe('Makefile');
        });

        test('asc orders .js before .ts', () => {
            const result = FileSorter.sortFiles(uris, 'extension', 'asc');
            const names = result.map(basename);
            expect(names.indexOf('bar.js')).toBeLessThan(names.indexOf('foo.ts'));
        });

        test('within the same extension, files are sorted by name', () => {
            const result = FileSorter.sortFiles(uris, 'extension', 'asc');
            const tsFiles = result.map(basename).filter(n => n.endsWith('.ts'));
            expect(tsFiles).toEqual(['alpha.ts', 'foo.ts']);
        });
    });

    describe('modified criteria', () => {
        test('does not throw for non-existent files (mtime falls back to 0)', () => {
            const uris = [
                makeUri('nonexistent-c.ts'),
                makeUri('nonexistent-a.ts'),
                makeUri('nonexistent-b.ts'),
            ];
            expect(() => FileSorter.sortFiles(uris, 'modified', 'asc')).not.toThrow();
        });

        test('returns all items when all files are inaccessible', () => {
            const uris = [makeUri('ghost1.ts'), makeUri('ghost2.ts')];
            const result = FileSorter.sortFiles(uris, 'modified', 'asc');
            expect(result).toHaveLength(2);
        });
    });
});
