jest.mock('vscode', () => ({}), { virtual: true });

import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { SkillGenerator } from '../../mcp/SkillGenerator';

type BuildSkillBody = (context: { extensionPath: string }, scriptRunPath: string) => string;
const buildSkillBody = (SkillGenerator as unknown as { buildSkillBody: BuildSkillBody }).buildSkillBody;

function makeExtensionDir(): string {
    return fs.mkdtempSync(path.join(os.tmpdir(), 'vt-skillgen-test-'));
}

describe('SkillGenerator.buildSkillBody', () => {
    test('throws a clear, actionable error when the packaged SKILL.md template is missing', () => {
        const extensionPath = makeExtensionDir();
        try {
            expect(() => buildSkillBody({ extensionPath }, 'scripts/vt.bundle.js'))
                .toThrow(/SKILL\.md template not found.*npm run build:skills/);
        } finally {
            fs.rmSync(extensionPath, { recursive: true, force: true });
        }
    });

    test('strips the frontmatter and substitutes scriptRunPath when the template exists', () => {
        const extensionPath = makeExtensionDir();
        try {
            const templateDir = path.join(extensionPath, 'dist', 'skills', 'virtualtabs');
            fs.mkdirSync(templateDir, { recursive: true });
            fs.writeFileSync(
                path.join(templateDir, 'SKILL.md'),
                '---\nname: virtualtabs\n---\n\nRun ${scriptRunPath} to use the tool.',
                'utf-8'
            );

            const body = buildSkillBody({ extensionPath }, '.claude/skills/virtualtabs/scripts/vt.bundle.js');

            expect(body).not.toContain('---');
            expect(body).toBe('Run .claude/skills/virtualtabs/scripts/vt.bundle.js to use the tool.');
        } finally {
            fs.rmSync(extensionPath, { recursive: true, force: true });
        }
    });
});
