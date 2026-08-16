/**
 * ConfigScopeDiscovery
 *
 * 掃描 VS Code 工作區，建立 ConfigScope 陣列。
 * 支援單一資料夾工作區、多根工作區（.code-workspace）及無工作區情況。
 *
 * 需求：2.1, 2.2, 2.3, 2.4, 2.5, 2.6
 */

import * as vscode from 'vscode';
import { ConfigScope, TempGroup } from '../types.js';

export class ConfigScopeDiscovery {
    /**
     * 掃描工作區，回傳所有 ConfigScope。
     *
     * - 多根工作區（workspaceFile 存在）：回傳一個 workspace scope + 多個 folder scope
     * - 單一資料夾工作區：回傳一個 folder scope
     * - 無工作區資料夾：回傳空陣列
     * - self-root .code-workspace（workspaceFile 父目錄等於某個 folder）：
     *   workspace scope 與該 folder scope 的 id 會是同一個 uri.toString()，
     *   兩者若同時保留會造成 scope id 碰撞（見 provider.ts 的 groupManagers Map key），
     *   因此略過該 workspace scope，只保留 folder scope 作為唯一資料來源。
     */
    static discover(): ConfigScope[] {
        const scopes: ConfigScope[] = [];

        // 為每個 workspaceFolder 建立 folder scope
        const folders = vscode.workspace.workspaceFolders;
        if (folders && folders.length > 0) {
            for (const folder of folders) {
                scopes.push(ConfigScopeDiscovery.createFolderScope(folder));
            }
        }

        // 多根工作區：workspaceFile 存在時，建立 workspace scope
        if (vscode.workspace.workspaceFile) {
            const workspaceScope = ConfigScopeDiscovery.createWorkspaceScope(vscode.workspace.workspaceFile);
            const isSelfRootAlias = scopes.some(scope => scope.id === workspaceScope.id);
            if (!isSelfRootAlias) {
                scopes.unshift(workspaceScope);
            }
        }

        return scopes;
    }

    /**
     * 從 workspaceFile URI 建立 workspace scope。
     * uri 設為 workspaceFile 的父目錄（即 .code-workspace 所在目錄）。
     */
    private static createWorkspaceScope(workspaceFile: vscode.Uri): ConfigScope {
        // workspace scope 的 uri 為 .code-workspace 的父目錄
        const parentUri = vscode.Uri.joinPath(workspaceFile, '..');
        return {
            id: parentUri.toString(),
            type: 'workspace',
            label: 'Workspace',
            uri: parentUri,
            groups: [] as TempGroup[]
        };
    }

    /**
     * 從 WorkspaceFolder 建立 folder scope。
     * label 使用 VS Code 已計算好的 folder.name（尊重多根工作區自訂名稱，
     * 並在資料夾為磁碟根目錄等 path.basename 會回傳空字串的邊緣情況下保有正確名稱）。
     */
    private static createFolderScope(folder: vscode.WorkspaceFolder): ConfigScope {
        return {
            id: folder.uri.toString(),
            type: 'folder',
            label: folder.name,
            uri: folder.uri,
            groups: [] as TempGroup[]
        };
    }
}
