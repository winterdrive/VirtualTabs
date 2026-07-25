/**
 * E2E 測試：Auto Group by Extension/Date 的兩個修復
 *
 *   1. 對有書籤的自訂群組跑 Auto Group by Extension，書籤應跟著檔案
 *      移到新建立的子群組，而不是消失（provider.ts addAutoGroupsByExt /
 *      autoGroupByModifiedDate 未呼叫 AutoGrouper.moveBookmarks 的回歸）。
 *   2. 在 scope 篩選只顯示「目前已開啟檔案」時，對內建群組跑 Auto Group，
 *      新建立的子群組仍應可見（getChildren() 篩選分支只認 group.builtIn，
 *      排除了 sourceGroupId 指向內建群組但自身不是 builtIn 的子群組）。
 */

import * as fs from 'fs';
import * as path from 'path';
import {
    ActivityBar,
    EditorView,
    SideBarView,
    VSBrowser,
    ViewControl,
    Workbench
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

const bookmarkGroupId = 'autogroup-bookmark-src-group';
const bookmarkGroupName = 'AutoGroup Bookmark Source';
const tsFileRelative = 'src/autogroup-ts-file.ts';
const tsFileAbsolute = path.join(repoAPath, tsFileRelative);
const mdFileRelative = 'README.md';
const mdFileAbsolute = path.join(repoAPath, mdFileRelative);

function writeConfig(configPath: string, groups: object[]): void {
    fs.writeFileSync(configPath, `${JSON.stringify(groups, null, 2)}\n`);
}

/**
 * provider.ts rewrites absolute file:// URIs to workspace-relative paths
 * (and rewrites bookmark keys the same way) whenever it persists groups —
 * see toRelativePath()/toRelativeBookmarks(). Config-file assertions must
 * compare against the relative form, not the absolute URI used to seed
 * the fixture.
 */
function normalizeRelativePath(p: string): string {
    return p.replace(/\\/g, '/').toLowerCase();
}

function readConfig(configPath: string): Array<{
    id?: string;
    name?: string;
    files?: string[];
    sourceGroupId?: string;
    bookmarks?: Record<string, unknown[]>;
}> {
    return JSON.parse(fs.readFileSync(configPath, 'utf8'));
}

function toLowerDriveFileUri(absPath: string): string {
    const normalized = absPath.replace(/\\/g, '/');
    const withLowerDrive = normalized.replace(/^([A-Za-z]):/, (_, drive: string) => `${drive.toLowerCase()}:`);
    const encoded = withLowerDrive
        .split('/')
        .map((segment, idx) => (idx === 0 ? segment : encodeURIComponent(segment)))
        .join('/');
    return `file:///${encoded}`;
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
                if (await menu.isDisplayed()) { return false; }
            } catch { /* stale */ }
        }
        return true;
    }, 2_000).catch(() => undefined);
}

async function getVisibleLabels(): Promise<string[]> {
    const driver = VSBrowser.instance.driver;
    return await driver.executeScript(`
        return Array.from(document.querySelectorAll('.monaco-list-row'))
            .map(row => row.textContent ? row.textContent.trim().replace(/\\s+/g, ' ') : '')
            .filter(Boolean);
    `) as string[];
}

async function waitForLabel(label: string | RegExp, timeoutMs = 15_000): Promise<void> {
    await VSBrowser.instance.driver.wait(async () => {
        const labels = await getVisibleLabels();
        return typeof label === 'string' ? labels.some(t => t.includes(label)) : labels.some(t => label.test(t));
    }, timeoutMs, `Tree item matching "${label}" not found within ${timeoutMs}ms`);
}

async function waitForLabelAbsent(label: string | RegExp, timeoutMs = 10_000): Promise<void> {
    await VSBrowser.instance.driver.wait(async () => {
        const labels = await getVisibleLabels();
        return typeof label === 'string' ? !labels.some(t => t.includes(label)) : !labels.some(t => label.test(t));
    }, timeoutMs, `Tree item matching "${label}" should be absent but is still visible`);
}

