import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

jest.mock('vscode', () => ({
    workspace: {
        workspaceFolders: [] as Array<{ uri: { fsPath: string } }>
    }
}), { virtual: true });

import * as vscode from 'vscode';
import { SendToManager } from '../../sendTo';

function setWorkspaceRoot(root: string): void {
    (vscode.workspace as unknown as { workspaceFolders: Array<{ uri: { fsPath: string } } >}).workspaceFolders = [
        { uri: { fsPath: root } }
    ];
}

describe('SendToManager.loadSendTargets', () => {
    let workspaceRoot: string;

    beforeEach(() => {
        workspaceRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'vt-sendto-'));
        fs.mkdirSync(path.join(workspaceRoot, '.vscode'), { recursive: true });
        setWorkspaceRoot(workspaceRoot);
    });

    afterEach(() => {
        fs.rmSync(workspaceRoot, { recursive: true, force: true });
    });

    function writeSendTargets(sendTargets: unknown[]): void {
        const configPath = path.join(workspaceRoot, '.vscode', 'sendTargets.json');
        fs.writeFileSync(configPath, JSON.stringify({ sendTargets }), 'utf8');
    }

    test('drops entries missing a path so callers never receive an undefined destination', () => {
        writeSendTargets([
            { name: 'Valid Target' }, // missing path
            { name: 'Good Target', path: 'D:/deploy' }
        ]);

        const targets = SendToManager.loadSendTargets();

        expect(targets).toEqual([{ name: 'Good Target', path: 'D:/deploy' }]);
    });

    test('drops entries missing a name', () => {
        writeSendTargets([
            { path: 'D:/deploy' }, // missing name
            { name: 'Good Target', path: 'D:/deploy' }
        ]);

        const targets = SendToManager.loadSendTargets();

        expect(targets).toEqual([{ name: 'Good Target', path: 'D:/deploy' }]);
    });

    test('drops entries whose path array is empty or contains non-string values', () => {
        writeSendTargets([
            { name: 'Empty Array', path: [] },
            { name: 'Bad Array', path: ['D:/ok', null] },
            { name: 'Good Target', path: ['D:/one', 'D:/two'] }
        ]);

        const targets = SendToManager.loadSendTargets();

        expect(targets).toEqual([{ name: 'Good Target', path: ['D:/one', 'D:/two'] }]);
    });

    test('returns an empty array when every entry is malformed', () => {
        writeSendTargets([{ name: '' }, { path: 'D:/deploy' }, null, 'not-an-object']);

        const targets = SendToManager.loadSendTargets();

        expect(targets).toEqual([]);
    });

    test('keeps valid entries untouched', () => {
        writeSendTargets([
            { name: 'Single', path: 'D:/single' },
            { name: 'Multi', path: ['D:/a', 'D:/b'] }
        ]);

        const targets = SendToManager.loadSendTargets();

        expect(targets).toEqual([
            { name: 'Single', path: 'D:/single' },
            { name: 'Multi', path: ['D:/a', 'D:/b'] }
        ]);
    });
});
