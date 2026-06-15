import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { I18n } from '../i18n';

export type SkillGenerationResult =
    | { status: 'generated'; target: string; projectRoot: string; skillPaths: string[] }
    | { status: 'auto'; projectRoot: string }
    | { status: 'cancelled'; projectRoot: string }
    | { status: 'no_workspace' };

export class SkillGenerator {
    public static getMcpServerScriptPath(context: vscode.ExtensionContext): string {
        const extensionPath = context.extensionPath;
        return path.join(extensionPath, 'dist', 'mcp', 'index.js').replace(/\\/g, '/');
    }

    public static async generateSkill(context: vscode.ExtensionContext): Promise<SkillGenerationResult> {
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders || workspaceFolders.length === 0) {
            vscode.window.showErrorMessage(I18n.getMessage('message.noWorkspaceFound') || 'No workspace opened.');
            return { status: 'no_workspace' };
        }

        const isMultiRoot = workspaceFolders.length > 1;

        // Detect active editor folder — only for pre-selection hint, never skips the picker
        let detectedRoot = '';
        if (isMultiRoot) {
            const activeEditor = vscode.window.activeTextEditor;
            if (activeEditor) {
                const activeFolder = vscode.workspace.getWorkspaceFolder(activeEditor.document.uri);
                if (activeFolder) { detectedRoot = activeFolder.uri.fsPath; }
            }
        }

        interface WorkspaceOption extends vscode.QuickPickItem { uri: vscode.Uri }
        const workspaceOptions: WorkspaceOption[] = workspaceFolders.map(f => ({
            label: f.name,
            description: f.uri.fsPath,
            uri: f.uri,
        }));

        interface ModeOption extends vscode.QuickPickItem { value: 'auto' | 'manual' | '__back__' }
        interface AgentOption extends vscode.QuickPickItem { value: string }

        const agentOptions: AgentOption[] = [
            { label: '$(arrow-left) Back',          description: '',                                            value: '__back__' },
            { label: '$(file-code) Cursor',         description: '.cursor/rules/virtualtabs.mdc',              value: 'cursor' },
            { label: '$(file-code) Antigravity',    description: '.agents/skills/virtualtabs/SKILL.md',        value: 'antigravity' },
            { label: '$(file-code) Claude Code',    description: '.claude/skills/virtualtabs/SKILL.md',        value: 'claude' },
            { label: '$(file-code) GitHub Copilot', description: '.github/skills/virtualtabs/SKILL.md',        value: 'copilot' },
            { label: '$(file-code) Kiro IDE',       description: '.kiro/skills/virtualtabs/SKILL.md',          value: 'kiro' },
            { label: '$(file-code) Cline',          description: '.cline/skills/virtualtabs/SKILL.md',         value: 'cline' },
            { label: '$(file-code) Gemini CLI',     description: '.gemini/skills/virtualtabs/SKILL.md',        value: 'gemini' },
        ];

        type State = 'workspace' | 'mode' | 'agents';
        let state: State = isMultiRoot ? 'workspace' : 'mode';
        let projectRoot: string = isMultiRoot ? '' : workspaceFolders[0].uri.fsPath;

        // eslint-disable-next-line no-constant-condition
        while (true) {

            if (state === 'workspace') {
                const qp = vscode.window.createQuickPick<WorkspaceOption>();
                qp.items = workspaceOptions;
                qp.placeholder = 'Select workspace to install the skill into';
                if (detectedRoot) {
                    const hint = workspaceOptions.find(o => o.uri.fsPath === detectedRoot);
                    if (hint) { qp.activeItems = [hint]; }
                }
                const picked = await new Promise<WorkspaceOption | undefined>(resolve => {
                    qp.onDidAccept(() => resolve(qp.activeItems[0]));
                    qp.onDidHide(() => resolve(undefined));
                    qp.show();
                });
                qp.dispose();
                if (!picked) { return { status: 'cancelled', projectRoot: '' }; }
                projectRoot = picked.uri.fsPath;
                state = 'mode';
                continue;
            }

            if (state === 'mode') {
                const modeOptions: ModeOption[] = [
                    ...(isMultiRoot ? [{ label: '$(arrow-left) Back', description: 'Re-select workspace', value: '__back__' as const }] : []),
                    {
                        label: '$(cloud-download) Auto Install (Recommended)',
                        description: 'npx skills add winterdrive/vscode-virtual-tabs',
                        detail: 'Installs to all AI agents detected in your workspace',
                        value: 'auto' as const,
                    },
                    {
                        label: '$(file-code) Manual Install',
                        description: 'Pick one or more agents yourself',
                        value: 'manual' as const,
                    },
                ];
                const mode = await vscode.window.showQuickPick(modeOptions, {
                    placeHolder: isMultiRoot
                        ? `Install VirtualTabs skill into "${workspaceFolders.find(f => f.uri.fsPath === projectRoot)?.name}"`
                        : 'How do you want to install the VirtualTabs skill?',
                });
                if (!mode) { return { status: 'cancelled', projectRoot }; }
                if (mode.value === '__back__') { state = 'workspace'; continue; }
                if (mode.value === 'auto') {
                    const terminal = vscode.window.createTerminal({ name: 'VirtualTabs: Install Skill', cwd: projectRoot });
                    terminal.show(true);
                    terminal.sendText('npx skills add winterdrive/vscode-virtual-tabs');
                    return { status: 'auto', projectRoot };
                }
                state = 'agents';
                continue;
            }

            // state === 'agents'
            const choices = await vscode.window.showQuickPick(agentOptions, {
                placeHolder: 'Select one or more AI agents to generate the skill file for',
                canPickMany: true,
            });
            if (!choices || choices.length === 0) { return { status: 'cancelled', projectRoot }; }
            if (choices.some(c => c.value === '__back__')) { state = 'mode'; continue; }

            const mcpServerScriptPath = this.getMcpServerScriptPath(context);
            const skillPaths: string[] = [];

            for (const choice of choices) {
                if (choice.value === 'cursor') {
                    skillPaths.push(await this.generateCursorRule(context, projectRoot, mcpServerScriptPath));
                } else if (choice.value === 'antigravity') {
                    skillPaths.push(await this.generateVSCodeSkill(context, projectRoot, mcpServerScriptPath, '.agents'));
                } else if (choice.value === 'claude') {
                    skillPaths.push(await this.generateVSCodeSkill(context, projectRoot, mcpServerScriptPath, '.claude'));
                } else if (choice.value === 'copilot') {
                    skillPaths.push(await this.generateVSCodeSkill(context, projectRoot, mcpServerScriptPath, '.github'));
                } else if (choice.value === 'kiro') {
                    skillPaths.push(await this.generateVSCodeSkill(context, projectRoot, mcpServerScriptPath, '.kiro'));
                } else if (choice.value === 'cline') {
                    skillPaths.push(await this.generateVSCodeSkill(context, projectRoot, mcpServerScriptPath, '.cline'));
                } else if (choice.value === 'gemini') {
                    skillPaths.push(await this.generateVSCodeSkill(context, projectRoot, mcpServerScriptPath, '.gemini'));
                }
            }

            if (skillPaths.length === 0) { return { status: 'cancelled', projectRoot }; }

            const target = choices.map(c => c.value).join(', ');
            return { status: 'generated', target, projectRoot, skillPaths };
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

    private static async generateVSCodeSkill(context: vscode.ExtensionContext, projectRoot: string, mcpServerPath: string, agentType: '.agents' | '.claude' | '.github' | '.kiro' | '.cline' | '.gemini' = '.github', openDocument: boolean = true): Promise<string> {
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
