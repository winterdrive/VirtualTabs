export interface DataTransferFileLike {
    readonly uri?: { toString(): string };
}

export function parseUriList(value: unknown): string[] {
    if (typeof value !== 'string') {
        return [];
    }

    return value
        .split(/\r?\n/)
        .map(value => value.trim())
        .filter(value => value.length > 0 && !value.startsWith('#'));
}

export function extractDataTransferFileUris(files: readonly DataTransferFileLike[]): string[] {
    return files
        .map(file => file.uri?.toString())
        .filter((uri): uri is string => typeof uri === 'string' && uri.length > 0);
}

export function uniqueUriStrings(uris: readonly string[]): string[] {
    const unique = new Set<string>();
    for (const uri of uris) {
        unique.add(uri);
    }
    return Array.from(unique);
}

export function formatDraggedFilesPlainText(paths: readonly string[]): string {
    if (paths.length === 0) {
        return '';
    }

    return [
        'Use these files as context:',
        ...paths.map(path => `#file:${path}`)
    ].join('\n');
}
