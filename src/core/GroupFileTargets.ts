export interface GroupIndexedItem {
    groupIdx: number;
}

export function groupItemsByGroupIdx<T extends GroupIndexedItem>(items: T[]): Map<number, T[]> {
    const itemsByGroup = new Map<number, T[]>();

    for (const item of items) {
        const current = itemsByGroup.get(item.groupIdx);
        if (current) {
            current.push(item);
        } else {
            itemsByGroup.set(item.groupIdx, [item]);
        }
    }

    return itemsByGroup;
}
