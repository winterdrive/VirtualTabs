/**
 * E2E 測試：Copy... 子選單項目
 *
 * 依據 DEVELOPMENT.md §Menu Availability Matrix [Copy Menu]：
 *   所有 item type（Custom Group, Built-in Group, File (Custom),
 *   File (Built-in), Bookmark）都應出現 "Copy..." 觸發器，
 *   且子選單內應包含：
 *     - Copy Name
 *     - Copy Context for AI
 *     - Copy File Name
 *     - Copy File Paths  (group-level only: "Copy File Paths" maps to copyGroupPaths)
 *     - Copy Relative Path
 *     - Copy Absolute Path
 *
 * Design notes:
 *   - getCopySubmenuItems() opens the context menu, hovers over "Copy...",
 *     waits for the submenu to appear, collects labels, then dismisses.
 *   - Each suite collects submenu items ONCE in before() with a guard that
 *     length > 0, so negative tests cannot trivially pass on an empty array.
 */

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

// ─── Fixture paths ─────────────────────────────────────────────────────────────

const fixtureRoot = path.resolve(__dirname, '../../../test-resources/multi-root');
const repoAPath = path.join(fixtureRoot, 'Repo-A');
const repoAConfigPath = path.join(repoAPath, '.vscode', 'virtualTab.json');
const repoAOriginal = [{ id: 'repo-a-existing', name: 'Repo A Existing', files: [] }];

const testFileRelPath = 'src/copy-menu-test.ts';
const testFileAbsPath = path.join(repoAPath, testFileRelPath);

// ─── Config helpers ─────────────────────────────────────────────────────────────

function writeConfig(configPath: string, groups: object[]): void {
    fs.writeFileSync(configPath, `${JSON.stringify(groups, null, 2)}\n`);
}

// ─── UI helpers ────────────────────────────────────────────────────────────────