async function openVirtualTabsView(): Promise<SideBarView> {
    await dismissOnboardingOverlay();
    const activityBar = new ActivityBar();
    const viewControl = await VSBrowser.instance.driver.wait(async () => {
        await dismissOnboardingOverlay();
        return await activityBar.getViewControl('Virtual Tabs') as ViewControl | undefined;
    }, 30_000, 'Virtual Tabs icon not found in Activity Bar');
    expect(viewControl, 'Virtual Tabs icon not found in Activity Bar').to.not.be.undefined;
    if (!viewControl) { throw new Error('Virtual Tabs icon not found in Activity Bar'); }

    let sidebar: SideBarView;
    try {
        sidebar = await viewControl.openView() as SideBarView;
    } catch {
        await dismissOnboardingOverlay();
        await viewControl.getDriver().executeScript('arguments[0].click()', viewControl);
        sidebar = await new SideBarView().wait();
    }

    await VSBrowser.instance.driver.wait(async () => {
        const labels = await getVisibleLabels();
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
            if (name === 'StaleElementReferenceError' || name === 'ElementClickInterceptedError') { return false; }
            throw error;
        }
    }, 10_000, `Toolbar button matching "${titlePattern}" not found`);
}

async function reloadVirtualTabsView(): Promise<SideBarView> {
    const sidebar = await openVirtualTabsView();
    await clickToolbarButton(sidebar, /refresh/i);
    return sidebar;
}

/** Right-clicks the row matching `rowLabel` and clicks the context menu item matching `itemLabel`. */
async function runContextMenuCommand(rowLabel: string | RegExp, itemLabel: string): Promise<void> {
    const driver = VSBrowser.instance.driver;
    await dismissContextViews();

    const row = await driver.wait(async () => {
        const rows = await driver.findElements(By.css('.monaco-list-row'));
        for (const r of rows) {
            try {
                const text = (await r.getText()).trim();
                const matches = typeof rowLabel === 'string' ? text.includes(rowLabel) : rowLabel.test(text);
                if (matches) { return r; }
            } catch { /* stale — retry */ }
        }
        return null;
    }, 12_000, `Tree row matching "${rowLabel}" not found`) as Awaited<ReturnType<typeof driver.findElement>>;

    // Select first (left click) so the extension's treeView.selection is set
    // before the context menu opens — addAutoGroupsByExt/autoGroupByModifiedDate
    // read this.treeView.selection directly.
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

    const itemEls = await driver.findElements(
        By.css('.context-view.monaco-menu-container .action-item:not(.separator) .action-label')
    );
    let clicked = false;
    for (const el of itemEls) {
        const txt = (await el.getText()).trim();
        if (txt === itemLabel) {
            await el.click();
            clicked = true;
            break;
        }
    }
    if (!clicked) {
        await dismissContextViews();
        throw new Error(`Context menu item "${itemLabel}" not found for row "${rowLabel}"`);
    }

    await driver.sleep(500);
}

