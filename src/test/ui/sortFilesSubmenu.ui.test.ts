/**
 * E2E 測試：Sort Files 子選單項目
 *
 * 依據 DEVELOPMENT.md §Menu Availability Matrix [Organization]：
 *   - "Sort Files" 子選單觸發器應出現在 Custom Group 與 Built-in Group 的右鍵選單
 *   - File 及 Bookmark 項目不應出現 "Sort Files"（已在 contextMenuAvailability 驗證 negative）
 *
 * 子選單應包含（依據 package.nls.json）：
 *   - Sort by Name
 *   - Sort by Path
 *   - Sort by Extension
 *   - Sort by Modified Time
 *   - Toggle Sort Order (Asc/Desc)
 *   - Clear Sorting (Insertion Order)
 *
 * Design notes:
 *   - getSortFilesSubmenuItems() 的邏輯與 copySubmenu 的 getCopySubmenuItems()
 *     類似：open → hover trigger → collect submenu → dismiss.
 *   - Suites collect items once in before() with a length > 0 guard.
 */

import * as fs from 'fs';
import * as path from 'path';
import {
    ActivityBar,
    EditorView,
    SideBarView,
    ViewControl,
    VSBrowser
} from 'vscode-extension-tester';
import { By, Key } from 'selenium-webdriver';
import { expect } from 'chai';

// ─── Fixture paths ─────────────────────────────────────────────────────────────

const fixtureRoot = path.resolve(__dirname, '../../../test-resources/multi-root');
const repoAPath = path.join(fixtureRoot, 'Repo-A');
const repoAConfigPath = path.join(repoAPath, '.vscode', 'virtualTab.json');
const repoAOriginal = [{ id: 'repo-a-existing', name: 'Repo A Existing', files: [] }];

// ─── Config helpers ─────────────────────────────────────────────────────────────

function writeConfig(configPath: string, groups: object[]): void {
    fs.writeFileSync(configPath, `${JSON.stringify(groups, null, 2)}\n`);
}

// ─── UI helpers ────────────────────────────────────────────────────────────────

async function dismissOnboardingOverlay(): Promise<void> {
    const driver = VSBrowser.instance.driver;
    await driver.wait(async () => {
        return await driver.executeScript(`
            const styleId = 'vt-e2e-sort-hide-onboarding';
            if (!document.getElementById(styleId)) {
                const style = document.createElement('style');
                style.id = styleId;
                style.textContent = '.onboarding-a-overlay { display: none !important; }';
                document.head.appendChild(style);
            }
            for (const el of document.querySelectorAll(
                '.onboarding-a-overlay, [aria-label="Welcome to Visual Studio Code"][role="dialog"]'
            )) { el.remove(); }
            return document.querySelectorAll('.onboarding-a-overlay.visible').length === 0;
        `) as boolean;
    }, 5_000, 'Onboarding overlay did not disappear');
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
    const closed = await driver.wait(async () => !(await isMenuOpen()), 2_000).catch(() => false);
    if (!closed) {
        const blocks = await driver.findElements(By.css('.context-view-block'));
        for (const b of blocks) { try { await b.click(); } catch { /* stale */ } }
        await driver.sleep(200);
    }
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
    }, timeoutMs, `Tree item matching "${label}" not found within ${timeoutMs}ms`);
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
            if (name === 'StaleElementReferenceError' || name === 'ElementClickInterceptedError') {
                return false;
            }
            throw error;
        }
    }, 10_000, `Toolbar button matching "${titlePattern}" not found`);
}

async function reloadVirtualTabsView(): Promise<SideBarView> {
    await dismissContextViews();
    const sidebar = await openVirtualTabsView();
    await clickToolbarButton(sidebar, /refresh/i);
    return sidebar;
}

/**
 * Opens the context menu for `rowLabel`, hovers over the "Sort Files" submenu
 * trigger, waits for the submenu to appear, collects item labels, then
 * dismisses both menus.
 */