async function dismissOnboardingOverlay(): Promise<void> {
    const driver = VSBrowser.instance.driver;
    await driver.wait(async () => {
        return await driver.executeScript(`
            const styleId = 'vt-e2e-copy-hide-onboarding';
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

async function getVirtualTabsSection(sidebar: SideBarView): Promise<CustomTreeSection> {
    const content = sidebar.getContent();
    return await content.getSection<CustomTreeSection>(
        section => section.getTitle().then(title => title.toLowerCase().includes('virtual tabs')),
        CustomTreeSection
    );
}

async function findTreeItem(section: CustomTreeSection, label: string, timeoutMs = 10_000): Promise<TreeItem> {
    const driver = VSBrowser.instance.driver;
    await driver.wait(
        async () => (await section.findItem(label)) !== undefined,
        timeoutMs,
        `Tree item "${label}" not found`
    );
    return (await section.findItem(label)) as TreeItem;
}

/**
 * Opens the context menu for `rowLabel`, hovers over the "Copy..." submenu
 * trigger, waits for the submenu to appear, collects item labels, then
 * dismisses both menus with Escape.
 *
 * Returns deduplicated item labels from the Copy submenu.
 * Throws if:
 *   - the row is not found
 *   - the top-level context menu does not appear
 *   - the "Copy..." trigger is not found within the top-level menu
 *   - the submenu does not produce any new menu container
 */
async function getCopySubmenuItems(rowLabel: string | RegExp, timeoutMs = 15_000, preClick = false): Promise<string[]> {
    const driver = VSBrowser.instance.driver;

    // Dismiss first so the row is found fresh.
    await dismissContextViews();

    // Find the tree row
    const row = await driver.wait(async () => {
        const rows = await driver.findElements(By.css('.monaco-list-row'));
        for (const r of rows) {
            try {
                const text = (await r.getText()).trim();
                const matches = typeof rowLabel === 'string'
                    ? text.includes(rowLabel)
                    : rowLabel.test(text);
                if (matches) { return r; }
            } catch { /* stale ref — retry */ }
        }
        return null;
    }, timeoutMs, `Tree row matching "${rowLabel}" not found`) as Awaited<ReturnType<typeof driver.findElement>>;

    // Re-establish selection so hasFileSelected is true when the menu opens.
    if (preClick) {
        await driver.actions().click(row).perform();
        await driver.sleep(400);
    }

    // Open context menu
    await driver.actions().contextClick(row).perform();

    await driver.wait(async () => {
        try {
            const menu = await driver.findElement(By.css('.context-view.monaco-menu-container'));
            return await menu.isDisplayed();
        } catch { return false; }
    }, 6_000, 'Context menu did not appear');

    await driver.sleep(400);

    // Find and hover over "Copy..." trigger in the top-level menu
    const copyTrigger = await driver.wait(async () => {
        const itemEls = await driver.findElements(
            By.css('.context-view.monaco-menu-container .action-item:not(.separator) .action-label')
        );
        for (const el of itemEls) {
            try {
                if ((await el.getText()).trim() === 'Copy...') { return el; }
            } catch { /* stale */ }
        }
        return null;
    }, 5_000, '"Copy..." submenu trigger not found in context menu') as Awaited<ReturnType<typeof driver.findElement>>;

    await driver.actions().move({ origin: copyTrigger }).perform();

    // Wait for the submenu container to appear (second .monaco-menu-container)
    await driver.wait(async () => {
        const containers = await driver.findElements(By.css('.context-view.monaco-menu-container'));
        return containers.length >= 2;
    }, 6_000, 'Copy... submenu did not appear');

    await driver.sleep(350);

    // The last container is the submenu
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

// ─────────────────────────────────────────────────────────────────────────────
// Suite A: Copy submenu — Custom Group
// ─────────────────────────────────────────────────────────────────────────────

describe('Copy Submenu – Custom Group', function () {
    this.timeout(90_000);

    const GROUP_NAME = 'CTX-Copy-Custom-Group';

    let submenuItems: string[];

    before(async function () {
        await VSBrowser.instance.waitForWorkbench();
        writeConfig(repoAConfigPath, [
            { id: 'ctx-copy-custom-group', name: GROUP_NAME, files: [] }
        ]);
        await reloadVirtualTabsView();
        await waitForTreeLabel(GROUP_NAME);

        submenuItems = await getCopySubmenuItems(GROUP_NAME);

        expect(submenuItems.length, `Copy submenu returned no items for group "${GROUP_NAME}". Items: [${submenuItems.join(', ')}]`).to.be.greaterThan(0);
    });

    after(async function () {
        await new EditorView().closeAllEditors();
        writeConfig(repoAConfigPath, repoAOriginal);
    });

    it('Copy submenu contains "Copy Name"', function () {
        expect(submenuItems.some(i => i === 'Copy Name'), `items: ${submenuItems.join(' | ')}`).to.be.true;
    });

    it('Copy submenu contains "Copy Context for AI"', function () {
        expect(submenuItems.some(i => i === 'Copy Context for AI'), `items: ${submenuItems.join(' | ')}`).to.be.true;
    });

    it('Copy submenu contains "Copy File Name"', function () {
        expect(submenuItems.some(i => i === 'Copy File Name'), `items: ${submenuItems.join(' | ')}`).to.be.true;
    });

    it('Copy submenu contains "Copy Relative Path"', function () {
        expect(submenuItems.some(i => i === 'Copy Relative Path'), `items: ${submenuItems.join(' | ')}`).to.be.true;
    });

    it('Copy submenu contains "Copy Absolute Path"', function () {
        expect(submenuItems.some(i => i === 'Copy Absolute Path'), `items: ${submenuItems.join(' | ')}`).to.be.true;
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// Suite B: Copy submenu — Built-in Group
// ─────────────────────────────────────────────────────────────────────────────

describe('Copy Submenu – Built-in Group', function () {
    this.timeout(90_000);

    const BUILTIN_RE = /currently open|open files|已開啟|目前開啟/i;

    let submenuItems: string[];

    before(async function () {
        await VSBrowser.instance.waitForWorkbench();
        writeConfig(repoAConfigPath, repoAOriginal);
        await reloadVirtualTabsView();
        await waitForTreeLabel(BUILTIN_RE);

        submenuItems = await getCopySubmenuItems(BUILTIN_RE);

        expect(submenuItems.length, `Copy submenu returned no items for built-in group. Items: [${submenuItems.join(', ')}]`).to.be.greaterThan(0);
    });

    after(async function () {
        await new EditorView().closeAllEditors();
        writeConfig(repoAConfigPath, repoAOriginal);
    });

    it('Copy submenu contains "Copy Name"', function () {
        expect(submenuItems.some(i => i === 'Copy Name'), `items: ${submenuItems.join(' | ')}`).to.be.true;
    });

    it('Copy submenu contains "Copy Context for AI"', function () {
        expect(submenuItems.some(i => i === 'Copy Context for AI'), `items: ${submenuItems.join(' | ')}`).to.be.true;
    });

    it('Copy submenu contains "Copy File Name"', function () {
        expect(submenuItems.some(i => i === 'Copy File Name'), `items: ${submenuItems.join(' | ')}`).to.be.true;
    });

    it('Copy submenu contains "Copy Relative Path"', function () {
        expect(submenuItems.some(i => i === 'Copy Relative Path'), `items: ${submenuItems.join(' | ')}`).to.be.true;
    });

    it('Copy submenu contains "Copy Absolute Path"', function () {
        expect(submenuItems.some(i => i === 'Copy Absolute Path'), `items: ${submenuItems.join(' | ')}`).to.be.true;
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// Suite C: Copy submenu — File in Custom Group
// ─────────────────────────────────────────────────────────────────────────────

describe('Copy Submenu – File (Custom Group)', function () {
    this.timeout(90_000);

    const GROUP_NAME = 'CTX-Copy-FileCustom-Group';
    const FILE_BASENAME = path.basename(testFileAbsPath);

    let submenuItems: string[];

    before(async function () {
        await VSBrowser.instance.waitForWorkbench();

        fs.mkdirSync(path.dirname(testFileAbsPath), { recursive: true });
        fs.writeFileSync(testFileAbsPath, '// copy submenu test fixture\nexport const copyMenuTest = true;\n');

        writeConfig(repoAConfigPath, [
            { id: 'ctx-copy-filecustom-group', name: GROUP_NAME, files: [testFileRelPath] }
        ]);

        const sidebar = await reloadVirtualTabsView();
        await waitForTreeLabel(GROUP_NAME);

        const section = await getVirtualTabsSection(sidebar);
        const groupItem = await findTreeItem(section, GROUP_NAME);
        await groupItem.expand();
        await waitForTreeLabel(FILE_BASENAME);

        // Left-click to set virtualTabs:hasFileSelected
        const driver = VSBrowser.instance.driver;
        await driver.wait(async () => {
            const rows = await driver.findElements(By.css('.monaco-list-row'));
            for (const r of rows) {
                try {
                    if ((await r.getText()).includes(FILE_BASENAME)) {
                        await r.click();
                        return true;
                    }
                } catch { /* stale */ }
            }
            return false;
        }, 10_000, `Could not left-click file row "${FILE_BASENAME}"`);
        await driver.sleep(500);

        submenuItems = await getCopySubmenuItems(FILE_BASENAME, 15_000, true);

        expect(submenuItems.length, `Copy submenu returned no items for file "${FILE_BASENAME}". Items: [${submenuItems.join(', ')}]`).to.be.greaterThan(0);
    });

    after(async function () {
        await new EditorView().closeAllEditors();
        if (fs.existsSync(testFileAbsPath)) { fs.unlinkSync(testFileAbsPath); }
        writeConfig(repoAConfigPath, repoAOriginal);
    });

    it('Copy submenu contains "Copy Name"', function () {
        expect(submenuItems.some(i => i === 'Copy Name'), `items: ${submenuItems.join(' | ')}`).to.be.true;
    });

    it('Copy submenu contains "Copy Context for AI"', function () {
        expect(submenuItems.some(i => i === 'Copy Context for AI'), `items: ${submenuItems.join(' | ')}`).to.be.true;
    });

    it('Copy submenu contains "Copy File Name"', function () {
        expect(submenuItems.some(i => i === 'Copy File Name'), `items: ${submenuItems.join(' | ')}`).to.be.true;
    });

    it('Copy submenu contains "Copy Relative Path"', function () {
        expect(submenuItems.some(i => i === 'Copy Relative Path'), `items: ${submenuItems.join(' | ')}`).to.be.true;
    });

    it('Copy submenu contains "Copy Absolute Path"', function () {
        expect(submenuItems.some(i => i === 'Copy Absolute Path'), `items: ${submenuItems.join(' | ')}`).to.be.true;
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// Suite D: Copy submenu — File in Built-in Group
// ─────────────────────────────────────────────────────────────────────────────

describe('Copy Submenu – File (Built-in Group)', function () {
    this.timeout(90_000);

    const FILE_BASENAME = path.basename(testFileAbsPath);

    let submenuItems: string[];

    before(async function () {
        await VSBrowser.instance.waitForWorkbench();

        fs.mkdirSync(path.dirname(testFileAbsPath), { recursive: true });
        fs.writeFileSync(testFileAbsPath, '// copy submenu built-in test\nexport const copyBuiltIn = true;\n');

        writeConfig(repoAConfigPath, repoAOriginal);
        await reloadVirtualTabsView();

        // Open the file so it appears in "Currently Open Files"
        await VSBrowser.instance.openResources(testFileAbsPath);
        await reloadVirtualTabsView();

        // Give the extension time to process onDidChangeVisibleTextEditors,
        // then expand the built-in group so the file is visible in tree rows.
        const driver = VSBrowser.instance.driver;
        await driver.sleep(800);
        await driver.wait(async () => {
            const rows = await driver.findElements(By.css('.monaco-list-row'));
            for (const r of rows) {
                try {
                    const text = (await r.getText()).trim();
                    if (/currently open|open files|已開啟|目前開啟/i.test(text)) {
                        const expanded = await r.getAttribute('aria-expanded');
                        if (expanded === 'false') { await r.click(); }
                        return true;
                    }
                } catch { /* stale */ }
            }
            return false;
        }, 10_000, 'Built-in group not found for expansion after openResources()');

        await waitForTreeLabel(FILE_BASENAME);

        await driver.wait(async () => {
            const rows = await driver.findElements(By.css('.monaco-list-row'));
            for (const r of rows) {
                try {
                    if ((await r.getText()).includes(FILE_BASENAME)) {
                        await r.click();
                        return true;
                    }
                } catch { /* stale */ }
            }
            return false;
        }, 10_000, `Could not click built-in file row "${FILE_BASENAME}"`);
        await driver.sleep(500);

        submenuItems = await getCopySubmenuItems(FILE_BASENAME, 15_000, true);

        expect(submenuItems.length, `Copy submenu returned no items for built-in file "${FILE_BASENAME}". Items: [${submenuItems.join(', ')}]`).to.be.greaterThan(0);
    });

    after(async function () {
        await new EditorView().closeAllEditors();
        if (fs.existsSync(testFileAbsPath)) { fs.unlinkSync(testFileAbsPath); }
        writeConfig(repoAConfigPath, repoAOriginal);
    });

    it('Copy submenu contains "Copy Name"', function () {
        expect(submenuItems.some(i => i === 'Copy Name'), `items: ${submenuItems.join(' | ')}`).to.be.true;
    });

    it('Copy submenu contains "Copy Context for AI"', function () {
        expect(submenuItems.some(i => i === 'Copy Context for AI'), `items: ${submenuItems.join(' | ')}`).to.be.true;
    });

    it('Copy submenu contains "Copy File Name"', function () {
        expect(submenuItems.some(i => i === 'Copy File Name'), `items: ${submenuItems.join(' | ')}`).to.be.true;
    });

    it('Copy submenu contains "Copy Relative Path"', function () {
        expect(submenuItems.some(i => i === 'Copy Relative Path'), `items: ${submenuItems.join(' | ')}`).to.be.true;
    });

    it('Copy submenu contains "Copy Absolute Path"', function () {
        expect(submenuItems.some(i => i === 'Copy Absolute Path'), `items: ${submenuItems.join(' | ')}`).to.be.true;
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// Suite E: Copy submenu — Bookmark
// ─────────────────────────────────────────────────────────────────────────────

describe('Copy Submenu – Bookmark', function () {
    this.timeout(90_000);

    const GROUP_NAME = 'CTX-Copy-Bookmark-Group';
    const BOOKMARK_LABEL = 'CTX Copy Submenu Bookmark';

    let submenuItems: string[];

    before(async function () {
        await VSBrowser.instance.waitForWorkbench();

        fs.mkdirSync(path.dirname(testFileAbsPath), { recursive: true });
        fs.writeFileSync(testFileAbsPath, '// copy submenu bookmark test\nexport const copyBmTest = true;\n');

        const fileUri = testFileRelPath;

        writeConfig(repoAConfigPath, [
            {
                id: 'ctx-copy-bookmark-group',
                name: GROUP_NAME,
                files: [testFileRelPath],
                bookmarks: {
                    [fileUri]: [
                        { id: 'ctx-copy-bm-1', line: 0, label: BOOKMARK_LABEL, created: Date.now() }
                    ]
                }
            }
        ]);

        const sidebar = await reloadVirtualTabsView();
        await waitForTreeLabel(GROUP_NAME);

        const section = await getVirtualTabsSection(sidebar);
        const groupItem = await findTreeItem(section, GROUP_NAME);
        await groupItem.expand();

        const fileBasename = path.basename(testFileAbsPath);
        await waitForTreeLabel(fileBasename);

        const fileItem = await findTreeItem(section, fileBasename);
        await fileItem.expand();
        await waitForTreeLabel(BOOKMARK_LABEL);

        submenuItems = await getCopySubmenuItems(BOOKMARK_LABEL);

        expect(submenuItems.length, `Copy submenu returned no items for bookmark "${BOOKMARK_LABEL}". Items: [${submenuItems.join(', ')}]`).to.be.greaterThan(0);
    });

    after(async function () {
        await new EditorView().closeAllEditors();
        if (fs.existsSync(testFileAbsPath)) { fs.unlinkSync(testFileAbsPath); }
        writeConfig(repoAConfigPath, repoAOriginal);
    });

    it('Copy submenu contains "Copy Name"', function () {
        expect(submenuItems.some(i => i === 'Copy Name'), `items: ${submenuItems.join(' | ')}`).to.be.true;
    });

    it('Copy submenu contains "Copy Context for AI"', function () {
        expect(submenuItems.some(i => i === 'Copy Context for AI'), `items: ${submenuItems.join(' | ')}`).to.be.true;
    });

    it('Copy submenu contains "Copy File Name"', function () {
        expect(submenuItems.some(i => i === 'Copy File Name'), `items: ${submenuItems.join(' | ')}`).to.be.true;
    });

    it('Copy submenu contains "Copy Relative Path"', function () {
        expect(submenuItems.some(i => i === 'Copy Relative Path'), `items: ${submenuItems.join(' | ')}`).to.be.true;
    });

    it('Copy submenu contains "Copy Absolute Path"', function () {
        expect(submenuItems.some(i => i === 'Copy Absolute Path'), `items: ${submenuItems.join(' | ')}`).to.be.true;
    });
});
