import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { I18n } from '../i18n';

export type SkillGenerationResult =
    | { status: 'generated'; target: 'cursor' | 'vscode'; projectRoot: string; skillPath: string }
    | { status: 'cancelled'; projectRoot: string }
    | { status: 'no_workspace' };

export class SkillGenerator {
    public static getProjectRoot(): string | undefined {
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders || workspaceFolders.length === 0) {
            return undefined;
        }
        return workspaceFolders[0].uri.fsPath;
    }

    public static getMcpServerScriptPath(context: vscode.ExtensionContext): string {
        const extensionPath = context.extensionPath;
        return path.join(extensionPath, 'dist', 'mcp', 'index.js').replace(/\\/g, '/');
    }

    public static async generateSkill(context: vscode.ExtensionContext): Promise<SkillGenerationResult> {
        const projectRoot = this.getProjectRoot();
        if (!projectRoot) {
            vscode.window.showErrorMessage(I18n.getMessage('message.noWorkspaceFound') || 'No workspace opened.');
            return { status: 'no_workspace' };
        }

        const options = [
            'Cursor (.cursor/rules/virtualtabs.mdc)',
            'Antigravity (.agents/skills/virtualtabs/SKILL.md)',
            'Claude Code (.claude/skills/virtualtabs/SKILL.md)',
            'GitHub Copilot (.github/skills/virtualtabs/SKILL.md)',
            'Kiro IDE (.kiro/skills/virtualtabs/SKILL.md)',
            'Cline (.cline/skills/virtualtabs/SKILL.md)'
        ];
        const choice = await vscode.window.showQuickPick(options, {
            placeHolder: I18n.getMessage('mcp.selectAgentPlaceholder')
        });

        if (!choice) {
            return { status: 'cancelled', projectRoot };
        }

        const mcpServerScriptPath = this.getMcpServerScriptPath(context);

        if (choice.includes('Cursor')) {
            const skillPath = await this.generateCursorRule(context, projectRoot, mcpServerScriptPath);
            return { status: 'generated', target: 'cursor', projectRoot, skillPath };
        } else if (choice.includes('Antigravity')) {
            const skillPath = await this.generateVSCodeSkill(context, projectRoot, mcpServerScriptPath, '.agents');
            return { status: 'generated', target: 'vscode', projectRoot, skillPath };
        } else if (choice.includes('Claude')) {
            const skillPath = await this.generateVSCodeSkill(context, projectRoot, mcpServerScriptPath, '.claude');
            return { status: 'generated', target: 'vscode', projectRoot, skillPath };
        } else if (choice.includes('GitHub Copilot')) {
            const skillPath = await this.generateVSCodeSkill(context, projectRoot, mcpServerScriptPath, '.github');
            return { status: 'generated', target: 'vscode', projectRoot, skillPath };
        } else if (choice.includes('Kiro')) {
            const skillPath = await this.generateVSCodeSkill(context, projectRoot, mcpServerScriptPath, '.kiro');
            return { status: 'generated', target: 'vscode', projectRoot, skillPath };
        } else {
            const skillPath = await this.generateVSCodeSkill(context, projectRoot, mcpServerScriptPath, '.cline');
            return { status: 'generated', target: 'vscode', projectRoot, skillPath };
        }
    }

    private static async generateCursorRule(context: vscode.ExtensionContext, projectRoot: string, mcpServerPath: string, openDocument: boolean = true): Promise<string> {
        const rulesDir = path.join(projectRoot, '.cursor', 'rules');
        const ruleFilePath = path.join(rulesDir, 'virtualtabs.mdc');

        if (!fs.existsSync(rulesDir)) {
            fs.mkdirSync(rulesDir, { recursive: true });
        }

        const scriptRunPath = '.cursor/rules/scripts/vt.bundle.js';
        const scriptsCursorDir = path.join(projectRoot, '.cursor', 'rules', 'scripts');
        if (!fs.existsSync(scriptsCursorDir)) {
            fs.mkdirSync(scriptsCursorDir, { recursive: true });
        }
        fs.writeFileSync(path.join(scriptsCursorDir, 'vt.bundle.js'), SkillGenerator.getVtBundleContent(context), 'utf-8');

        const frontmatter = `---\ndescription: "VirtualTabs - File Group Management"\nglobs: "*"\n---\n`;
        const content = frontmatter + SkillGenerator.buildSkillBody(context, scriptRunPath);

        fs.writeFileSync(ruleFilePath, content, 'utf8');
        vscode.window.showInformationMessage(I18n.getMessage('mcp.generatedCursorRule'));

        if (openDocument) {
            const document = await vscode.workspace.openTextDocument(vscode.Uri.file(ruleFilePath));
            await vscode.window.showTextDocument(document);
        }

        return ruleFilePath;
    }

    private static async generateVSCodeSkill(context: vscode.ExtensionContext, projectRoot: string, mcpServerPath: string, agentType: '.agents' | '.claude' | '.github' | '.kiro' | '.cline' = '.github', openDocument: boolean = true): Promise<string> {
        const skillsDir = path.join(projectRoot, agentType, 'skills', 'virtualtabs');
        const mdPath = path.join(skillsDir, 'SKILL.md');

        if (!fs.existsSync(skillsDir)) {
            fs.mkdirSync(skillsDir, { recursive: true });
        }

        const skillScriptsDir = path.join(skillsDir, 'scripts');
        if (!fs.existsSync(skillScriptsDir)) {
            fs.mkdirSync(skillScriptsDir, { recursive: true });
        }
        fs.writeFileSync(path.join(skillScriptsDir, 'vt.bundle.js'), SkillGenerator.getVtBundleContent(context), 'utf-8');

        const scriptRunPath = agentType + '/skills/virtualtabs/scripts/vt.bundle.js';
        const frontmatter = `---\nname: virtualtabs\ndescription: Manages VS Code editor file groups using VirtualTabs MCP tools. Use this skill when the user wants to organize files into groups, create, rename, or delete groups, add or remove files from groups, manage bookmarks, set sorting rules, auto-group files by extension or date, or explore project structure. Also use when the user asks to help organize their workspace or work on a specific feature or topic area.\n---\n`;
        const content = frontmatter + SkillGenerator.buildSkillBody(context, scriptRunPath);

        fs.writeFileSync(mdPath, content, 'utf8');
        const relativeSkillPath = path.relative(projectRoot, mdPath).replace(/\\/g, '/');
        vscode.window.showInformationMessage(I18n.getMessage('mcp.generatedSkill', relativeSkillPath));

        if (openDocument) {
            const document = await vscode.workspace.openTextDocument(vscode.Uri.file(mdPath));
            await vscode.window.showTextDocument(document);
        }

        return mdPath;
    }

    private static buildSkillBody(context: vscode.ExtensionContext, scriptRunPath: string): string {
        const templatePath = path.join(context.extensionPath, 'dist', 'skills', 'virtualtabs', 'SKILL.md');
        const raw = fs.readFileSync(templatePath, 'utf-8');
        const body = raw.replace(/^---\n[\s\S]*?\n---\n\n?/, '');
        return body.replace(/\$\{scriptRunPath\}/g, scriptRunPath);
    }

    public static getVtBundleContent(context: vscode.ExtensionContext): string {
        const bundlePath = path.join(context.extensionPath, 'dist', 'vt.bundle.js');
        if (!fs.existsSync(bundlePath)) {
            throw new Error(`vt.bundle.js not found at ${bundlePath}. Run 'npm run build:vt' first.`);
        }
        return fs.readFileSync(bundlePath, 'utf-8');
    }
}
