/**
 * Unit test: GroupManager.loadGroups() cache isolation on cache-miss path.
 *
 * Verifies that mutating the array returned by loadGroups() on a cache-miss
 * does NOT corrupt the internal cache, so a subsequent cache-hit call still
 * returns the original on-disk data.
 */

import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { GroupManager } from '../../core/GroupManager';
import type { TempGroup } from '../../types';

function makeTempWorkspace(): string {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'vt-test-'));
    fs.mkdirSync(path.join(dir, '.vscode'));
    return dir;
}

function writeConfig(dir: string, groups: TempGroup[]): void {
    fs.writeFileSync(
        path.join(dir, '.vscode', 'virtualTab.json'),
        JSON.stringify(groups, null, 2),
        'utf8'
    );
}

describe('GroupManager — cache isolation', () => {
    let tmpDir: string;

    beforeEach(() => {
        tmpDir = makeTempWorkspace();
    });

    afterEach(() => {
        fs.rmSync(tmpDir, { recursive: true, force: true });
    });

    test('mutating the cache-miss result does not corrupt subsequent cache-hit reads', () => {
        const initial: TempGroup[] = [{ id: 'g1', name: 'Group 1', files: ['a.ts'] }];
        writeConfig(tmpDir, initial);

        const manager = new GroupManager(tmpDir);

        // First call: cache miss — reads from disk
        const { groups: first } = manager.loadGroups();
        expect(first).toHaveLength(1);

        // Mutate the returned array without calling saveGroups
        first.push({ id: 'ghost', name: 'Ghost Group', files: [] });
        first[0].files = [];

        // Second call: cache hit (mtime unchanged) — must reflect the on-disk state, not the mutation
        const { groups: second } = manager.loadGroups();
        expect(second).toHaveLength(1);
        expect(second[0].id).toBe('g1');
        expect(second[0].files).toEqual(['a.ts']);
    });

    test('each loadGroups call returns an independent copy', () => {
        const initial: TempGroup[] = [{ id: 'g1', name: 'Group 1', files: ['a.ts'] }];
        writeConfig(tmpDir, initial);

        const manager = new GroupManager(tmpDir);

        const { groups: a } = manager.loadGroups();
        const { groups: b } = manager.loadGroups();

        // Must be distinct object references
        expect(a).not.toBe(b);
        expect(a[0]).not.toBe(b[0]);
    });
});
