/**
 * UI 測試：設定重新載入通知（PR #51）
 *
 * 驗證外部修改 virtualTab.json 後：
 * 1. 狀態列出現 "Config reloaded" 訊息（setStatusBarMessage）
 * 2. 沒有跳出彈窗通知（showInformationMessage）
 */

import * as fs from 'fs';
import * as path from 'path';
import { ActivityBar, ViewControl, EditorView, VSBrowser } from 'vscode-extension-tester';
import { expect } from 'chai';

const fixtureRoot = path.resolve(__dirname, '../../../test-resources/multi-root');
const repoAConfigPath = path.join(fixtureRoot, 'Repo-A', '.vscode', 'virtualTab.json');

const repoAInitialConfig = [{ id: 'repo-a-existing', name: 'Repo A Existing', files: [] }];

function writeConfig(configPath: string, groups: Array<{ id: string; name: string; files: string[] }>): void {
    fs.writeFileSync(configPath, `${JSON.stringify(groups, null, 2)}\n`);
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
            return document.querySelectorAll(
                '.onboarding-a-overlay.visible, [aria-label="Welcome to Visual Studio Code"][role="dialog"]'
            ).length === 0;
        `) as boolean;
    }, 5_000, 'VS Code onboarding overlay did not disappear');
}

async function waitForExtensionActivation(): Promise<void> {
    const driver = VSBrowser.instance.driver;
    await driver.wait(async () => {
        return await driver.executeScript(`
            return Array.from(document.querySelectorAll('.monaco-list-row'))
                .map(r => r.textContent?.trim() ?? '')
                .filter(Boolean).length > 0;
        `) as boolean;
    }, 30_000, 'Virtual Tabs extension did not activate');
}

describe('Config reload notification – UI', function () {
    this.timeout(40_000);

    before(async function () {
        await VSBrowser.instance.waitForWorkbench();
        await dismissOnboardingOverlay();

        const activityBar = new ActivityBar();
        const viewControl = (await activityBar.getViewControl('Virtual Tabs')) as ViewControl;
        expect(viewControl, 'Virtual Tabs icon not found').to.not.be.undefined;
        await viewControl.openView();
        await waitForExtensionActivation();

        // Reset to known state
        writeConfig(repoAConfigPath, repoAInitialConfig);
        await new Promise(r => setTimeout(r, 1_000));
    });

    after(async function () {
        writeConfig(repoAConfigPath, repoAInitialConfig);
        await new EditorView().closeAllEditors();
    });

    it('shows status bar message when config file is externally modified', async function () {
        const driver = VSBrowser.instance.driver;

        // Trigger external config change
        writeConfig(repoAConfigPath, [
            { id: 'repo-a-existing', name: 'Repo A Existing', files: [] },
            { id: 'config-reload-test', name: 'Config Reload Test Group', files: [] }
        ]);

        // Wait for status bar to show the reload message (3s window)
        let statusBarMessageFound = false;
        await driver.wait(async () => {
            statusBarMessageFound = await driver.executeScript(`
                return Array.from(document.querySelectorAll('.statusbar-item'))
                    .some(el => {
                        const text = el.textContent ?? '';
                        return text.includes('Config reloaded') || text.includes('已重新載入');
                    });
            `) as boolean;
            return statusBarMessageFound;
        }, 10_000, 'Status bar "Config reloaded" message did not appear within 10s');

        expect(statusBarMessageFound).to.be.true;
    });

    it('does NOT show a popup notification when config file is reloaded', async function () {
        const driver = VSBrowser.instance.driver;

        // Trigger another config change
        writeConfig(repoAConfigPath, [
            { id: 'repo-a-existing', name: 'Repo A Existing', files: [] },
            { id: 'config-reload-test-2', name: 'Config Reload Test Group 2', files: [] }
        ]);

        // Give the extension time to react
        await new Promise(r => setTimeout(r, 3_000));

        // Verify no popup notification with "Config reloaded" text appeared
        const popupExists = await driver.executeScript(`
            const toasts = document.querySelectorAll(
                '.notifications-toasts .notification-list-item-message, ' +
                '.notifications-center .notification-list-item-message'
            );
            return Array.from(toasts).some(el => {
                const text = el.textContent ?? '';
                return text.includes('Config reloaded') || text.includes('已重新載入');
            });
        `) as boolean;

        expect(popupExists, 'A popup notification appeared — should use status bar instead').to.be.false;
    });
});
