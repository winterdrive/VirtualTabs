/**
 * GIF-C: Persistence
 *
 * Story: dev creates a group → VS Code auto-saves it to .vscode/virtualTab.json
 * → opens the JSON file to show it's committed alongside code → groups survive
 * any restart because the config lives in the repo.
 *
 * Output: test-results/demo-c-raw.mp4
 * Run:    npm run test:ui:demo:c
 * GIF:    npm run demo:gif:c
 */

import { EditorView, SideBarView, VSBrowser } from 'vscode-extension-tester';
import {
    DEMO_FILES,
    writeConfig,
    openVirtualTabsView,
    waitForTreeLabel,
    clickRefresh,
    expandTreeItem,
    openFileViaQuickOpen,
    dismissOnboarding,
} from './demoHelpers';
import { UiRecording } from './recording';

const DEMO_GROUP = {
    id: 'sprint-42',
    name: 'Sprint 42',
    files: [
        DEMO_FILES.login,
        DEMO_FILES.token,
        DEMO_FILES.authTest,
    ],
};

describe('Demo C – Persistence', function () {
    this.timeout(120_000);

    const recording = UiRecording.productDemo('demo-c');
    let sidebar: SideBarView;
    const d = () => VSBrowser.instance.driver;

    before(async function () {
        await VSBrowser.instance.waitForWorkbench();
        await new EditorView().closeAllEditors().catch(() => undefined);
        writeConfig([DEMO_GROUP]);
        sidebar = await openVirtualTabsView(d());
        await clickRefresh(sidebar, d());
        await waitForTreeLabel(d(), 'Sprint 42');
        await expandTreeItem(d(), 'Sprint 42');
        await waitForTreeLabel(d(), 'login.ts');
    });

    after(async function () {
        await recording.stop();
        await new EditorView().closeAllEditors().catch(() => undefined);
        writeConfig([]);
    });

    it('demo: groups are saved to .vscode/virtualTab.json and survive restarts', async function () {
        recording.start();

        // ── Caption 1: describe current state (sprint group already visible) ───
        await recording.step('Build your focus set for the sprint', 2_600);

        // ── Action: open virtualTab.json — caption 1 stays while file opens ───
        await openFileViaQuickOpen(d(), 'virtualTab.json');

        // Inject yellow highlight on editor content
        await d().executeScript(`
            const editors = document.querySelectorAll('.monaco-editor');
            if (editors.length > 0) {
                const s = document.createElement('style');
                s.textContent = '@keyframes vtFadeOut{from{opacity:1}to{opacity:0}}';
                document.head.appendChild(s);
                const el = document.createElement('div');
                el.style.cssText = [
                    'position:absolute',
                    'inset:0',
                    'background:rgba(255,196,0,0.08)',
                    'z-index:100',
                    'pointer-events:none',
                    'animation:vtFadeOut 1.4s ease-out forwards',
                ].join(';');
                editors[0].style.position = 'relative';
                editors[0].appendChild(el);
            }
        `);
        await recording.pause(1_000);          // settle: JSON editor now visible

        // ── Caption 2: label the JSON file now that it's on screen ────────────
        // "Auto-saved" caption appears AFTER the file is visible, not before.
        await recording.step('Auto-saved to .vscode/virtualTab.json', 2_600);

        // ── Caption 3: team sharing message (JSON still visible) ───────────────
        await recording.step('Commit it once — your whole team gets the same view', 2_600);
        await recording.pause(1_000);          // hold on JSON

        // ── Action: close editor, return to VirtualTabs panel ─────────────────
        await new EditorView().closeAllEditors();
        await recording.pause(1_500);          // settle: panel back in focus

        await waitForTreeLabel(d(), 'Sprint 42');

        // ── Caption 4: final result — group still there after editor close ─────
        await recording.step('Always there. Every session.', 2_600);
        await recording.pause(2_000);          // ending hold

        await dismissOnboarding(d());
    });
});