/** Opens the "Select Scope" QuickPick, checks only the given labels, confirms. */
async function applyScopeFilter(labelsToSelect: string[]): Promise<void> {
    const driver = VSBrowser.instance.driver;
    await dismissContextViews();

    const selectScopeBtn = await driver.wait(async () => {
        const candidates = await driver.findElements(By.css('[aria-label*="Select Scope"], .actions-container .action-label[aria-label]'));
        for (const el of candidates) {
            const label = (await el.getAttribute('aria-label')) || '';
            if (/select scope/i.test(label)) { return el; }
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

    // Toggle checkboxes to match labelsToSelect, then re-read and retry any
    // row whose checked state didn't actually flip (VS Code's QuickPick can
    // occasionally miss a click if the list is still settling).
    for (let attempt = 0; attempt < 3; attempt++) {
        const rows = await driver.findElements(By.css('.quick-input-list .monaco-list-row'));
        let allMatched = true;
        for (const row of rows) {
            const text = (await row.getText()).trim();
            const shouldCheck = labelsToSelect.some(l => text.includes(l));
            let isChecked = false;
            try {
                const checkbox = await row.findElement(By.css('input[type="checkbox"]'));
                isChecked = await checkbox.isSelected();
            } catch { /* no checkbox */ }
            if (shouldCheck !== isChecked) {
                allMatched = false;
                await row.click();
                await driver.sleep(150);
            }
        }
        if (allMatched) { break; }
        await driver.sleep(200);
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

describe('Virtual Tabs – Auto Group bookmark preservation & built-in scope visibility', function () {
    this.timeout(120_000);

    before(async function () {
        await VSBrowser.instance.waitForWorkbench();
        await dismissOnboardingOverlay();
    });

    afterEach(async function () {
        await resetScopeFilter();
    });

    after(async function () {
        await new EditorView().closeAllEditors();
        if (fs.existsSync(tsFileAbsolute)) { fs.unlinkSync(tsFileAbsolute); }
        writeConfig(repoAConfigPath, repoAOriginal);
        writeConfig(repoBConfigPath, repoBOriginal);
    });

    it('Auto Group by Extension moves bookmarks to the new sub-groups instead of dropping them', async function () {
        fs.mkdirSync(path.dirname(tsFileAbsolute), { recursive: true });
        fs.writeFileSync(tsFileAbsolute, 'export const autoGroupTsFile = true;\n');

        const mdUri = toLowerDriveFileUri(mdFileAbsolute);
        const tsUri = toLowerDriveFileUri(tsFileAbsolute);

        writeConfig(repoAConfigPath, [
            {
                id: bookmarkGroupId,
                name: bookmarkGroupName,
                files: [mdUri, tsUri],
                bookmarks: {
                    [mdUri]: [{ id: 'e2e-bookmark-1', line: 0, label: 'e2e bookmark', created: Date.now() }]
                }
            }
        ]);
        writeConfig(repoBConfigPath, repoBOriginal);

        await reloadVirtualTabsView();
        await waitForLabel(bookmarkGroupName);

        await runContextMenuCommand(bookmarkGroupName, 'Auto Group by Extension');

        const hasRelativeFile = (files: string[] | undefined, relative: string): boolean =>
            (files ?? []).some(f => normalizeRelativePath(f) === normalizeRelativePath(relative));
        const hasRelativeBookmark = (bookmarks: Record<string, unknown[]> | undefined, relative: string): boolean =>
            !!bookmarks && Object.keys(bookmarks).some(k => normalizeRelativePath(k) === normalizeRelativePath(relative));

        await VSBrowser.instance.driver.wait(() => {
            const groups = readConfig(repoAConfigPath);
            const source = groups.find(g => g.id === bookmarkGroupId);
            const subGroups = groups.filter(g => g.sourceGroupId === bookmarkGroupId);
            if (!source || subGroups.length === 0) { return false; }
            const mdSubGroup = subGroups.find(g => hasRelativeFile(g.files, mdFileRelative));
            return hasRelativeBookmark(mdSubGroup?.bookmarks, mdFileRelative);
        }, 20_000, 'Expected the .md sub-group to inherit the bookmark from the source group');

        const groupsAfter = readConfig(repoAConfigPath);
        const source = groupsAfter.find(g => g.id === bookmarkGroupId);
        expect(source?.bookmarks, 'Source group should no longer carry the bookmark').to.satisfy(
            (b: unknown) => b === undefined || Object.keys(b as object).length === 0
        );

        const mdSubGroup = groupsAfter.find(g => g.sourceGroupId === bookmarkGroupId && hasRelativeFile(g.files, mdFileRelative));
        expect(mdSubGroup, '.md sub-group not found').to.not.be.undefined;
        const mdBookmarkKey = Object.keys(mdSubGroup?.bookmarks ?? {}).find(k => normalizeRelativePath(k) === normalizeRelativePath(mdFileRelative));
        expect(mdBookmarkKey, 'Bookmark key missing on .md sub-group').to.not.be.undefined;
        expect(mdSubGroup?.bookmarks?.[mdBookmarkKey as string], 'Bookmark missing on .md sub-group').to.have.length(1);
    });

    it('Auto Group on the built-in "Currently Open Files" group stays visible when only the built-in scope is selected', async function () {
        writeConfig(repoAConfigPath, repoAOriginal);
        writeConfig(repoBConfigPath, repoBOriginal);

        await VSBrowser.instance.openResources(mdFileAbsolute, path.join(repoBPath, 'src', 'main.ts'));

        await reloadVirtualTabsView();
        await applyScopeFilter(['Currently Open Files', '目前開啟的檔案']);

        await waitForLabel(/currently open|open files|已開啟|目前開啟/i);

        await runContextMenuCommand(/currently open|open files|已開啟|目前開啟/i, 'Auto Group by Extension');

        // Core regression check: before the fix, sub-groups created from the
        // built-in group were silently excluded from this scope-filtered view.
        await waitForLabel(/@.*(currently open|open files|已開啟|目前開啟)/i, 20_000);

        // Scope headers / other-scope groups must still be absent under this filter.
        await waitForLabelAbsent('Project: Repo-A');
        await waitForLabelAbsent('Project: Repo-B');
    });
});
