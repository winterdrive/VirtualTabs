import * as fs from 'fs';
import * as path from 'path';
import {
    ActivityBar,
    CustomTreeSection,
    EditorView,
    SideBarView,
    TreeItem,
    ViewControl,
    VSBrowser,
    Workbench
} from 'vscode-extension-tester';
import { expect } from 'chai';

const fixtureRoot = path.resolve(__dirname, '../../../test-resources/multi-root');
const repoAPath = path.join(fixtureRoot, 'Repo-A');
const repoAConfigPath = path.join(repoAPath, '.vscode', 'virtualTab.json');
const repoAOriginal = [{ id: 'repo-a-existing', name: 'Repo A Existing', files: [] }];

const groupId = 'bookmark-no-dup-group';
const groupName = 'Bookmark No Duplicate Group';
const testFileRelativePath = 'src/bookmark-no-duplicate.ts';
const testFileAbsolutePath = path.join(repoAPath, testFileRelativePath);

function writeConfig(configPath: string, groups: object[]): void {
    fs.writeFileSync(configPath, `${JSON.stringify(groups, null, 2)}\n`);
}

function readConfig(configPath: string): Array<{
    id?: string;
    name?: string;
    files?: string[];
    bookmarks?: Record<string, Array<{ id: string; line: number; label: string }>>;
}> {
    return JSON.parse(fs.readFileSync(configPath, 'utf8')) as Array<{
        id?: string;
        name?: string;
        files?: string[];
        bookmarks?: Record<string, Array<{ id: string; line: number; label: string }>>;
    }>;
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

function normalizeRelativePath(p: string): string {
    return p.replace(/\\/g, '/').toLowerCase();
}

async function dismissOnboardingOverlay(): Promise<void> {
    const driver = VSBrowser.instance.driver;
    await driver.wait(async () => {
        return await driver.executeScript(`
            const styleId = 'vt-e2e-bookmark-hide-onboarding';
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

async function waitForTreeLabel(label: string, timeoutMs = 15_000): Promise<void> {
    await VSBrowser.instance.driver.wait(async () => {
        const labels = await getVisibleTreeLabels();
        return labels.some(t => t.includes(label));
    }, timeoutMs, `Tree item "${label}" not found`);
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

async function clickRefresh(sidebar: SideBarView): Promise<void> {
    const driver = VSBrowser.instance.driver;
    await driver.wait(async () => {
        try {
            const actions = await sidebar.getTitlePart().getActions();
            for (const action of actions) {
                const title = await action.getTitle();
                if (/refresh/i.test(title)) {
                    await action.click();
                    return true;
                }
            }
            return false;
        } catch {
            return false;
        }
    }, 10_000, 'Refresh button not found');
}

async function getVirtualTabsSection(sidebar: SideBarView): Promise<CustomTreeSection> {
    const content = sidebar.getContent();
    return await content.getSection<CustomTreeSection>(
        section => section.getTitle().then(title => title.toLowerCase().includes('virtual tabs')),
        CustomTreeSection
    );
}

async function findTreeItem(section: CustomTreeSection, label: string, timeoutMs: number = 10_000): Promise<TreeItem> {
    const driver = VSBrowser.instance.driver;
    await driver.wait(async () => (await section.findItem(label)) !== undefined, timeoutMs, `Tree item "${label}" not found`);
    return await section.findItem(label) as TreeItem;
}

describe('Virtual Tabs - Add Bookmark does not duplicate file item', function () {
    this.timeout(90_000);

    before(async function () {
        await VSBrowser.instance.waitForWorkbench();
        await dismissOnboardingOverlay();
    });

    after(async function () {
        await new EditorView().closeAllEditors();
        if (fs.existsSync(testFileAbsolutePath)) {
            fs.unlinkSync(testFileAbsolutePath);
        }
        writeConfig(repoAConfigPath, repoAOriginal);
    });

    it('keeps one file entry after Add Bookmark when stored URI drive casing differs', async function () {
        fs.mkdirSync(path.dirname(testFileAbsolutePath), { recursive: true });
        fs.writeFileSync(testFileAbsolutePath, 'export const bookmarkNoDup = true;\n');

        writeConfig(repoAConfigPath, [
            {
                id: groupId,
                name: groupName,
                files: [toLowerDriveFileUri(testFileAbsolutePath)]
            }
        ]);

        const sidebar = await openVirtualTabsView();
        await clickRefresh(sidebar);

        const section = await getVirtualTabsSection(sidebar);
        const groupItem = await findTreeItem(section, groupName);
        await groupItem.expand();
        await waitForTreeLabel(path.basename(testFileAbsolutePath));

        await VSBrowser.instance.openResources(testFileAbsolutePath);
        await new Workbench().executeCommand('Add Bookmark to Group');

        await VSBrowser.instance.driver.wait(() => {
            const groups = readConfig(repoAConfigPath);
            const target = groups.find(group => group.id === groupId);
            if (!target || !Array.isArray(target.files)) {
                return false;
            }
            const fileMatches = target.files.filter(file => normalizeRelativePath(file) === normalizeRelativePath(testFileRelativePath));
            return fileMatches.length === 1 && !!target.bookmarks && Object.keys(target.bookmarks).length > 0;
        }, 15_000, 'Expected one file entry and one bookmark after Add Bookmark');

        const groupsAfter = readConfig(repoAConfigPath);
        const target = groupsAfter.find(group => group.id === groupId);
        expect(target, 'Target group missing after Add Bookmark').to.not.be.undefined;
        expect(target?.files, 'Target group files missing').to.not.be.undefined;
        const fileMatches = (target?.files ?? []).filter(file => normalizeRelativePath(file) === normalizeRelativePath(testFileRelativePath));
        expect(fileMatches.length, `Duplicate file entries detected: ${(target?.files ?? []).join(', ')}`).to.equal(1);

        const bookmarkEntries = target?.bookmarks ? Object.entries(target.bookmarks) : [];
        expect(bookmarkEntries.length, 'Expected bookmark to be created').to.be.greaterThan(0);
    });
});
