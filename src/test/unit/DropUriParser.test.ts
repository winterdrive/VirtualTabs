import { extractDataTransferFileUris, parseUriList, uniqueUriStrings } from '../../core/DropUriParser';

describe('DropUriParser', () => {
    test('parses text/uri-list with comments, blank lines, and CRLF', () => {
        const result = parseUriList([
            '# copied from explorer',
            'file:///workspace/project/src/index.ts',
            '',
            ' file:///workspace/project/package.json ',
            ''
        ].join('\r\n'));

        expect(result).toEqual([
            'file:///workspace/project/src/index.ts',
            'file:///workspace/project/package.json'
        ]);
    });

    test('returns no URIs for non-string uri-list values', () => {
        expect(parseUriList(undefined)).toEqual([]);
        expect(parseUriList(['file:///tmp/a.ts'])).toEqual([]);
    });

    test('extracts URI strings from DataTransferFile-like entries', () => {
        const result = extractDataTransferFileUris([
            { uri: { toString: () => 'file:///workspace/project' } },
            { uri: undefined },
            { uri: { toString: () => '' } }
        ]);

        expect(result).toEqual(['file:///workspace/project']);
    });

    test('deduplicates URI strings while preserving first-seen order', () => {
        expect(uniqueUriStrings([
            'file:///workspace/a.ts',
            'file:///workspace/b.ts',
            'file:///workspace/a.ts'
        ])).toEqual([
            'file:///workspace/a.ts',
            'file:///workspace/b.ts'
        ]);
    });
});
