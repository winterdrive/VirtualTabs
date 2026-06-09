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
import { By, Key } from 'selenium-webdriver';
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

function readConfig(configPath: string): Array<{ name?: string; auto?: boolean }> {
    return JSON.parse(fs.readFileSync(configPath, 'utf8')) as Array<{ name?: string; auto?: boolean }>;
}

function writeConfig(configPath: string, groups: Array<{ id: string; name: string; files: string[] }>): void {
    fs.writeFileSync(configPath, `${JSON.stringify(groups, null, 2)}\n`);
}

async function dismissContextViews(): Promise<void> {
    const driver = VSBrowser.instance.driver;
    const isMenuOpen = async (): Promise<boolean> => {
        const menus = await driver.findElements(By.css('.context-view.monaco-menu-container'));
        for (const menu of menus) {
            try { if (await menu.isDisplayed()) return true; } catch { /* stale */ }
        }
        return false;
    };
    if (!(await isMenuOpen())) return;
    await driver.actions().sendKeys(Key.ESCAPE).perform().catch(() => undefined);
    await driver.sleep(150);
    await driver.actions().sendKeys(Key.ESCAPE).perform().catch(() => undefined);
    await driver.wait(async () => !(await isMenuOpen()), 2_000).catch(() => false);
}

async function rightClickAndSelectMenuItem(rowLabel: string, menuItemLabel: string): Promise<void> {
    const driver = VSBrowser.instance.driver;
    await dismissContextViews();

    const row = await driver.wait(async () => {
        const rows = await driver.findElements(By.css('.monaco-list-row'));
        for (const r of rows) {
            try {
                const text = (await r.getText()).trim();
                if (text.includes(rowLabel)) return r;
            } catch { /* stale */ }
        }
        return null;
    }, 10_000, `Tree row "${rowLabel}" not found`) as Awaited<ReturnType<typeof driver.findElement>>;

    await driver.actions().click(row).perform();
    await driver.sleep(300);
    await driver.actions().contextClick(row).perform();

    await driver.wait(async () => {
        try {
            const menu = await driver.findElement(By.css('.context-view.monaco-menu-container'));
            return await menu.isDisplayed();
        } catch { return false; }
    }, 6_000, 'Context menu did not appear');

    await driver.sleep(300);

    const item = await driver.wait(async () => {
        const items = await driver.findElements(
            By.css('.context-view.monaco-menu-container .action-label')
        );
        for (const it of items) {
            try {
                const text = (await it.getText()).trim();
                if (text === menuItemLabel) return it;
            } catch { /* stale */ }
        }
        return null;
    }, 5_000, `Context menu item "${menuItemLabel}" not found`) as Awaited<ReturnType<typeof driver.findElement>>;

    await item.click();
    await driver.sleep(500);
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

    describe('auto group scope isolation (Issue #56)', function () {
        const autoGroupSourceConfig = [
            {
                id: 'repo-b-auto-test',
                name: 'Repo B Auto Test',
                files: ['src/main.ts', 'config/app.json']
            }
        ];

        before(async function () {
            writeConfig(repoBConfigPath, autoGroupSourceConfig);
            const sidebar = await openVirtualTabsView();
            await clickToolbarButton(sidebar, /refresh/i);
            await waitForTreeLabel('Repo B Auto Test');
        });

        after(async function () {
            writeConfig(repoBConfigPath, repoBInitialConfig);
            const sidebar = await openVirtualTabsView();
            await clickToolbarButton(sidebar, /refresh/i);
        });

        it('auto group by extension on Repo-B group saves auto groups only to Repo-B config', async function () {
            await rightClickAndSelectMenuItem('Repo B Auto Test', 'Auto Group by Extension');

            // Auto groups should appear in the tree
            await waitForTreeLabel('.ts @ Repo B Auto Test', 15_000);

            // Wait for Repo-B config to be persisted
            await VSBrowser.instance.driver.wait(() => {
                const names = readConfig(repoBConfigPath).map(g => g.name);
                return names.some(n => n && n.includes('.ts @ Repo B Auto Test'));
            }, 10_000, 'Auto group .ts was not persisted to Repo-B config');

            const repoBGroups = readConfig(repoBConfigPath);
            const repoAGroups = readConfig(repoAConfigPath);

            // Both extension buckets saved to Repo-B
            expect(repoBGroups.some(g => g.name && g.name.includes('.ts @ Repo B Auto Test'))).to.be.true;
            expect(repoBGroups.some(g => g.name && g.name.includes('.json @ Repo B Auto Test'))).to.be.true;

            // Repo-A config must be untouched
            expect(repoAGroups.some(g => g.name && g.name.includes('Auto Test'))).to.be.false;
        });

        it('auto group by modified date on Repo-B group saves auto groups only to Repo-B config', async function () {
            // Reset Repo-B config before this test so previous auto groups don't interfere
            writeConfig(repoBConfigPath, autoGroupSourceConfig);
            const sidebar = await openVirtualTabsView();
            await clickToolbarButton(sidebar, /refresh/i);
            await waitForTreeLabel('Repo B Auto Test');

            await rightClickAndSelectMenuItem('Repo B Auto Test', 'Auto Group by Modified Date');

            // At least one date bucket should appear
            await VSBrowser.instance.driver.wait(async () => {
                const labels = await getVisibleTreeLabels();
                return labels.some(l => l.includes('@ Repo B Auto Test'));
            }, 15_000, 'No date auto group appeared under Repo B Auto Test');

            // Wait for persistence
            await VSBrowser.instance.driver.wait(() => {
                const groups = readConfig(repoBConfigPath);
                return groups.some(g => g.auto === true);
            }, 10_000, 'Date auto groups were not persisted to Repo-B config');

            const repoBGroups = readConfig(repoBConfigPath);
            const repoAGroups = readConfig(repoAConfigPath);

            // Date auto groups landed in Repo-B
            expect(repoBGroups.some(g => g.auto === true)).to.be.true;

            // Repo-A config must be untouched
            expect(repoAGroups.some(g => g.auto === true)).to.be.false;
        });
    });
});
