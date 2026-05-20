import * as fs from 'fs';
import * as path from 'path';
import {
    ActivityBar,
    CustomTreeSection,
    EditorView,
    SideBarView,
    TreeItem,
    ViewControl,
    VSBrowser,
    Workbench
} from 'vscode-extension-tester';
import { expect } from 'chai';

const fixtureRoot = path.resolve(__dirname, '../../../test-resources/multi-root');
const repoAPath = path.join(fixtureRoot, 'Repo-A');
const repoAConfigPath = path.join(repoAPath, '.vscode', 'virtualTab.json');
const repoAOriginal = [{ id: 'repo-a-existing', name: 'Repo A Existing', files: [] }];
const regressionFileRelativePath = 'src/remove-selected-file-regression.ts';
const regressionFileAbsolutePath = path.join(repoAPath, regressionFileRelativePath);
const firstGroupFileRelativePath = 'src/remove-selected-first-group.ts';
const secondGroupFileRelativePath = 'src/remove-selected-second-group.ts';
const firstGroupFileAbsolutePath = path.join(repoAPath, firstGroupFileRelativePath);
const secondGroupFileAbsolutePath = path.join(repoAPath, secondGroupFileRelativePath);

function writeConfig(configPath: string, groups: object[]): void {
    fs.writeFileSync(configPath, `${JSON.stringify(groups, null, 2)}\n`);
}

function readConfig(configPath: string): Array<{ id?: string; name?: string; files?: string[] }> {
    return JSON.parse(fs.readFileSync(configPath, 'utf8')) as Array<{ id?: string; name?: string; files?: string[] }>;
}

async function dismissOnboardingOverlay(): Promise<void> {
    const driver = VSBrowser.instance.driver;
    await driver.wait(async () => {
        return await driver.executeScript(`
            const styleId = 'virtual-tabs-e2e-hide-onboarding-remove';
            if (!document.getElementById(styleId)) {
                const style = document.createElement('style');
                style.id = styleId;
                style.textContent = '.onboarding-a-overlay { display: none !important; }';
                document.head.appendChild(style);
            }
            for (const el of document.querySelectorAll('.onboarding-a-overlay, [aria-label="Welcome to Visual Studio Code"][role="dialog"]')) {
                el.remove();
            }
            return document.querySelectorAll('.onboarding-a-overlay.visible').length === 0;
        `) as boolean;
    }, 5_000, 'Onboarding overlay did not disappear');
}

async function getVisibleTreeLabels(): Promise<string[]> {
    const driver = VSBrowser.instance.driver;
    return await driver.executeScript(`
        return Array.from(document.querySelectorAll('.monaco-list-row'))
            .map(row => row.textContent ? row.textContent.trim().replace(/\\s+/g, ' ') : '')
            .filter(Boolean);
    `) as string[];
}

async function waitForTreeLabel(label: string, timeoutMs = 15_000): Promise<void> {
    await VSBrowser.instance.driver.wait(async () => {
        const labels = await getVisibleTreeLabels();
        return labels.some(t => t.includes(label));
    }, timeoutMs, `Tree item "${label}" not found`);
}

async function waitForTreeLabelAbsent(label: string, timeoutMs = 15_000): Promise<void> {
    await VSBrowser.instance.driver.wait(async () => {
        const labels = await getVisibleTreeLabels();
        return !labels.some(t => t.includes(label));
    }, timeoutMs, `Tree item "${label}" is still visible`);
}

async function openVirtualTabsView(): Promise<SideBarView> {
    await dismissOnboardingOverlay();
    const activityBar = new ActivityBar();
    const viewControl = (await activityBar.getViewControl('Virtual Tabs')) as ViewControl;
    expect(viewControl, 'Virtual Tabs icon not found in Activity Bar').to.not.be.undefined;
    let sidebar: SideBarView;
    try {
        sidebar = await viewControl.openView() as SideBarView;
    } catch {
        await dismissOnboardingOverlay();
        await viewControl.getDriver().executeScript('arguments[0].click()', viewControl);
        sidebar = await new SideBarView().wait();
    }

    await VSBrowser.instance.driver.wait(async () => {
        const labels = await getVisibleTreeLabels();
        return labels.length > 0;
    }, 30_000, 'Virtual Tabs extension did not activate within 30 s');

    return sidebar;
}

async function getVirtualTabsSection(sidebar: SideBarView): Promise<CustomTreeSection> {
    const content = sidebar.getContent();
    return await content.getSection<CustomTreeSection>(
        section => section.getTitle().then(title => title.toLowerCase().includes('virtual tabs')),
        CustomTreeSection
    );
}

async function findTreeItem(section: CustomTreeSection, label: string, timeoutMs: number = 10_000): Promise<TreeItem> {
    const driver = VSBrowser.instance.driver;
    await driver.wait(async () => (await section.findItem(label)) !== undefined, timeoutMs, `Tree item "${label}" not found`);
    return await section.findItem(label) as TreeItem;
}

async function clickRefresh(sidebar: SideBarView): Promise<void> {
    const driver = VSBrowser.instance.driver;
    await driver.wait(async () => {
        try {
            const actions = await sidebar.getTitlePart().getActions();
            for (const action of actions) {
                const title = await action.getTitle();
                if (/refresh/i.test(title)) {
                    await action.click();
                    return true;
                }
            }
            return false;
        } catch {
            return false;
        }
    }, 10_000, 'Refresh button not found');
}

