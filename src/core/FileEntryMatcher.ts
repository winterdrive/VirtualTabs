import * as path from 'path';
import { fileURLToPath } from 'url';

function normalizeFsPath(fsPath: string): string {
    const normalized = path.normalize(fsPath);
    return process.platform === 'win32' ? normalized.toLowerCase() : normalized;
}

function toComparableFsPath(storedEntry: string, scopeRoot?: string): string | undefined {
    if (!storedEntry) {
        return undefined;
    }

    if (storedEntry.startsWith('file://')) {
        return normalizeFsPath(fileURLToPath(storedEntry));
    }

    if (path.isAbsolute(storedEntry)) {
        return normalizeFsPath(storedEntry);
    }

    if (!scopeRoot) {
        return undefined;
    }

    return normalizeFsPath(path.resolve(scopeRoot, storedEntry));
}

export function matchesStoredFileEntry(
    storedEntry: string,
    targetUri: string,
    targetFsPath: string,
    scopeRoot?: string
): boolean {
    if (storedEntry === targetUri) {
        return true;
    }

    const entryFsPath = toComparableFsPath(storedEntry, scopeRoot);
    if (!entryFsPath) {
        return false;
    }

    return entryFsPath === normalizeFsPath(targetFsPath);
}
