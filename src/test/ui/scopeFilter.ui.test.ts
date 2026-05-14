/**
 * E2E 測試：Scope 篩選器 UI 行為
 *
 * 對應手動測試 #9–14：
 *   #10 — 只選 built-in → tree 只顯示 built-in 群組
 *   #11 — 只選單一 repo scope → 平面顯示該 scope 群組，無 ScopeHeaderItem
 *   #12 — built-in + 單一 repo scope → built-in 在前，該 scope 群組平面顯示
 *   #13 — 兩個 repo scope → 顯示 ScopeHeaderItem
 *   #14 — 空選確認 → 恢復顯示全部
 *
 * 使用 Selenium DOM 操作 VS Code 的 canPickMany QuickPick，
 * 因 vscode-extension-tester 對 canPickMany 的原生支援有限。
 */

import * as fs from 'fs';
import * as path from 'path';
import {
    ActivityBar,
    SideBarView,
    EditorView,
    VSBrowser,
    ViewControl
} from 'vscode-extension-tester';
import { By, Key } from 'selenium-webdriver';
import { expect } from 'chai';

// ─── Fixture 路徑 ─────────────────────────────────────────────────────────────

const fixtureRoot = path.resolve(__dirname, '../../../test-resources/multi-root');
const repoAConfigPath = path.join(fixtureRoot, 'Repo-A', '.vscode', 'virtualTab.json');
const repoBConfigPath = path.join(fixtureRoot, 'Repo-B', '.vscode', 'virtualTab.json');

const repoAOriginal = [{ id: 'repo-a-existing', name: 'Repo A Existing', files: [] }];
const repoBOriginal = [{ id: 'repo-b-existing', name: 'Repo B Existing', files: [] }];

function writeConfig(configPath: string, groups: object[]): void {
    fs.writeFileSync(configPath, `${JSON.stringify(groups, null, 2)}\n`);
}

// ─── 通用 Helper ──────────────────────────────────────────────────────────────

