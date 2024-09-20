import { ItemTypes, Player } from "@minecraft/server";

/**
 * Ender Chest Container class to store and access Ender Chest contents.
 */
class EnderChestContainer {
    private container: { [key: number]: string } = {};

    constructor(container: { [key: number]: string }) {
        this.container = container;
    }

    /**
     * Get the item ID at the specified slot index.
     * @param i Slot index (0-26)
     * @returns Item ID or undefined if slot is empty.
     */
    public getItem(i: number): string | undefined {
        return this.container[i];
    }
}

/**
 * Retrieves the contents of a player's Ender Chest.
 * @param player The player whose Ender Chest to access.
 * @returns EnderChestContainer object or null if Ender Chest is empty.
 */
export function getEnderChest(player: Player): EnderChestContainer | null {
    const container: { [key: number]: string } = {};

    // Iterate through Ender Chest slots (0-26)
    for (let i = 0; i < 27; i++) {
        // Iterate through all item types
        for (const item of ItemTypes.getAll()) {
            try {
                // Check if the current slot contains the current item type
                player.runCommand(`testfor @s[hasitem={item=${item.id},location=slot.enderchest,slot=${i}}]`);
                container[i] = item.id; // Store the item ID if found
                break; // Move to the next slot
            } catch {
                // Ignore errors (item not found in the slot)
            }
        }
    }

    // Return EnderChestContainer if items were found, otherwise null
    return Object.keys(container).length > 0 ? new EnderChestContainer(container) : null;
}