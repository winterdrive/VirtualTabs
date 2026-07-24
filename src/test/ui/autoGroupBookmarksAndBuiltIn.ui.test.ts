/**
 * E2E regression tests for two bugs found while manually testing v0.7.8:
 *
 *   1. Auto Group by Extension/Modified Date dropped bookmarks — PR #81 only
 *      fixed the MCP-tool layer (core/AutoGrouper.ts), never the real tree
 *      view command path (provider.ts), so bookmarks were still lost when
 *      using the actual UI. Fixed in #96.
 *   2. Auto sub-groups created from the built-in "Currently Open Files"
 *      group were invisible while a scope filter was active, and — once
 *      that was fixed — turned out to also be getting silently persisted
 *      into whichever real scope's config file happened to be first,
 *      causing them to render a second time (duplicated) after reload.
 *      Fixed in #99.
 *
 * These drive the real extension end-to-end (real VS Code, real context
 * menus, real config files on disk) specifically because the unit tests
 * added alongside #96/#99 use a hand-built provider harness with a mocked
 * `vscode` module — exactly the kind of gap that let both bugs ship
 * undetected in the first place.
 */

import * as fs from 'fs';
import * as path from 'path';
import {
    ActivityBar,
    EditorView,
    SideBarView,
    VSBrowser,
    ViewControl
} from 'vscode-extension-tester';
import { By, Key } from 'selenium-webdriver';
import { expect } from 'chai';

const fixtureRoot = path.resolve(__dirname, '../../../test-resources/multi-root');
const repoAPath = path.join(fixtureRoot, 'Repo-A');
const repoBPath = path.join(fixtureRoot, 'Repo-B');
const repoAConfigPath = path.join(repoAPath, '.vscode', 'virtualTab.json');
const repoBConfigPath = path.join(repoBPath, '.vscode', 'virtualTab.json');

const repoAOriginal = [{ id: 'repo-a-existing', name: 'Repo A Existing', files: [] }];
const repoBOriginal = [{ id: 'repo-b-existing', name: 'Repo B Existing', files: [] }];

type StoredGroup = {
    id?: string;
    name?: string;
    files?: string[];
    bookmarks?: Record<string, Array<{ id: string; line: number; label: string }>>;
    sourceGroupId?: string;
};

function writeConfig(configPath: string, groups: object[]): void {
    fs.writeFileSync(configPath, `${JSON.stringify(groups, null, 2)}\n`);
}

function readConfig(configPath: string): StoredGroup[] {
    return JSON.parse(fs.readFileSync(configPath, 'utf8')) as StoredGroup[];
}

