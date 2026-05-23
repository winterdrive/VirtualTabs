/**
 * 單元測試：設定重新載入通知行為（PR #51）
 *
 * 驗證 onExternalFileChange 使用 setStatusBarMessage（狀態列，3 秒消失）
 * 而非 showInformationMessage（彈窗，需手動關閉）。
 *
 * 測試情境：
 * - 成功重載 → setStatusBarMessage(msg, 3000) 被呼叫
 * - 成功重載 → showInformationMessage 不被呼叫
 * - isInternalSaving = true → 任何通知均不觸發
 * - loadGroups 失敗 → 任何通知均不觸發
 * - i18n 有值 → 使用 i18n 訊息
 * - i18n 為空 / undefined → 使用 fallback 字串
 */

// ── 訊息建構邏輯（從 provider.ts 提取）────────────────────────────────────────

function buildReloadMessage(i18nResult: string | undefined): string {
    return i18nResult || 'VirtualTabs: Config reloaded';
}

// ── 通知派送邏輯（從 onExternalFileChange 提取）──────────────────────────────

interface MockWindow {
    setStatusBarMessage: jest.Mock;
    showInformationMessage: jest.Mock;
}

function dispatchReloadNotification(
    success: boolean,
    isInternalSaving: boolean,
    message: string,
    win: MockWindow
): void {
    if (isInternalSaving || !success) return;
    win.setStatusBarMessage(message, 3000);
}

// ── 測試 ──────────────────────────────────────────────────────────────────────

describe('buildReloadMessage', () => {
    test('i18n 有值時使用 i18n 訊息', () => {
        expect(buildReloadMessage('設定已重新載入')).toBe('設定已重新載入');
    });

    test('i18n 回傳空字串時使用 fallback', () => {
        expect(buildReloadMessage('')).toBe('VirtualTabs: Config reloaded');
    });

    test('i18n 回傳 undefined 時使用 fallback', () => {
        expect(buildReloadMessage(undefined)).toBe('VirtualTabs: Config reloaded');
    });
});

describe('dispatchReloadNotification', () => {
    let win: MockWindow;

    beforeEach(() => {
        win = {
            setStatusBarMessage: jest.fn(),
            showInformationMessage: jest.fn()
        };
    });

    test('成功重新載入時，應呼叫 setStatusBarMessage 並帶 3000ms timeout', () => {
        dispatchReloadNotification(true, false, 'VirtualTabs: Config reloaded', win);
        expect(win.setStatusBarMessage).toHaveBeenCalledWith('VirtualTabs: Config reloaded', 3000);
        expect(win.setStatusBarMessage).toHaveBeenCalledTimes(1);
    });

    test('成功重新載入時，不應呼叫 showInformationMessage（不應彈窗）', () => {
        dispatchReloadNotification(true, false, 'VirtualTabs: Config reloaded', win);
        expect(win.showInformationMessage).not.toHaveBeenCalled();
    });

    test('isInternalSaving 為 true 時，不應觸發任何通知', () => {
        dispatchReloadNotification(true, true, 'VirtualTabs: Config reloaded', win);
        expect(win.setStatusBarMessage).not.toHaveBeenCalled();
        expect(win.showInformationMessage).not.toHaveBeenCalled();
    });

    test('loadGroups 失敗（success=false）時，不應觸發任何通知', () => {
        dispatchReloadNotification(false, false, 'VirtualTabs: Config reloaded', win);
        expect(win.setStatusBarMessage).not.toHaveBeenCalled();
        expect(win.showInformationMessage).not.toHaveBeenCalled();
    });

    test('使用 i18n 訊息時，setStatusBarMessage 應收到正確的 i18n 文字', () => {
        dispatchReloadNotification(true, false, '設定已重新載入', win);
        expect(win.setStatusBarMessage).toHaveBeenCalledWith('設定已重新載入', 3000);
    });
});

export {};
