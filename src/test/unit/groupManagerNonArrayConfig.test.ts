/**
 * Unit test: GroupManager.loadGroups() handling of non-array JSON content.
 *
 * A config file containing valid JSON that is not an array (e.g. an object,
 * caused by disk corruption or a manual edit) must be treated the same way
 * as unparsable JSON: back it up and fall back to an empty default config,
 * rather than returning a non-array value that breaks callers relying on
 * array methods like .find/.filter.
 */

import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { GroupManager } from '../../core/GroupManager';

function makeTempWorkspace(): string {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'vt-test-'));
    fs.mkdirSync(path.join(dir, '.vscode'));
    return dir;
}

function writeRawConfig(dir: string, raw: string): void {
    fs.writeFileSync(path.join(dir, '.vscode', 'virtualTab.json'), raw, 'utf8');
}

describe('GroupManager — non-array config content', () => {
    let tmpDir: string;

    beforeEach(() => {
        tmpDir = makeTempWorkspace();
    });

    afterEach(() => {
        fs.rmSync(tmpDir, { recursive: true, force: true });
    });

    test('an object at the JSON root falls back to an empty array and backs up the file', () => {
        writeRawConfig(tmpDir, JSON.stringify({ id: 'g1', name: 'Not an array' }));

        const manager = new GroupManager(tmpDir);
        const { groups } = manager.loadGroups();

        expect(groups).toEqual([]);

        const backups = fs
            .readdirSync(path.join(tmpDir, '.vscode'))
            .filter(f => f.includes('virtualTab.json.backup.'));
        expect(backups).toHaveLength(1);
    });

    test('a bare scalar at the JSON root falls back to an empty array', () => {
        writeRawConfig(tmpDir, '42');

        const manager = new GroupManager(tmpDir);
        const { groups } = manager.loadGroups();

        expect(groups).toEqual([]);
    });

    test('null at the JSON root falls back to an empty array', () => {
        writeRawConfig(tmpDir, 'null');

        const manager = new GroupManager(tmpDir);
        const { groups } = manager.loadGroups();

        expect(groups).toEqual([]);
    });

    test('recovers to a usable default config even if backing up the corrupted file fails', () => {
        writeRawConfig(tmpDir, JSON.stringify({ id: 'g1', name: 'Not an array' }));

        // `import * as fs` is wrapped by TS's esModuleInterop helper with a
        // non-configurable getter, so spyOn must target the real module
        // object (the one the getter forwards to) to affect GroupManager's
        // own `fs` reference.
        const realFs: typeof fs = require('fs');
        const copyFileSpy = jest.spyOn(realFs, 'copyFileSync').mockImplementation(() => {
            throw new Error('EACCES: permission denied');
        });

        try {
            const manager = new GroupManager(tmpDir);
            const { groups, version } = manager.loadGroups();

            expect(groups).toEqual([]);

            // A subsequent save with the version returned above must succeed —
            // previously a backup failure left lastModified stale, so this
            // would throw OptimisticLockError forever.
            expect(() => manager.saveGroups([], version)).not.toThrow();
        } finally {
            copyFileSpy.mockRestore();
        }
    });
});
