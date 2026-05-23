import * as fs from 'fs';
import * as path from 'path';
import {
    ActivityBar,
    CustomTreeSection,
    EditorView,
    SideBarView,
    TreeItem,
    ViewControl,
    VSBrowser
} from 'vscode-extension-tester';
import { expect } from 'chai';

const fixtureRoot = path.resolve(__dirname, '../../../test-resources/multi-root');
const repoAConfigPath = path.join(fixtureRoot, 'Repo-A', '.vscode', 'virtualTab.json');
const repoBConfigPath = path.join(fixtureRoot, 'Repo-B', '.vscode', 'virtualTab.json');
const repoAInitialConfig = [
    {
        id: 'repo-a-existing',
        name: 'Repo A Existing',
        files: []
    }
];
const repoBInitialConfig = [
    {
        id: 'repo-b-existing',
        name: 'Repo B Existing',
        files: []
    }
];

async function openVirtualTabsView(): Promise<SideBarView> {
    await dismissOnboardingOverlay();
    const activityBar = new ActivityBar();
    const viewControl = (await activityBar.getViewControl('Virtual Tabs')) as ViewControl;
    expect(viewControl, 'Virtual Tabs icon not found in Activity Bar').to.not.be.undefined;
    let sidebar: SideBarView;
    try {
        sidebar = await viewControl.openView() as SideBarView;
    } catch (error) {
        await dismissOnboardingOverlay();
        await viewControl.getDriver().executeScript('arguments[0].click()', viewControl);
        sidebar = await new SideBarView().wait();
    }

    // Wait for the extension to activate and the tree data provider to register.
    // The activation event (onStartupFinished) may fire after the test starts, so we
    // poll until the tree shows actual content instead of "no data provider".
    await VSBrowser.instance.driver.wait(async () => {
        const labels = await getVisibleTreeLabels();
        return labels.length > 0;
    }, 30_000, 'Virtual Tabs extension did not activate within 30 s');

    return sidebar;
}

async function dismissOnboardingOverlay(): Promise<void> {
    const driver = VSBrowser.instance.driver;
    await driver.wait(async () => {
        return await driver.executeScript(`
            const styleId = 'virtual-tabs-e2e-hide-onboarding';
            if (!document.getElementById(styleId)) {
                const style = document.createElement('style');
                style.id = styleId;
                style.textContent = [
                    '.onboarding-a-overlay { display: none !important; pointer-events: none !important; }',
                    '[aria-label="Welcome to Visual Studio Code"][role="dialog"] { display: none !important; pointer-events: none !important; }'
                ].join('\\n');
                document.head.appendChild(style);
            }

        for (const selector of [
            '.onboarding-a-overlay.visible',
            '.onboarding-a-overlay',
            '[aria-label="Welcome to Visual Studio Code"][role="dialog"]'
        ]) {
            for (const element of document.querySelectorAll(selector)) {
                element.remove();
            }
        }

            return document.querySelectorAll('.onboarding-a-overlay.visible, [aria-label="Welcome to Visual Studio Code"][role="dialog"]').length === 0;
        `) as boolean;
    }, 5_000, 'VS Code onboarding overlay did not disappear');
}

async function waitForTreeLabel(label: string, timeoutMs: number = 10_000): Promise<void> {
    const driver = VSBrowser.instance.driver;
    await driver.wait(async () => {
        const labels = await getVisibleTreeLabels();
        return labels.some(text => text === label || text.includes(label));
    }, timeoutMs, `Tree item "${label}" not found`);
}

async function getVirtualTabsSection(sidebar: SideBarView): Promise<CustomTreeSection> {
    const content = sidebar.getContent();
    return await content.getSection<CustomTreeSection>(
        (section) => section.getTitle().then(title => title.toLowerCase().includes('virtual tabs')),
        CustomTreeSection
    );
}

async function clickToolbarButton(sidebar: SideBarView, titlePattern: RegExp): Promise<void> {
    const driver = VSBrowser.instance.driver;
    await driver.wait(async () => {
        try {
            const actions = await sidebar.getTitlePart().getActions();
            for (const action of actions) {
                const title = await action.getTitle();
                if (titlePattern.test(title)) {
                    await action.click();
                    return true;
                }
            }
            return false;
        } catch (error) {
            const name = (error as Error).name;
            if (name === 'StaleElementReferenceError' || name === 'ElementClickInterceptedError') {
                return false;
            }
            throw error;
        }
    }, 10_000, `Toolbar button matching "${titlePattern}" not found`);
}
async function findTreeItem(section: CustomTreeSection, label: string, timeoutMs: number = 10_000): Promise<TreeItem> {
    const driver = VSBrowser.instance.driver;
    await driver.wait(async () => (await section.findItem(label)) !== undefined, timeoutMs, `Tree item "${label}" not found`);
    return await section.findItem(label) as TreeItem;
}

