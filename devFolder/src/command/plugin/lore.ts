import { c } from '../../Modules/Util';
import { registerCommand, verifier, prefix } from '../../Modules/Handler';
import { Player, EntityInventoryComponent, system } from '@minecraft/server';
import { translate } from '../langs/list/LanguageManager';

/**
 * アイテムの名前を変更する関数
 * @param item アイテム
 * @param newName 新しい名前
 * @param player プレイヤー
 * @param targetSlot クローン先のスロット
 */
function renameItem(item: any, newName: string, player: Player, targetSlot: number) {
    system.runTimeout(() => {
        if (item) {
            item.nameTag = newName;
            const inventoryComponent = player.getComponent('minecraft:inventory') as EntityInventoryComponent;
            if (inventoryComponent && inventoryComponent.container) {
                const container = inventoryComponent.container;
                container.setItem(targetSlot, item);
            }
        }
    }, 1);
}

/**
 * アイテムのLoreを削除する関数
 * @param item アイテム
 * @param player プレイヤー
 * @param targetSlot クローン先のスロット
 */
function removeLore(item: any, player: Player, targetSlot: number) {
    system.runTimeout(() => {
        if (item) {
            item.setLore([]);
            const inventoryComponent = player.getComponent('minecraft:inventory') as EntityInventoryComponent;
            if (inventoryComponent && inventoryComponent.container) {
                const container = inventoryComponent.container;
                container.setItem(targetSlot, item);
            }
        }
    }, 1);
}

/**
 * アイテムにLoreを追加する関数
 * @param item アイテム
 * @param loreText 追加するLoreのテキスト
 * @param player プレイヤー
 * @param targetSlot クローン先のスロット
 */
function addLore(item: any, loreText: string, player: Player, targetSlot: number) {
    system.runTimeout(() => {
        if (item) {
            const currentLore = item.getLore() || [];
            currentLore.push(loreText);
            item.setLore(currentLore);
            const inventoryComponent = player.getComponent('minecraft:inventory') as EntityInventoryComponent;
            if (inventoryComponent && inventoryComponent.container) {
                const container = inventoryComponent.container;
                container.setItem(targetSlot, item);
            }
        }
    }, 1);
}

/**
 * アイテムから特定のLoreを削除する関数
 * @param item アイテム
 * @param loreText 削除するLoreのテキスト
 * @param player プレイヤー
 * @param targetSlot クローン先のスロット
 */
function removeSpecificLore(item: any, loreText: string, player: Player, targetSlot: number) {
    system.runTimeout(() => {
        if (item) {
            const currentLore = item.getLore() || [];
            const newLore = currentLore.filter((line: string) => line !== loreText);
            item.setLore(newLore);
            const inventoryComponent = player.getComponent('minecraft:inventory') as EntityInventoryComponent;
            if (inventoryComponent && inventoryComponent.container) {
                const container = inventoryComponent.container;
                container.setItem(targetSlot, item);
            }
        }
    }, 1);
}

registerCommand({
    name: 'lore',
    description: 'loreCom',
    parent: false,
    maxArgs: -1,
    minArgs: 2,
    require: (player: Player) => verifier(player, c().commands['lore']),
    executor: (player: Player, args: string[]) => {
        // 引数が提供されていない場合のチェックを追加
        if (!args || args.length < 2) {
            player.sendMessage(translate(player, "Usagelore", { prefix: `${prefix}` }));
            return;
        }

        const inventoryComponent = player.getComponent('minecraft:inventory') as EntityInventoryComponent;
        let heldItem = inventoryComponent && inventoryComponent.container ? inventoryComponent.container.getItem(player.selectedSlotIndex) : null;

        // Check for -slot argument
        const slotIndex = args.indexOf('-slot');
        let targetSlot = player.selectedSlotIndex;
        if (slotIndex !== -1 && args.length > slotIndex + 1) {
            const slot = parseInt(args[slotIndex + 1], 10);
            if (!isNaN(slot) && slot >= 0 && inventoryComponent && inventoryComponent.container && slot < inventoryComponent.container.size) {
                heldItem = inventoryComponent.container.getItem(slot);
                targetSlot = slot; // Set targetSlot to the same slot
                args.splice(slotIndex, 2); // Remove -slot argument from args
            }
        }

        if (!heldItem) {
            player.sendMessage(translate(player, "TakeItem"));
            return;
        }

        const subCommand = args[0].toLowerCase();

        if (subCommand === '-set') {
            const loreText = args.slice(1).join(' ');
            addLore(heldItem, loreText, player, targetSlot);
            player.sendMessage(translate(player, "ADDLore"));
        } else if (subCommand === '-remove') {
            const loreText = args.slice(1).join(' ');
            removeSpecificLore(heldItem, loreText, player, targetSlot);
            const currentLore = heldItem.getLore() || [];
            if (currentLore.length === heldItem.getLore()?.length) {
                player.sendMessage(translate(player, "NotFoundLore"));
            } else {
                player.sendMessage(translate(player, "RemoveLore"));
            }
        } else if (subCommand === '-rename') {
            const newName = args.slice(1).join(' ');
            renameItem(heldItem, newName, player, targetSlot);
            player.sendMessage(translate(player, "ChangeNames"));
        } else if (subCommand === '-clearlore') {
            removeLore(heldItem, player, targetSlot);
            player.sendMessage(translate(player, "RemoveLore"));
        } else {
            player.sendMessage(translate(player, "Usagelore", { prefix: `${prefix}` }));
        }
    },
});
