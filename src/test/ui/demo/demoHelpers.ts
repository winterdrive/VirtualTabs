import * as fs from 'fs';
import * as path from 'path';
import { WebDriver, WebElement, By, Key } from 'selenium-webdriver';
import {
    ActivityBar,
    SideBarView,
    VSBrowser,
    ViewControl,
} from 'vscode-extension-tester';

// ─── Fixture paths ────────────────────────────────────────────────────────────

export const DEMO_ROOT = path.resolve(__dirname, '../../../../test-resources/demo-workspace');
export const DEMO_CONFIG = path.join(DEMO_ROOT, '.vscode', 'virtualTab.json');

export const DEMO_FILES = {
    login:     'src/auth/login.ts',
    userCard:  'src/components/UserCard.tsx',
    token:     'src/utils/tokenHelper.ts',
    authTest:  'tests/auth.test.ts',
    config:    'config/auth.config.json',
};

export function writeConfig(groups: object[]): void {
    fs.writeFileSync(DEMO_CONFIG, `${JSON.stringify(groups, null, 2)}\n`);
}

// ─── Timing ──────────────────────────────────────────────────────────────────

export function sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// ─── Overlay helpers ─────────────────────────────────────────────────────────

export async function showCaption(driver: WebDriver, text: string, durationMs: number): Promise<void> {
    await driver.executeScript(`
        const old = document.getElementById('vt-demo-caption');
        if (old) old.remove();
        const el = document.createElement('div');
        el.id = 'vt-demo-caption';
        el.style.cssText = [
            'position:fixed',
            'bottom:48px',
            'left:50%',
            'transform:translateX(-50%)',
            'background:rgba(255,255,255,0.96)',
            'color:#111',
            'font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif',
            'font-size:15px',
            'font-weight:600',
            'padding:10px 28px',
            'border-radius:8px',
            'z-index:999999',
            'pointer-events:none',
            'box-shadow:0 4px 20px rgba(0,0,0,0.28)',
            'white-space:nowrap',
        ].join(';');
        el.textContent = arguments[0];
        document.body.appendChild(el);
    `, text);
    await sleep(durationMs);
    await driver.executeScript(`
        const el = document.getElementById('vt-demo-caption');
        if (el) el.remove();
    `);
}

export async function showClickRipple(driver: WebDriver, element: WebElement): Promise<void> {
    await driver.executeScript(`
        if (!document.getElementById('vt-demo-ripple-style')) {
            const s = document.createElement('style');
            s.id = 'vt-demo-ripple-style';
            s.textContent = '@keyframes vtRipple{from{opacity:1;transform:scale(1)}to{opacity:0;transform:scale(1.7)}}';
            document.head.appendChild(s);
        }
        const t = arguments[0];
        const r = t.getBoundingClientRect();
        const x = r.left + r.width / 2, y = r.top + r.height / 2;
        const d = document.createElement('div');
        d.style.cssText = [
            'position:fixed',
            \`left:\${x - 18}px\`,
            \`top:\${y - 18}px\`,
            'width:36px',
            'height:36px',
            'border:4px solid rgba(255,196,0,1)',
            'border-radius:999px',
            'background:rgba(255,196,0,0.2)',
            'box-shadow:0 0 0 7px rgba(255,196,0,0.22),0 0 22px rgba(255,196,0,0.78)',
            'z-index:1000000',
            'pointer-events:none',
            'animation:vtRipple 520ms ease-out forwards',
        ].join(';');
        document.body.appendChild(d);
        setTimeout(() => d.remove(), 560);
    `, element);
    await sleep(500);
}

// ─── VS Code navigation ───────────────────────────────────────────────────────

export async function dismissOnboarding(driver: WebDriver): Promise<void> {
    await driver.executeScript(`
        const id = 'vt-demo-hide-onboarding';
        if (!document.getElementById(id)) {
            const s = document.createElement('style');
            s.id = id;
            s.textContent = '.onboarding-a-overlay{display:none!important}';
            document.head.appendChild(s);
        }
        document.querySelectorAll('.onboarding-a-overlay').forEach(el => el.remove());
    `);
}

