/**
 * E2E 測試：「已開啟資料夾」built-in 群組初始化與可見性
 *
 * 對應手動測試 #5、#6、#7：
 *   #5 — 已有自訂群組的 workspace，built-in 群組仍應出現（回歸）
 *   #6 — 空白 workspace（無任何群組），built-in 群組應出現
 *   #7 — 點 Refresh 後，built-in 群組不消失
 *
 * 這是對 provider.ts 建構子修正（`!groups.some(g => g.builtIn)` 取代
 * `groups.length === 0`）的整合驗證。
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
import { expect } from 'chai';

const fixtureRoot = path.resolve(__dirname, '../../../test-resources/multi-root');
const repoAConfigPath = path.join(fixtureRoot, 'Repo-A', '.vscode', 'virtualTab.json');
const repoBConfigPath = path.join(fixtureRoot, 'Repo-B', '.vscode', 'virtualTab.json');

/** 原始 fixture 快照，用於 after() 還原 */
const repoAOriginal = [{ id: 'repo-a-existing', name: 'Repo A Existing', files: [] }];
const repoBOriginal = [{ id: 'repo-b-existing', name: 'Repo B Existing', files: [] }];

function writeConfig(configPath: string, groups: object[]): void {
    fs.writeFileSync(configPath, `${JSON.stringify(groups, null, 2)}\n`);
}

async function dismissOnboardingOverlay(): Promise<void> {
    const driver = VSBrowser.instance.driver;
    await driver.wait(async () => {
        return await driver.executeScript(`
            const styleId = 'vt-e2e-hide-onboarding';
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
    }, 30_000, 'Virtual Tabs extension did not activate within 30s');

    return sidebar;
}

async function waitForTreeLabel(label: string | RegExp, timeoutMs = 15_000): Promise<void> {
    await VSBrowser.instance.driver.wait(async () => {
        const labels = await getVisibleTreeLabels();
        return typeof label === 'string'
            ? labels.some(t => t.includes(label))
            : labels.some(t => label.test(t));
    }, timeoutMs, `Tree item matching "${label}" not found within ${timeoutMs}ms`);
}

async function waitForTreeLabelAbsent(label: string | RegExp, timeoutMs = 10_000): Promise<void> {
    await VSBrowser.instance.driver.wait(async () => {
        const labels = await getVisibleTreeLabels();
        return typeof label === 'string'
            ? !labels.some(t => t.includes(label))
            : !labels.some(t => label.test(t));
    }, timeoutMs, `Tree item matching "${label}" should be absent but is still visible`);
}

async function clickToolbarButton(sidebar: SideBarView, titlePattern: RegExp): Promise<void> {
    const driver = VSBrowser.instance.driver;
    await driver.wait(async () => {
        try {
            const titlePart = sidebar.getTitlePart();
            const actions = await titlePart.getActions();
            for (const action of actions) {
                const title = await action.getTitle();
                if (titlePattern.test(title)) {
                    await action.click();
                    return true;
                }
            }
            return false;
        } catch (error) {
            if ((error as Error).name === 'StaleElementReferenceError') {
                return false;
            }
            throw error;
        }
    }, 10_000, `Toolbar button matching "${titlePattern}" not found`);
}


// ─────────────────────────────────────────────────────────────────────────────

describe('Virtual Tabs – Built-in 群組初始化與可見性', function () {
    this.timeout(60_000);

    before(async function () {
        await VSBrowser.instance.waitForWorkbench();
        await dismissOnboardingOverlay();
    });

    after(async function () {
        await new EditorView().closeAllEditors();
        writeConfig(repoAConfigPath, repoAOriginal);
        writeConfig(repoBConfigPath, repoBOriginal);
    });

    it('#5 — 已有自訂群組但無 built-in 時，built-in 群組仍應出現（回歸）', async function () {
        // 設定只有自訂群組，沒有 builtIn 欄位
        writeConfig(repoAConfigPath, [
            { id: 'existing-1', name: 'Feature Group', files: [] }
        ]);
        writeConfig(repoBConfigPath, [
            { id: 'existing-2', name: 'Bug Fixes', files: [] }
        ]);

        await openVirtualTabsView();

        // 自訂群組可見
        await waitForTreeLabel('Feature Group');
        await waitForTreeLabel('Bug Fixes');

        // built-in 群組也應出現（不受自訂群組影響）
        await waitForTreeLabel(/currently open|open files|已開啟|目前開啟/i);
    });

    it('#6 — 空白 workspace（無任何群組），built-in 群組應出現', async function () {
        writeConfig(repoAConfigPath, []);
        writeConfig(repoBConfigPath, []);

        await openVirtualTabsView();

        // 沒有任何自訂群組
        await waitForTreeLabelAbsent('Feature Group');

        // built-in 群組仍應存在
        await waitForTreeLabel(/currently open|open files|已開啟|目前開啟/i);
    });

    it('#7 — 點 Refresh 後，built-in 群組不消失', async function () {
        writeConfig(repoAConfigPath, [
            { id: 'group-before-refresh', name: 'Before Refresh Group', files: [] }
        ]);
        writeConfig(repoBConfigPath, []);

        const sidebar = await openVirtualTabsView();

        // 用 Refresh 強制從磁碟載入（不依賴 FileSystemWatcher 的非同步時機）
        await clickToolbarButton(sidebar, /refresh/i);

        // 第一次 Refresh 後：built-in 群組與自訂群組均應存在
        await waitForTreeLabel(/currently open|open files|已開啟|目前開啟/i);
        await waitForTreeLabel('Before Refresh Group');

        // 再點一次 Refresh，驗證 built-in 群組不會消失（這是本 case 核心回歸）
        await clickToolbarButton(sidebar, /refresh/i);

        // 第二次 Refresh 後 built-in 群組仍應存在
        await waitForTreeLabel(/currently open|open files|已開啟|目前開啟/i);

        // 第二次 Refresh 後自訂群組也仍應存在
        await waitForTreeLabel('Before Refresh Group');
    });

    it('預設視圖（無篩選）：multi-root workspace 顯示 built-in + 兩個 ScopeHeaderItem', async function () {
        writeConfig(repoAConfigPath, repoAOriginal);
        writeConfig(repoBConfigPath, repoBOriginal);

        await openVirtualTabsView();

        // built-in 群組在最頂部
        await waitForTreeLabel(/currently open|open files|已開啟|目前開啟/i);

        // 兩個 scope header
        await waitForTreeLabel('Project: Repo-A');
        await waitForTreeLabel('Project: Repo-B');

        // 兩個 scope 的自訂群組在各自 scope 底下
        await waitForTreeLabel('Repo A Existing');
        await waitForTreeLabel('Repo B Existing');
    });

    it('built-in 群組應排列在所有 ScopeHeaderItem 之前', async function () {
        writeConfig(repoAConfigPath, repoAOriginal);
        writeConfig(repoBConfigPath, repoBOriginal);

        await openVirtualTabsView();

        const labels = await getVisibleTreeLabels();

        const builtInIdx = labels.findIndex(l => /currently open|open files|已開啟|目前開啟/i.test(l));
        const scopeHeaderIdx = labels.findIndex(l => l.includes('Project:'));

        expect(builtInIdx).to.be.greaterThan(-1, 'Built-in group not found in tree');
        expect(scopeHeaderIdx).to.be.greaterThan(-1, 'Scope header not found in tree');
        expect(builtInIdx).to.be.lessThan(scopeHeaderIdx,
            'Built-in group should appear before scope headers');
    });
});
