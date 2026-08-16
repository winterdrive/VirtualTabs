/**
 * Real E2E test for the self-root .code-workspace ConfigScope collision (#116).
 *
 * Unlike selfRootScopeCollisionRegression.test.ts (a jest test with a mocked
 * `vscode` module), this launches the packaged extension inside a real VS
 * Code instance opened directly against a self-root .code-workspace
 * (`"folders": [{ "path": "." }]`), and drives the exact user-facing actions
 * that triggered the reported bug: toggling the Virtual Tabs view (fires
 * `refresh(true)`, which persists) and clicking Refresh (calls
 * `reinitializeScopes()`, which re-discovers scopes). Confirms the persisted
 * `.vscode/virtualTab.json` group count never grows across repeated cycles,
 * and that the tree never renders a duplicated scope section.
 *
 * Run in isolation via `npm run test:ui:selfroot` — it opens a dedicated
 * self-root workspace, separate from the shared multi-root fixture the rest
 * of the `test:ui` suite runs against.
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

const fixtureRoot = path.resolve(__dirname, '../../../../test-resources/self-root');
const configPath = path.join(fixtureRoot, '.vscode', 'virtualTab.json');

const seedGroups = [{ id: 'self-root-existing', name: 'Self-Root Existing', files: [] }];

function writeConfig(groups: object[]): void {
    fs.writeFileSync(configPath, `${JSON.stringify(groups, null, 2)}\n`);
}

function readConfig(): Array<{ id: string; name: string }> {
    return JSON.parse(fs.readFileSync(configPath, 'utf8'));
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

async function getVirtualTabsViewControl(): Promise<ViewControl> {
    const activityBar = new ActivityBar();
    const viewControl = await VSBrowser.instance.driver.wait(async () => {
        await dismissOnboardingOverlay();
        return await activityBar.getViewControl('Virtual Tabs') as ViewControl | undefined;
    }, 30_000, 'Virtual Tabs icon not found in Activity Bar');
    if (!viewControl) {
        throw new Error('Virtual Tabs icon not found in Activity Bar');
    }
    return viewControl;
}

async function openVirtualTabsView(): Promise<SideBarView> {
    await dismissOnboardingOverlay();
    const viewControl = await getVirtualTabsViewControl();

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

/** Clicking an already-open view's Activity Bar icon collapses/hides it,
 * firing `onDidChangeVisibility(false)` — the other half of the real
 * "close and reopen" cycle alongside reinitializeScopes(). */
async function closeVirtualTabsView(): Promise<void> {
    const viewControl = await getVirtualTabsViewControl();
    await viewControl.getDriver().executeScript('arguments[0].click()', viewControl);
    await VSBrowser.instance.driver.sleep(300);
}

async function waitForTreeLabel(label: string, timeoutMs = 15_000): Promise<void> {
    await VSBrowser.instance.driver.wait(async () => {
        const labels = await getVisibleTreeLabels();
        return labels.some(t => t.includes(label));
    }, timeoutMs, `Tree item matching "${label}" not found within ${timeoutMs}ms`);
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
            const name = (error as Error).name;
            if (name === 'StaleElementReferenceError' || name === 'ElementClickInterceptedError') {
                return false;
            }
            throw error;
        }
    }, 10_000, `Toolbar button matching "${titlePattern}" not found`);
}

describe('Self-root .code-workspace — no group doubling across reopen cycles (#116 E2E)', function () {
    // Generous enough to cover VT_E2E_KEEP_OPEN/VT_E2E_KEEP_OPEN_MS pausing at
    // the end for manual inspection, on top of the normal ~10s run time.
    this.timeout(15 * 60_000);

    before(async function () {
        await VSBrowser.instance.waitForWorkbench();
        await dismissOnboardingOverlay();
        writeConfig(seedGroups);
    });

    after(async function () {
        await new EditorView().closeAllEditors();
        writeConfig(seedGroups);
    });

    it('does not grow the persisted group count across repeated close/reopen + refresh cycles', async function () {
        let sidebar = await openVirtualTabsView();
        await waitForTreeLabel('Self-Root Existing');

        for (let cycle = 1; cycle <= 3; cycle++) {
            // Half of the real reopen sequence: hide the view, then show it
            // again — this fires the treeView.onDidChangeVisibility(true)
            // listener, which calls provider.refresh(true) and persists
            // whatever is currently in memory.
            await closeVirtualTabsView();
            sidebar = await openVirtualTabsView();

            // The other half: the Refresh button calls
            // provider.reinitializeScopes(), re-running ConfigScopeDiscovery
            // against this self-root workspace.
            await clickToolbarButton(sidebar, /refresh/i);
            await waitForTreeLabel('Self-Root Existing');

            const persisted = readConfig();
            expect(persisted, `persisted groups after cycle ${cycle}`).to.have.lengthOf(1);
            expect(persisted[0].id).to.equal('self-root-existing');
        }

        // A scope-id collision would also manifest as a duplicated scope
        // section in the tree — confirm the group renders exactly once.
        const labels = await getVisibleTreeLabels();
        const occurrences = labels.filter(l => l.includes('Self-Root Existing')).length;
        expect(occurrences, `tree rows matching "Self-Root Existing": ${labels.join(' | ')}`).to.equal(1);

        // Set VT_E2E_KEEP_OPEN=1 to pause here after all assertions pass, so
        // the VS Code window stays up for manual visual inspection instead
        // of being closed immediately by the test runner.
        const pauseMs = Number(process.env.VT_E2E_KEEP_OPEN_MS) || (process.env.VT_E2E_KEEP_OPEN ? 5 * 60_000 : 0);
        if (pauseMs > 0) {
            console.log(`VT_E2E_KEEP_OPEN set — leaving the VS Code window open for ${Math.round(pauseMs / 1000)}s for manual inspection...`);
            await VSBrowser.instance.driver.sleep(pauseMs);
        }
    });
});