async function dismissOnboardingOverlay(): Promise<void> {
    const driver = VSBrowser.instance.driver;
    await driver.wait(async () => {
        return await driver.executeScript(`
            const styleId = 'vt-e2e-autogroup-hide-onboarding';
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

async function dismissContextViews(): Promise<void> {
    const driver = VSBrowser.instance.driver;
    await driver.actions().sendKeys(Key.ESCAPE).perform().catch(() => undefined);
    await driver.sleep(150);
    await driver.actions().sendKeys(Key.ESCAPE).perform().catch(() => undefined);
    await driver.wait(async () => {
        const menus = await driver.findElements(By.css('.context-view.monaco-menu-container'));
        for (const menu of menus) {
            try {
                if (await menu.isDisplayed()) return false;
            } catch { /* stale */ }
        }
        return true;
    }, 2_000).catch(() => undefined);
}

async function getVisibleTreeLabels(): Promise<string[]> {
    const driver = VSBrowser.instance.driver;
    return await driver.executeScript(`
        return Array.from(document.querySelectorAll('.monaco-list-row'))
            .map(row => row.textContent ? row.textContent.trim().replace(/\\s+/g, ' ') : '')
            .filter(Boolean);
    `) as string[];
}

async function waitForTreeLabel(label: string | RegExp, timeoutMs = 15_000): Promise<void> {
    await VSBrowser.instance.driver.wait(async () => {
        const labels = await getVisibleTreeLabels();
        return typeof label === 'string'
            ? labels.some(t => t.includes(label))
            : labels.some(t => label.test(t));
    }, timeoutMs, `Tree item matching "${label}" not found`);
}

async function openVirtualTabsView(): Promise<SideBarView> {
    await dismissOnboardingOverlay();
    const activityBar = new ActivityBar();
    const viewControl = await VSBrowser.instance.driver.wait(async () => {
        await dismissOnboardingOverlay();
        return await activityBar.getViewControl('Virtual Tabs') as ViewControl | undefined;
    }, 30_000, 'Virtual Tabs icon not found in Activity Bar');
    if (!viewControl) {
        throw new Error('Virtual Tabs icon not found in Activity Bar');
    }

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
    }, 30_000, 'Virtual Tabs extension did not activate within 30s');

    return sidebar;
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
            if (name === 'StaleElementReferenceError' || name === 'ElementClickInterceptedError') return false;
            throw error;
        }
    }, 10_000, `Toolbar button matching "${titlePattern}" not found`);
}

async function reloadVirtualTabsView(): Promise<SideBarView> {
    const sidebar = await openVirtualTabsView();
    await clickToolbarButton(sidebar, /refresh/i);
    return sidebar;
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
        const items = await driver.findElements(By.css('.context-view.monaco-menu-container .action-label'));
        for (const el of items) {
            try {
                const text = (await el.getText()).trim();
                if (text === menuItemLabel || text.includes(menuItemLabel)) return el;
            } catch { /* stale */ }
        }
        return null;
    }, 6_000, `Context menu item "${menuItemLabel}" not found`) as Awaited<ReturnType<typeof driver.findElement>>;

    await item.click();
    await dismissContextViews();
}

/** Selects exactly the given labels in the "Select Scope" QuickPick (empty = show all). */
async function applyScopeFilter(labelsToSelect: string[]): Promise<void> {
    const driver = VSBrowser.instance.driver;
    await dismissContextViews();

    const selectScopeBtn = await driver.wait(async () => {
        const candidates = await driver.findElements(By.css('[aria-label*="Select Scope"], .actions-container .action-label[aria-label]'));
        for (const el of candidates) {
            const label = (await el.getAttribute('aria-label')) || '';
            if (/select scope/i.test(label)) return el;
        }
        return null;
    }, 10_000, 'Could not find "Select Scope" toolbar button') as Awaited<ReturnType<typeof driver.findElement>>;

    try {
        await selectScopeBtn.click();
    } catch {
        await driver.executeScript('arguments[0].click()', selectScopeBtn);
    }

    await driver.wait(async () => {
        try {
            const widget = await driver.findElement(By.css('.quick-input-widget'));
            return await widget.isDisplayed();
        } catch { return false; }
    }, 10_000, 'QuickPick did not appear after clicking Select Scope');

    await driver.sleep(400);

    const rows = await driver.findElements(By.css('.quick-input-list .monaco-list-row'));
    for (const row of rows) {
        const text = (await row.getText()).trim();
        const shouldCheck = labelsToSelect.some(l => text.includes(l));

        let isChecked = false;
        try {
            const checkbox = await row.findElement(By.css('input[type="checkbox"]'));
            isChecked = await checkbox.isSelected();
        } catch { /* no checkbox */ }

        if (shouldCheck !== isChecked) {
            await row.click();
            await driver.sleep(50);
        }
    }

    await driver.actions().sendKeys(Key.ENTER).perform();

    await driver.wait(async () => {
        try {
            const widget = await driver.findElement(By.css('.quick-input-widget'));
            return !(await widget.isDisplayed());
        } catch { return true; }
    }, 5_000, 'QuickPick did not close after confirmation');

    await driver.sleep(800);
}

async function resetScopeFilter(): Promise<void> {
    await applyScopeFilter([]);
}

// ─────────────────────────────────────────────────────────────────────────────

describe('Virtual Tabs – Auto Group bookmark preservation & built-in group persistence', function () {
    this.timeout(120_000);

    before(async function () {
        await VSBrowser.instance.waitForWorkbench();
        await dismissOnboardingOverlay();
    });

    afterEach(async function () {
        await new EditorView().closeAllEditors();
        writeConfig(repoAConfigPath, repoAOriginal);
        writeConfig(repoBConfigPath, repoBOriginal);
        await resetScopeFilter();
    });

    it('Auto Group by Extension moves the bookmark into the new sub-group, not just the file', async function () {
        const groupId = 'auto-group-bookmark-source';
        const groupName = 'Bookmark Auto Group Source';
        const relFile = 'src/auto-group-bookmark.ts';
        const absFile = path.join(repoAPath, relFile);

        fs.mkdirSync(path.dirname(absFile), { recursive: true });
        fs.writeFileSync(absFile, 'export const value = 1;\n');

        writeConfig(repoAConfigPath, [
            {
                id: groupId,
                name: groupName,
                files: [relFile],
                bookmarks: {
                    [relFile]: [{ id: 'bm-autogroup-1', line: 0, label: 'top of file', created: 1 }]
                }
            }
        ]);

        try {
            await reloadVirtualTabsView();
            await waitForTreeLabel(groupName);

            await rightClickAndSelectMenuItem(groupName, 'Auto Group by Extension');
            await waitForTreeLabel(`.ts @ ${groupName}`);

            await VSBrowser.instance.driver.wait(() => {
                const groups = readConfig(repoAConfigPath);
                const subGroup = groups.find(g => g.sourceGroupId === groupId);
                return !!subGroup?.bookmarks && Object.keys(subGroup.bookmarks).length > 0;
            }, 15_000, 'Auto sub-group with bookmark was not persisted');

            const groups = readConfig(repoAConfigPath);
            const source = groups.find(g => g.id === groupId);
            const subGroup = groups.find(g => g.sourceGroupId === groupId);

            expect(subGroup, 'Auto sub-group not found in config').to.not.be.undefined;
            const bookmarkEntries = subGroup?.bookmarks ? Object.entries(subGroup.bookmarks) : [];
            expect(bookmarkEntries.length, 'Bookmark was not moved to the auto sub-group').to.be.greaterThan(0);
            expect(bookmarkEntries[0][1][0]).to.include({ id: 'bm-autogroup-1', label: 'top of file' });

            // Source group must not still be holding the same bookmark.
            const sourceBookmarkKeys = source?.bookmarks ? Object.keys(source.bookmarks) : [];
            expect(sourceBookmarkKeys, 'Bookmark was left behind on the source group').to.not.include(relFile);
        } finally {
            if (fs.existsSync(absFile)) fs.unlinkSync(absFile);
        }
    });

    it('Auto Group on the built-in group stays visible under a scope filter and is not persisted into a real scope', async function () {
        const relFile = 'src/builtin-autogroup-file.ts';
        const absFile = path.join(repoAPath, relFile);
        fs.mkdirSync(path.dirname(absFile), { recursive: true });
        fs.writeFileSync(absFile, 'export const value = 2;\n');

        try {
            await reloadVirtualTabsView();
            await VSBrowser.instance.openResources(absFile);
            await waitForTreeLabel('Currently Open Files');

            // Only the built-in scope is visible — this is exactly the
            // condition under which the sub-group used to disappear.
            await applyScopeFilter(['Currently Open Files']);
            await waitForTreeLabel('Currently Open Files');

            await rightClickAndSelectMenuItem('Currently Open Files', 'Auto Group by Extension');

            // Regression #1 (fixed in #96): the sub-group must render even
            // though a scope filter is active.
            await waitForTreeLabel('.ts @ Currently Open Files');

            await resetScopeFilter();
            const sidebar = await openVirtualTabsView();
            await clickToolbarButton(sidebar, /refresh/i);
            await waitForTreeLabel('Currently Open Files');

            // Regression #2 (fixed in #99): it must never have been written
            // into either real scope's config file.
            const repoAGroups = readConfig(repoAConfigPath);
            const repoBGroups = readConfig(repoBConfigPath);
            const leaked = [...repoAGroups, ...repoBGroups].some(
                g => g.name && g.name.includes('Currently Open Files')
            );
            expect(leaked, 'Built-in auto sub-group was persisted into a real scope config file').to.be.false;
        } finally {
            if (fs.existsSync(absFile)) fs.unlinkSync(absFile);
        }
    });
});
