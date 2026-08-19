/**
 * Unit test: ProjectExplorer.exploreProject() handling of an invalid maxResults.
 *
 * A non-positive or non-integer maxResults (e.g. 0, a negative number, or NaN)
 * must not be passed straight into Array.slice(0, maxResults) — a negative
 * value there silently drops items from the *end* of the array instead of
 * limiting the result count, which is confusing to callers (e.g. MCP tool
 * clients) expecting a simple upper bound.
 */

import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { ProjectExplorer } from '../../core/ProjectExplorer';

function makeTempWorkspace(fileCount: number): string {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'vt-test-explorer-'));
    for (let i = 0; i < fileCount; i++) {
        fs.writeFileSync(path.join(dir, `file${i}.ts`), '');
    }
    return dir;
}

describe('ProjectExplorer.exploreProject — maxResults validation', () => {
    let tmpDir: string;

    beforeEach(() => {
        tmpDir = makeTempWorkspace(5);
    });

    afterEach(() => {
        fs.rmSync(tmpDir, { recursive: true, force: true });
    });

    test('a negative maxResults falls back to the default instead of slicing from the end', async () => {
        const explorer = new ProjectExplorer(tmpDir);
        const result = await explorer.exploreProject({ maxResults: -1 });

        expect(result.files).toHaveLength(5);
        expect(result.truncated).toBe(false);
    });

    test('a zero maxResults falls back to the default', async () => {
        const explorer = new ProjectExplorer(tmpDir);
        const result = await explorer.exploreProject({ maxResults: 0 });

        expect(result.files).toHaveLength(5);
        expect(result.truncated).toBe(false);
    });

    test('a non-integer maxResults falls back to the default', async () => {
        const explorer = new ProjectExplorer(tmpDir);
        const result = await explorer.exploreProject({ maxResults: 1.5 });

        expect(result.files).toHaveLength(5);
        expect(result.truncated).toBe(false);
    });

    test('a valid positive maxResults still truncates as requested', async () => {
        const explorer = new ProjectExplorer(tmpDir);
        const result = await explorer.exploreProject({ maxResults: 2 });

        expect(result.files).toHaveLength(2);
        expect(result.truncated).toBe(true);
    });
});