describe('Virtual Tabs - Remove selected files from group', function () {
    this.timeout(90_000);

    before(async function () {
        await VSBrowser.instance.waitForWorkbench();
        await dismissOnboardingOverlay();
    });

    after(async function () {
        await new EditorView().closeAllEditors();
        for (const filePath of [
            regressionFileAbsolutePath,
            firstGroupFileAbsolutePath,
            secondGroupFileAbsolutePath
        ]) {
            if (fs.existsSync(filePath)) {
                fs.unlinkSync(filePath);
            }
        }
        writeConfig(repoAConfigPath, repoAOriginal);
    });

    it('removes a file from a group when config stores relative file paths after reload', async function () {
        fs.mkdirSync(path.dirname(regressionFileAbsolutePath), { recursive: true });
        fs.writeFileSync(regressionFileAbsolutePath, 'export const removeSelectedFileRegression = true;\n');

        writeConfig(repoAConfigPath, [
            {
                id: 'remove-selected-regression',
                name: 'Remove Selected Regression',
                files: [regressionFileRelativePath]
            }
        ]);

        const sidebar = await openVirtualTabsView();
        await clickRefresh(sidebar);
        const section = await getVirtualTabsSection(sidebar);
        const groupItem = await findTreeItem(section, 'Remove Selected Regression');
        await groupItem.expand();
        await waitForTreeLabel('remove-selected-file-regression.ts');

        const fileItem = await findTreeItem(section, 'remove-selected-file-regression.ts');
        await fileItem.select();

        await new Workbench().executeCommand('Remove Selected Files from Group');

        await VSBrowser.instance.driver.wait(() => {
            const groups = readConfig(repoAConfigPath);
            const target = groups.find(group => group.id === 'remove-selected-regression');
            return !!target && Array.isArray(target.files) && target.files.length === 0;
        }, 15_000, 'Selected file was not removed from virtualTab.json');

        await new EditorView().closeAllEditors();
        await clickRefresh(sidebar);
        await waitForTreeLabelAbsent('remove-selected-file-regression.ts');
    });

    it('removes reloaded relative-path files from separate groups without cross-group leakage', async function () {
        fs.mkdirSync(path.dirname(firstGroupFileAbsolutePath), { recursive: true });
        fs.writeFileSync(firstGroupFileAbsolutePath, 'export const removeSelectedFirstGroup = true;\n');
        fs.writeFileSync(secondGroupFileAbsolutePath, 'export const removeSelectedSecondGroup = true;\n');

        writeConfig(repoAConfigPath, [
            {
                id: 'remove-selected-first-group',
                name: 'Remove Selected First Group',
                files: [firstGroupFileRelativePath]
            },
            {
                id: 'remove-selected-second-group',
                name: 'Remove Selected Second Group',
                files: [secondGroupFileRelativePath]
            }
        ]);

        const sidebar = await openVirtualTabsView();
        await clickRefresh(sidebar);
        const section = await getVirtualTabsSection(sidebar);

        const firstGroupItem = await findTreeItem(section, 'Remove Selected First Group');
        await firstGroupItem.expand();
        const secondGroupItem = await findTreeItem(section, 'Remove Selected Second Group');
        await secondGroupItem.expand();
        await waitForTreeLabel('remove-selected-first-group.ts');
        await waitForTreeLabel('remove-selected-second-group.ts');

        const firstFileItem = await findTreeItem(section, 'remove-selected-first-group.ts');
        await firstFileItem.select();
        await new Workbench().executeCommand('Remove Selected Files from Group');

        await VSBrowser.instance.driver.wait(() => {
            const groups = readConfig(repoAConfigPath);
            const first = groups.find(group => group.id === 'remove-selected-first-group');
            const second = groups.find(group => group.id === 'remove-selected-second-group');
            return !!first && !!second &&
                Array.isArray(first.files) && first.files.length === 0 &&
                Array.isArray(second.files) && second.files.includes(secondGroupFileRelativePath);
        }, 15_000, 'First group file was not removed or second group changed unexpectedly');
        await new EditorView().closeAllEditors();
        await clickRefresh(sidebar);
        await waitForTreeLabelAbsent('remove-selected-first-group.ts');

        const secondFileItem = await findTreeItem(section, 'remove-selected-second-group.ts');
        await secondFileItem.select();
        await new Workbench().executeCommand('Remove Selected Files from Group');

        await VSBrowser.instance.driver.wait(() => {
            const groups = readConfig(repoAConfigPath);
            const first = groups.find(group => group.id === 'remove-selected-first-group');
            const second = groups.find(group => group.id === 'remove-selected-second-group');
            return !!first && !!second &&
                Array.isArray(first.files) && first.files.length === 0 &&
                Array.isArray(second.files) && second.files.length === 0;
        }, 15_000, 'Second group file was not removed from virtualTab.json');
        await new EditorView().closeAllEditors();
        await clickRefresh(sidebar);
        await waitForTreeLabelAbsent('remove-selected-second-group.ts');
    });
});