async function dismissOnboardingOverlay(): Promise<void> {
    const driver = VSBrowser.instance.driver;
    await driver.wait(async () => {
        return await driver.executeScript(`
            const styleId = 'vt-e2e-overlay-hide';
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

async function getVisibleSidebarLabels(): Promise<string[]> {
    const driver = VSBrowser.instance.driver;
    // Read only from the sidebar (not QuickPick) by scoping to .pane-body
    return await driver.executeScript(`
        const pane = document.querySelector('.pane-body') ||
                     document.querySelector('.sidebar .split-view-view');
        const root = pane || document;
        return Array.from(root.querySelectorAll('.monaco-list-row'))
            .map(row => row.textContent ? row.textContent.trim().replace(/\\s+/g, ' ') : '')
            .filter(Boolean);
    `) as string[];
}

async function waitForSidebarLabel(label: string | RegExp, timeoutMs = 15_000): Promise<void> {
    await VSBrowser.instance.driver.wait(async () => {
        const labels = await getVisibleSidebarLabels();
        return typeof label === 'string'
            ? labels.some(t => t.includes(label))
            : labels.some(t => label.test(t));
    }, timeoutMs, `Sidebar item matching "${label}" not found`);
}

async function waitForSidebarLabelAbsent(label: string | RegExp, timeoutMs = 10_000): Promise<void> {
    await VSBrowser.instance.driver.wait(async () => {
        const labels = await getVisibleSidebarLabels();
        return typeof label === 'string'
            ? !labels.some(t => t.includes(label))
            : !labels.some(t => label.test(t));
    }, timeoutMs, `Sidebar item matching "${label}" should be absent but is still visible`);
}

async function openVirtualTabsView(): Promise<SideBarView> {
    await dismissOnboardingOverlay();
    const activityBar = new ActivityBar();
    const viewControl = (await activityBar.getViewControl('Virtual Tabs')) as ViewControl;
    expect(viewControl, 'Virtual Tabs icon not found').to.not.be.undefined;

    let sidebar: SideBarView;
    try {
        sidebar = await viewControl.openView() as SideBarView;
    } catch {
        await dismissOnboardingOverlay();
        await viewControl.getDriver().executeScript('arguments[0].click()', viewControl);
        sidebar = await new SideBarView().wait();
    }

    await VSBrowser.instance.driver.wait(async () => {
        const labels = await getVisibleSidebarLabels();
        return labels.length > 0;
    }, 30_000, 'Virtual Tabs did not activate');

    return sidebar;
}

// ─── QuickPick Helper ─────────────────────────────────────────────────────────

/**
 * 開啟 "Select Scope" QuickPick（toolbar button），
 * 勾選 labelsToSelect 中的項目，取消勾選其餘項目，然後確認。
 *
 * @param labelsToSelect 要勾選的項目文字（部分比對）。空陣列 = 全部取消 = 顯示全部。
 */
async function applyScopeFilter(labelsToSelect: string[]): Promise<void> {
    const driver = VSBrowser.instance.driver;

    // 用 Selenium 找到並點擊 "Select Scope" toolbar button（走真實瀏覽器事件）
    const selectScopeBtn = await driver.wait(async () => {
        const candidates = await driver.findElements(By.css('[aria-label*="Select Scope"], .actions-container .action-label[aria-label]'));
        for (const el of candidates) {
            const label = (await el.getAttribute('aria-label')) || '';
            if (/select scope/i.test(label)) { return el; }
        }
        return null;
    }, 10_000, 'Could not find "Select Scope" toolbar button') as Awaited<ReturnType<typeof driver.findElement>>;

    await selectScopeBtn.click();

    // 等 QuickPick widget 出現
    await driver.wait(async () => {
        try {
            const widget = await driver.findElement(By.css('.quick-input-widget'));
            return await widget.isDisplayed();
        } catch { return false; }
    }, 10_000, 'QuickPick did not appear after clicking Select Scope');

    // 讓清單完整渲染
    await driver.sleep(400);

    // 用 Selenium WebDriver click（走真實事件鏈，VS Code 的 QuickPick 才能感知）
    const rows = await driver.findElements(By.css('.quick-input-list .monaco-list-row'));
    for (const row of rows) {
        const text = (await row.getText()).trim();
        const shouldCheck = labelsToSelect.some(l => text.includes(l));

        // 取得 checkbox 目前狀態
        let isChecked = false;
        try {
            const checkbox = await row.findElement(By.css('input[type="checkbox"]'));
            isChecked = await checkbox.isSelected();
        } catch { /* no checkbox, skip */ }

        if (shouldCheck !== isChecked) {
            await row.click();
            await driver.sleep(50);
        }
    }

    // 按 Enter 確認
    await driver.actions().sendKeys(Key.ENTER).perform();

    // 等待 QuickPick 關閉
    await driver.wait(async () => {
        try {
            const widget = await driver.findElement(By.css('.quick-input-widget'));
            return !(await widget.isDisplayed());
        } catch { return true; }
    }, 5_000, 'QuickPick did not close after confirmation');

    // 給 tree view 時間更新
    await driver.sleep(800);
}

/** 重置至「顯示全部」狀態（空選確認）*/
async function resetScopeFilter(): Promise<void> {
    await applyScopeFilter([]);
}

// ─── 測試 ─────────────────────────────────────────────────────────────────────

describe('Virtual Tabs – Scope 篩選器 UI', function () {
    this.timeout(90_000);

    before(async function () {
        writeConfig(repoAConfigPath, repoAOriginal);
        writeConfig(repoBConfigPath, repoBOriginal);
        await VSBrowser.instance.waitForWorkbench();
        await dismissOnboardingOverlay();
        await openVirtualTabsView();

        // 確保篩選器從「顯示全部」狀態開始
        await resetScopeFilter();
    });

    afterEach(async function () {
        // 每個測試後重置，確保下一個測試從「顯示全部」出發
        await resetScopeFilter();
    });

    after(async function () {
        await new EditorView().closeAllEditors();
        writeConfig(repoAConfigPath, repoAOriginal);
        writeConfig(repoBConfigPath, repoBOriginal);
    });

    // ── #10 ──────────────────────────────────────────────────────────────────

    it('#10 — 只選 built-in → tree 只顯示 built-in 群組', async function () {
        await applyScopeFilter(['Currently Open Files', '目前開啟的檔案']);

        // built-in 群組可見
        await waitForSidebarLabel(/currently open|open files|已開啟|目前開啟/i);

        // scope header 不應出現
        await waitForSidebarLabelAbsent('Project: Repo-A');
        await waitForSidebarLabelAbsent('Project: Repo-B');

        // 自訂群組不應出現
        await waitForSidebarLabelAbsent('Repo A Existing');
        await waitForSidebarLabelAbsent('Repo B Existing');
    });

    // ── #11 ──────────────────────────────────────────────────────────────────

    it('#11 — 只選 Repo-A scope → 平面顯示 Repo-A 群組，無 ScopeHeaderItem', async function () {
        await applyScopeFilter(['Project: Repo-A']);

        // Repo-A 的群組平面顯示
        await waitForSidebarLabel('Repo A Existing');

        // Repo-B 群組不應出現
        await waitForSidebarLabelAbsent('Repo B Existing');

        // 平面模式：不顯示 ScopeHeaderItem
        await waitForSidebarLabelAbsent('Project: Repo-A');
        await waitForSidebarLabelAbsent('Project: Repo-B');

        // built-in 不應出現
        await waitForSidebarLabelAbsent(/currently open|open files|已開啟|目前開啟/i);
    });

    // ── #12 ──────────────────────────────────────────────────────────────────

    it('#12 — built-in + Repo-A → built-in 在前，Repo-A 群組平面顯示', async function () {
        await applyScopeFilter(['Currently Open Files', '目前開啟的檔案', 'Project: Repo-A']);

        // built-in 可見
        await waitForSidebarLabel(/currently open|open files|已開啟|目前開啟/i);

        // Repo-A 群組平面可見
        await waitForSidebarLabel('Repo A Existing');

        // Repo-B 不可見
        await waitForSidebarLabelAbsent('Repo B Existing');

        // 平面模式：不顯示 ScopeHeaderItem
        await waitForSidebarLabelAbsent('Project: Repo-A');
        await waitForSidebarLabelAbsent('Project: Repo-B');

        // 驗證 built-in 排在 Repo-A 群組之前
        const labels = await getVisibleSidebarLabels();
        const builtInIdx = labels.findIndex(l => /currently open|open files|已開啟|目前開啟/i.test(l));
        const groupIdx = labels.findIndex(l => l.includes('Repo A Existing'));
        expect(builtInIdx).to.be.greaterThan(-1, 'Built-in group not found');
        expect(groupIdx).to.be.greaterThan(-1, 'Repo A group not found');
        expect(builtInIdx).to.be.lessThan(groupIdx, 'Built-in should appear before Repo-A groups');
    });

    // ── #13 ──────────────────────────────────────────────────────────────────

    it('#13 — 兩個 repo scope → 顯示 ScopeHeaderItem', async function () {
        await applyScopeFilter(['Project: Repo-A', 'Project: Repo-B']);

        // 兩個 scope 的 ScopeHeaderItem 都應出現
        await waitForSidebarLabel('Project: Repo-A');
        await waitForSidebarLabel('Project: Repo-B');

        // 各 scope 底下的群組也應可見（scope 預設展開）
        await waitForSidebarLabel('Repo A Existing');
        await waitForSidebarLabel('Repo B Existing');

        // built-in 不應出現
        await waitForSidebarLabelAbsent(/currently open|open files|已開啟|目前開啟/i);
    });

    it('#13 延伸 — built-in + 兩個 repo scope → built-in 在所有 ScopeHeaderItem 前', async function () {
        await applyScopeFilter(['Currently Open Files', '目前開啟的檔案', 'Project: Repo-A', 'Project: Repo-B']);

        await waitForSidebarLabel(/currently open|open files|已開啟|目前開啟/i);
        await waitForSidebarLabel('Project: Repo-A');
        await waitForSidebarLabel('Project: Repo-B');

        const labels = await getVisibleSidebarLabels();
        const builtInIdx = labels.findIndex(l => /currently open|open files|已開啟|目前開啟/i.test(l));
        const repoAHeaderIdx = labels.findIndex(l => l.includes('Project: Repo-A'));
        const repoBHeaderIdx = labels.findIndex(l => l.includes('Project: Repo-B'));

        expect(builtInIdx).to.be.lessThan(repoAHeaderIdx,
            'Built-in should appear before Repo-A header');
        expect(builtInIdx).to.be.lessThan(repoBHeaderIdx,
            'Built-in should appear before Repo-B header');
    });

    // ── #14 ──────────────────────────────────────────────────────────────────

    it('#14 — 空選確認 → 恢復顯示全部（built-in + 兩個 ScopeHeaderItem）', async function () {
        // 先套用一個篩選
        await applyScopeFilter(['Project: Repo-A']);
        await waitForSidebarLabelAbsent('Project: Repo-B');

        // 空選確認，恢復全部
        await applyScopeFilter([]);

        // 恢復後應看到 built-in + 兩個 scope header
        await waitForSidebarLabel(/currently open|open files|已開啟|目前開啟/i);
        await waitForSidebarLabel('Project: Repo-A');
        await waitForSidebarLabel('Project: Repo-B');
    });
});
