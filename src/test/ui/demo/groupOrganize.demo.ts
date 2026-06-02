/**
 * GIF-A: File Organization + AI Context Export
 *
 * Story: files buried across 4 directories → one Virtual Tab Group →
 * right-click → AI context copied in one click.
 *
 * Output: test-results/demo-raw.mp4
 * Run:    npm run test:ui:demo
 */

import { By, WebDriver } from 'selenium-webdriver';
import { ActivityBar, EditorView, VSBrowser } from 'vscode-extension-tester';
import {
    DEMO_FILES,
    writeConfig,
    showClickRipple,
    openVirtualTabsView,
    waitForTreeLabel,
    clickRefresh,
    expandTreeItem,
    findTreeRow,
    rightClickTreeItem,
    findContextMenuItem,
    clickContextMenuItem,
    dismissOnboarding,
} from './demoHelpers';
import { UiRecording } from './recording';

const FULL_GROUP = [{
    id: 'auth-feature',
    name: 'Auth Feature',
    files: [
        DEMO_FILES.login,
        DEMO_FILES.userCard,
        DEMO_FILES.token,
        DEMO_FILES.authTest,
    ],
}];

async function ensureExplorerExpanded(driver: WebDriver, label: string): Promise<void> {
    await driver.wait(async () => {
        const rows = await driver.findElements(By.css('.sidebar .pane-body .monaco-list-row'));
        for (const row of rows) {
            const text = await row.getText().catch(() => '');
            if (!text.trim().toLowerCase().includes(label.toLowerCase())) { continue; }
            if (await row.getAttribute('aria-expanded') === 'false') { await row.click(); }
            return true;
        }
        return false;
    }, 8_000, `Explorer dir "${label}" not found`);
    await new Promise(r => setTimeout(r, 350));
}

describe('Demo A – File Organization + AI Context', function () {
    this.timeout(120_000);

    const recording = UiRecording.productDemo('demo');
    const d = () => VSBrowser.instance.driver;

    before(async function () {
        await VSBrowser.instance.waitForWorkbench();
        await new EditorView().closeAllEditors().catch(() => undefined);
        writeConfig(FULL_GROUP);

        // Activate Virtual Tabs so the extension loads the config.
        const vtSidebar = await openVirtualTabsView(d());
        await clickRefresh(vtSidebar, d());
        await waitForTreeLabel(d(), 'Auth Feature');

        // Switch to Explorer and pre-expand directories.
        const explorerControl = await new ActivityBar().getViewControl('Explorer');
        await explorerControl?.openView();
        await new Promise(r => setTimeout(r, 1_000));

        await ensureExplorerExpanded(d(), 'src');
        await ensureExplorerExpanded(d(), 'auth');
        await ensureExplorerExpanded(d(), 'components');
        await ensureExplorerExpanded(d(), 'utils');
        await ensureExplorerExpanded(d(), 'tests');
    });

    after(async function () {
        await recording.stop();
        await new EditorView().closeAllEditors().catch(() => undefined);
        writeConfig([]);
    });

    it('demo: group scattered files then export AI context in one click', async function () {
        recording.start();

        // ── Caption 1: Explorer showing scattered files ────────────────────────
        await recording.step('Auth files buried across 4 directories', 2_000);

        // ── Action: switch to Virtual Tabs ─────────────────────────────────────
        const vtControl = await new ActivityBar().getViewControl('Virtual Tabs');
        if (vtControl) {
            await showClickRipple(d(), vtControl);
            await recording.pause(500);
            await vtControl.openView();
        }
        await recording.pause(1_200);          // settle: group visible

        // ── Click cue + expand Auth Feature ───────────────────────────────────
        const rows = await d().findElements(By.css('.monaco-list-row'));
        for (const row of rows) {
            if ((await row.getText().catch(() => '')).includes('Auth Feature')) {
                await showClickRipple(d(), row);
                await recording.pause(500);
                break;
            }
        }
        await expandTreeItem(d(), 'Auth Feature');
        await waitForTreeLabel(d(), 'login.ts');
        await recording.pause(400);

        // ── Caption 2: label the result, announce right-click ───────────────────
        await recording.step('One group. Right-click to copy AI context.', 2_000);

        // ── Action: right-click → Copy… → Copy Context for AI ─────────────────
        const authRow = await findTreeRow(d(), 'Auth Feature');
        await showClickRipple(d(), authRow);
        await recording.pause(500);
        await rightClickTreeItem(d(), 'Auth Feature');
        await recording.pause(1_200);          // hold: viewer reads context menu

        const copyMenu = await findContextMenuItem(d(), 'Copy...');
        await showClickRipple(d(), copyMenu);
        await recording.pause(500);
        // ── Caption 3: ripple signals copy is coming; caption predicts outcome ──
        await recording.step('Paste-ready for Claude, ChatGPT, or Copilot.', 1_000);
        await clickContextMenuItem(d(), 'Copy...');
        await recording.pause(600);            // sub-menu appears

        // ── Action: click Copy Context for AI (caption 3 stays on screen) ──────
        const copyAiMenu = await findContextMenuItem(d(), 'Copy Context for AI');
        await showClickRipple(d(), copyAiMenu);
        await recording.pause(500);
        await clickContextMenuItem(d(), 'Copy Context for AI');

        // Inject green toast — caption 3 still showing
        await d().executeScript(`
            const old = document.getElementById('vt-demo-confirm');
            if (old) old.remove();
            const el = document.createElement('div');
            el.id = 'vt-demo-confirm';
            el.style.cssText = [
                'position:fixed',
                'top:32px',
                'right:32px',
                'background:#1a7f37',
                'color:#fff',
                'font:600 13px/1 -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif',
                'padding:8px 18px',
                'border-radius:6px',
                'z-index:999999',
                'pointer-events:none',
                'box-shadow:0 2px 12px rgba(0,0,0,0.25)',
            ].join(';');
            el.textContent = '✓  Context copied to clipboard';
            document.body.appendChild(el);
            setTimeout(() => el.remove(), 5000);
        `);
        await recording.pause(2_500);          // ending hold: caption 3 + toast both visible

        await dismissOnboarding(d());
    });
});