async function getSortFilesSubmenuItems(rowLabel: string | RegExp, timeoutMs = 15_000): Promise<string[]> {
    const driver = VSBrowser.instance.driver;

    // Dismiss first so the row is found fresh.
    await dismissContextViews();

    const row = await driver.wait(async () => {
        const rows = await driver.findElements(By.css('.monaco-list-row'));
        for (const r of rows) {
            try {
                const text = (await r.getText()).trim();
                const matches = typeof rowLabel === 'string'
                    ? text.includes(rowLabel)
                    : rowLabel.test(text);
                if (matches) { return r; }
            } catch { /* stale ref */ }
        }
        return null;
    }, timeoutMs, `Tree row matching "${rowLabel}" not found`) as Awaited<ReturnType<typeof driver.findElement>>;

    await driver.actions().contextClick(row).perform();

    await driver.wait(async () => {
        try {
            const menu = await driver.findElement(By.css('.context-view.monaco-menu-container'));
            return await menu.isDisplayed();
        } catch { return false; }
    }, 6_000, 'Context menu did not appear');

    await driver.sleep(400);

    // Find and hover over "Sort Files" trigger
    const sortTrigger = await driver.wait(async () => {
        const itemEls = await driver.findElements(
            By.css('.context-view.monaco-menu-container .action-item:not(.separator) .action-label')
        );
        for (const el of itemEls) {
            try {
                if ((await el.getText()).trim() === 'Sort Files') { return el; }
            } catch { /* stale */ }
        }
        return null;
    }, 5_000, '"Sort Files" submenu trigger not found in context menu') as Awaited<ReturnType<typeof driver.findElement>>;

    await driver.actions().move({ origin: sortTrigger }).perform();

    // Wait for submenu container
    await driver.wait(async () => {
        const containers = await driver.findElements(By.css('.context-view.monaco-menu-container'));
        return containers.length >= 2;
    }, 6_000, 'Sort Files submenu did not appear');

    await driver.sleep(350);

    const containers = await driver.findElements(By.css('.context-view.monaco-menu-container'));
    const submenu = containers[containers.length - 1];
    const submenuItemEls = await submenu.findElements(
        By.css('.action-item:not(.separator) .action-label')
    );

    const labels: string[] = [];
    for (const el of submenuItemEls) {
        try {
            const txt = (await el.getText()).trim();
            if (txt) { labels.push(txt); }
        } catch { /* stale */ }
    }

    // Dismiss submenu then top-level menu, wait for backdrop to fully clear
    await dismissContextViews();
    await driver.sleep(300);

    return [...new Set(labels)];
}

// Expected sort submenu items from package.nls.json
const EXPECTED_SORT_ITEMS = [
    'Sort by Name',
    'Sort by Path',
    'Sort by Extension',
    'Sort by Modified Time',
    'Toggle Sort Order (Asc/Desc)',
    'Clear Sorting (Insertion Order)',
];

// ─────────────────────────────────────────────────────────────────────────────
// Suite I: Sort Files submenu — Custom Group
// ─────────────────────────────────────────────────────────────────────────────

describe('Sort Files Submenu – Custom Group', function () {
    this.timeout(90_000);

    const GROUP_NAME = 'CTX-Sort-Custom-Group';

    let submenuItems: string[];

    before(async function () {
        await VSBrowser.instance.waitForWorkbench();
        writeConfig(repoAConfigPath, [
            { id: 'ctx-sort-custom-group', name: GROUP_NAME, files: [] }
        ]);
        await reloadVirtualTabsView();
        await waitForTreeLabel(GROUP_NAME);

        submenuItems = await getSortFilesSubmenuItems(GROUP_NAME);

        expect(submenuItems.length, `Sort Files submenu returned no items for "${GROUP_NAME}". Items: [${submenuItems.join(', ')}]`).to.be.greaterThan(0);
    });

    after(async function () {
        await new EditorView().closeAllEditors();
        writeConfig(repoAConfigPath, repoAOriginal);
    });

    for (const item of EXPECTED_SORT_ITEMS) {
        it(`Sort Files submenu contains "${item}"`, function () {
            expect(submenuItems.some(i => i === item), `items: ${submenuItems.join(' | ')}`).to.be.true;
        });
    }
});

// ─────────────────────────────────────────────────────────────────────────────
// Suite II: Sort Files submenu — Built-in Group
// ─────────────────────────────────────────────────────────────────────────────

describe('Sort Files Submenu – Built-in Group', function () {
    this.timeout(90_000);

    const BUILTIN_RE = /currently open|open files|已開啟|目前開啟/i;

    let submenuItems: string[];

    before(async function () {
        await VSBrowser.instance.waitForWorkbench();
        writeConfig(repoAConfigPath, repoAOriginal);
        await reloadVirtualTabsView();
        await waitForTreeLabel(BUILTIN_RE);

        submenuItems = await getSortFilesSubmenuItems(BUILTIN_RE);

        expect(submenuItems.length, `Sort Files submenu returned no items for built-in group. Items: [${submenuItems.join(', ')}]`).to.be.greaterThan(0);
    });

    after(async function () {
        await new EditorView().closeAllEditors();
        writeConfig(repoAConfigPath, repoAOriginal);
    });

    for (const item of EXPECTED_SORT_ITEMS) {
        it(`Sort Files submenu contains "${item}"`, function () {
            expect(submenuItems.some(i => i === item), `items: ${submenuItems.join(' | ')}`).to.be.true;
        });
    }
});
