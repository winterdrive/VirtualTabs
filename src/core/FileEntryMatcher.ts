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
        try {
            return normalizeFsPath(fileURLToPath(storedEntry));
        } catch {
            // A hand-edited or corrupted config can contain a malformed file:// URI
            // (e.g. an unescaped '%'). Treat it as non-matching instead of throwing,
            // so one bad entry doesn't abort the whole add/remove/bookmark operation.
            return undefined;
        }
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