async function revealTreeRowActions(label: string): Promise<void> {
    const driver = VSBrowser.instance.driver;
    await driver.wait(async () => {
        return await driver.executeScript(`
            const row = Array.from(document.querySelectorAll('.monaco-list-row'))
                .find(element => element.textContent && element.textContent.includes(arguments[0]));
            if (!row) {
                return false;
            }

            row.scrollIntoView({ block: 'center', inline: 'nearest' });
            row.dispatchEvent(new MouseEvent('mouseover', { bubbles: true, cancelable: true, view: window }));
            row.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true, cancelable: true, view: window }));
            row.dispatchEvent(new MouseEvent('mousemove', { bubbles: true, cancelable: true, view: window }));
            return true;
        `, label) as boolean;
    }, 10_000, `Tree row "${label}" not found`);
}

async function getVisibleTreeLabels(): Promise<string[]> {
    const driver = VSBrowser.instance.driver;
    return await driver.executeScript(`
        return Array.from(document.querySelectorAll('.monaco-list-row'))
            .map(row => row.textContent ? row.textContent.trim().replace(/\\s+/g, ' ') : '')
            .filter(Boolean);
    `) as string[];
}

function readConfig(configPath: string): Array<{ name?: string }> {
    return JSON.parse(fs.readFileSync(configPath, 'utf8')) as Array<{ name?: string }>;
}

function writeConfig(configPath: string, groups: Array<{ id: string; name: string; files: string[] }>): void {
    fs.writeFileSync(configPath, `${JSON.stringify(groups, null, 2)}\n`);
}

describe('Virtual Tabs - Multi-root scopes UI', function () {
    this.timeout(60_000);

    before(async function () {
        writeConfig(repoAConfigPath, repoAInitialConfig);
        writeConfig(repoBConfigPath, repoBInitialConfig);
        await VSBrowser.instance.waitForWorkbench();
        await dismissOnboardingOverlay();
        const sidebar = await openVirtualTabsView();
        await clickToolbarButton(sidebar, /refresh/i);
    });

    after(async function () {
        await new EditorView().closeAllEditors();
        writeConfig(repoAConfigPath, repoAInitialConfig);
        writeConfig(repoBConfigPath, repoBInitialConfig);
    });

    it('shows one tree section per discovered project scope and the existing groups beneath them', async function () {
        await openVirtualTabsView();

        await waitForTreeLabel('Project: Repo-A');
        await waitForTreeLabel('Project: Repo-B');
        await waitForTreeLabel('Repo A Existing');
        await waitForTreeLabel('Repo B Existing');
    });

    it('adds a group through the Repo-A scope header and persists it only to Repo-A config', async function () {
        const sidebar = await openVirtualTabsView();
        const section = await getVirtualTabsSection(sidebar);

        const beforeA = readConfig(repoAConfigPath).map(group => group.name);
        const beforeB = readConfig(repoBConfigPath).map(group => group.name);
        const repoAHeader = await findTreeItem(section, 'Project: Repo-A');

        await revealTreeRowActions('Project: Repo-A');
        const addAction = await repoAHeader.getActionButton('Add Group to Scope');
        expect(addAction, 'Repo-A scope header does not expose Add Group to Scope').to.not.be.undefined;
        await addAction!.click();

        let nextGroupIndex = 1;
        while (beforeA.includes(`New Group ${nextGroupIndex}`)) {
            nextGroupIndex++;
        }
        const expectedName = `New Group ${nextGroupIndex}`;
        await waitForTreeLabel(expectedName);

        await VSBrowser.instance.driver.wait(() => {
            const names = readConfig(repoAConfigPath).map(group => group.name);
            return names.includes(expectedName);
        }, 10_000, `${expectedName} was not persisted to Repo-A config`);

        const afterA = readConfig(repoAConfigPath).map(group => group.name);
        const afterB = readConfig(repoBConfigPath).map(group => group.name);

        expect(afterA).to.include(expectedName);
        expect(afterB).to.deep.equal(beforeB);
    });
});
