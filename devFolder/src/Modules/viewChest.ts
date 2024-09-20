import { ItemTypes, Player } from "@minecraft/server";


/** Soruce Code https://github.com/jasonlaubb/Matrix-AntiCheat/blob/main/ac_BP/src/Functions/moderateModel/echestView.ts#L17  */
/**
 * @author jasonlaubb
 * @license AGPLv3
 */

// Constant all item!
var all = ItemTypes.getAll();
const ALL_ITEM: string[] = all.map((item) => item.id);

class EnderChestContainer {
    private container: { [key: number]: string } = [];
    constructor(container: { [key: number]: string }) {
        this.container = container;
    }
    public getItem(i: number) {
        return this.container[i];
    }
}


export function getEnderChest(player: Player): EnderChestContainer | null {
    const itemIncluded = [];
    const container: { [key: number]: string } = {};
    for (const item of ALL_ITEM) {
        try {
            // check how the types of item did the echest included
            player.runCommand(`testfor @s[hasitem={item=${item},location=slot.enderchest}]`);
            itemIncluded.push(item);
        } catch { }
    }
    if (itemIncluded.length == 0) return null;
    for (let i = 0; i < 27; i++) {
        // use the filtered item type and checks for every slot (0-27)
        for (const item of itemIncluded) {
            try {
                player.runCommand(`testfor @s[hasitem={item=${item},location=slot.enderchest,slot=${i}}]`);
                container[i] = item;
                break;
            } catch { }
        }
    }
    return new EnderChestContainer(container);
}