export async function openVirtualTabsView(driver: WebDriver): Promise<SideBarView> {
    await dismissOnboarding(driver);
    const activityBar = new ActivityBar();
    const viewControl = await driver.wait(async () => {
        await dismissOnboarding(driver);
        return (await activityBar.getViewControl('Virtual Tabs')) as ViewControl | undefined;
    }, 30_000, 'Virtual Tabs icon not found') as ViewControl;

    let sidebar: SideBarView;
    try {
        sidebar = (await viewControl.openView()) as SideBarView;
    } catch {
        await dismissOnboarding(driver);
        await driver.executeScript('arguments[0].click()', viewControl);
        sidebar = await new SideBarView().wait();
    }

    await driver.wait(async () => {
        const labels = await getVisibleTreeLabels(driver);
        return labels.length > 0;
    }, 30_000, 'VirtualTabs extension did not activate');

    return sidebar;
}

export async function getVisibleTreeLabels(driver: WebDriver): Promise<string[]> {
    return (await driver.executeScript(`
        // Scope the query to the sidebar pane body to avoid matching editor-area list rows
        // (e.g. the Welcome tab "Get Started" checklist would otherwise cause false positives)
        const container = document.querySelector('.sidebar .pane-body') || document.body;
        return Array.from(container.querySelectorAll('.monaco-list-row'))
            .map(r => r.textContent ? r.textContent.trim().replace(/\\s+/g,' ') : '')
            .filter(Boolean);
    `)) as string[];
}

export async function waitForTreeLabel(driver: WebDriver, label: string | RegExp, ms = 15_000): Promise<void> {
    await driver.wait(async () => {
        const labels = await getVisibleTreeLabels(driver);
        return typeof label === 'string'
            ? labels.some(t => t.includes(label))
            : labels.some(t => label.test(t));
    }, ms, `Tree label "${label}" not found`);
}

export async function clickRefresh(sidebar: SideBarView, driver: WebDriver): Promise<void> {
    await driver.wait(async () => {
        try {
            const actions = await sidebar.getTitlePart().getActions();
            for (const a of actions) {
                if (/refresh/i.test(await a.getTitle())) {
                    await a.click();
                    return true;
                }
            }
            return false;
        } catch {
            return false;
        }
    }, 10_000, 'Refresh button not found');
    await sleep(800);
}

export async function expandTreeItem(driver: WebDriver, label: string): Promise<void> {
    await driver.wait(async () => {
        const rows = await driver.findElements(By.css('.monaco-list-row'));
        for (const row of rows) {
            const text = await row.getText().catch(() => '');
            if (!text.includes(label)) { continue; }
            const chevrons = await row.findElements(By.css('.codicon-chevron-right'));
            if (chevrons.length > 0) {
                await chevrons[0].click();
            } else {
                await row.click();
            }
            return true;
        }
        return false;
    }, 10_000, `Could not expand tree item "${label}"`);
    await sleep(600);
}

export async function rightClickTreeItem(driver: WebDriver, label: string): Promise<void> {
    const row = await driver.wait(async () => {
        const rows = await driver.findElements(By.css('.monaco-list-row'));
        for (const r of rows) {
            const text = await r.getText().catch(() => '');
            if (text.includes(label)) { return r; }
        }
        return null;
    }, 10_000, `Tree item "${label}" not found for right-click`);
    await showClickRipple(driver, row!);
    await driver.actions().contextClick(row!).perform();
    await sleep(400);
}

export async function clickContextMenuItem(driver: WebDriver, label: string): Promise<void> {
    const item = await driver.wait(async () => {
        const items = await driver.findElements(By.css('.action-label'));
        for (const el of items) {
            const text = await el.getText().catch(() => '');
            if (text.trim() === label) { return el; }
        }
        return null;
    }, 5_000, `Context menu item "${label}" not found`);
    await showClickRipple(driver, item!);
    await item!.click();
    await sleep(400);
}

export async function openFileViaQuickOpen(driver: WebDriver, filename: string): Promise<void> {
    await driver.actions().keyDown(Key.CONTROL).sendKeys('p').keyUp(Key.CONTROL).perform();
    await sleep(500);
    const input = await driver.wait(async () => {
        const els = await driver.findElements(By.css('.quick-input-box input'));
        return els.length > 0 ? els[0] : null;
    }, 5_000, 'Quick Open input not found');
    await input!.clear();
    await input!.sendKeys(filename, Key.RETURN);
    await sleep(800);
}
