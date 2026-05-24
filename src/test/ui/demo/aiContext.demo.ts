/**
 * GIF-B: AI Context Export
 *
 * Story: dev has a curated group → right-clicks → Copy Context for AI →
 * formatted markdown is ready to paste into Claude / ChatGPT / Copilot.
 *
 * Output: test-results/demo-b-raw.mp4
 * Run:    npm run test:ui:demo:b
 * GIF:    npm run demo:gif:b
 */

import { EditorView, SideBarView, VSBrowser } from 'vscode-extension-tester';
import {
    DEMO_FILES,
    writeConfig,
    openVirtualTabsView,
    waitForTreeLabel,
    clickRefresh,
    expandTreeItem,
    rightClickTreeItem,
    clickContextMenuItem,
    dismissOnboarding,
} from './demoHelpers';
import { UiRecording } from './recording';

const DEMO_GROUP = {
    id: 'auth-feature',
    name: 'Auth Feature',
    files: [
        DEMO_FILES.login,
        DEMO_FILES.userCard,
        DEMO_FILES.token,
        DEMO_FILES.authTest,
    ],
};

describe('Demo B – AI Context Export', function () {
    this.timeout(120_000);

    const recording = UiRecording.productDemo('demo-b');
    let sidebar: SideBarView;
    const d = () => VSBrowser.instance.driver;

    before(async function () {
        await VSBrowser.instance.waitForWorkbench();
        await new EditorView().closeAllEditors().catch(() => undefined);
        writeConfig([DEMO_GROUP]);
        sidebar = await openVirtualTabsView(d());
        await clickRefresh(sidebar, d());
        await waitForTreeLabel(d(), 'Auth Feature');
        await expandTreeItem(d(), 'Auth Feature');
        await waitForTreeLabel(d(), 'login.ts');
    });

    after(async function () {
        await recording.stop();
        await new EditorView().closeAllEditors().catch(() => undefined);
        writeConfig([]);
    });

    it('demo: one-click AI context generation from a curated group', async function () {
        recording.start();

        // ── Caption 1: describe current state (curated group already visible) ──
        await recording.step('Files curated for your current task', 2_600);

        // ── Action: right-click → Copy… → Copy Context for AI ─────────────────
        // Caption 1 stays on screen; "One click" caption comes AFTER the action
        // resolves so it labels the toast result, not an empty promise.
        await rightClickTreeItem(d(), 'Auth Feature');
        await recording.pause(400);            // context menu visible

        await clickContextMenuItem(d(), 'Copy...');
        await recording.pause(300);            // submenu open

        await clickContextMenuItem(d(), 'Copy Context for AI');

        // ── Inject green toast (action complete) ──────────────────────────────
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
        await recording.pause(800);            // settle: toast now visible

        // ── Caption 2: label the result — toast is already on screen ──────────
        await recording.step('One click. Paste-ready for Claude, ChatGPT, or Copilot', 2_600);
        await recording.pause(2_000);          // ending hold

        await dismissOnboarding(d());
    });
});
