import { ActivityBar, ViewControl, SideBarView, EditorView, VSBrowser } from 'vscode-extension-tester';
import { By } from 'selenium-webdriver';
import { expect } from 'chai';

describe('Virtual Tabs – Basic UI', function () {
    this.timeout(30_000);

    let viewControl: ViewControl;

    before(async function () {
        await VSBrowser.instance.waitForWorkbench();

        // Dismiss the Welcome / Onboarding overlay if it is blocking the UI
        const driver = VSBrowser.instance.driver;
        try {
            const overlay = await driver.findElement(By.css('.onboarding-a-overlay.visible'));
            if (await overlay.isDisplayed()) {
                await driver.executeScript(
                    'arguments[0].remove()',
                    overlay
                );
            }
        } catch {
            // overlay not present — that's fine
        }

        const activityBar = new ActivityBar();
        viewControl = (await activityBar.getViewControl('Virtual Tabs'))!;
        expect(viewControl, 'Virtual Tabs icon not found in Activity Bar').to.not.be.undefined;
    });

    after(async function () {
        await new EditorView().closeAllEditors();
    });

    it('Activity Bar contains the Virtual Tabs icon', async function () {
        const title = await viewControl.getTitle();
        expect(title).to.equal('Virtual Tabs');
    });

    it('Clicking the icon opens the sidebar', async function () {
        const sidebar = (await viewControl.openView()) as SideBarView;
        expect(sidebar).to.not.be.undefined;
    });

    it('Sidebar title section reads "Virtual Tabs"', async function () {
        const sidebar = (await viewControl.openView()) as SideBarView;
        const title = await sidebar.getTitlePart().getTitle();
        expect(title.toLowerCase()).to.include('virtual tabs');
    });

    it('Add Group button is NOT visible in the sidebar toolbar (multi-root workspace uses per-scope inline buttons)', async function () {
        const sidebar = (await viewControl.openView()) as SideBarView;
        const titlePart = sidebar.getTitlePart();
        const actions = await titlePart.getActions();
        const titles = await Promise.all(actions.map((a) => a.getTitle()));
        expect(titles.some((t: string) => /add group/i.test(t))).to.be.false;
    });
});
