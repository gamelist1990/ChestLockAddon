import { config } from '../../Modules/Util';
import { registerCommand, verifier, prefix } from '../../Modules/Handler';
import { Player, EntityInventoryComponent, system } from '@minecraft/server';
import { translate } from '../langs/list/LanguageManager';

/**
 * アイテムの名前を変更する関数
 * @param item アイテム
 * @param command.NewName 新しい名前
 * @param player プレイヤー
 * @param targetSlot クローン先のスロット
 */
export function renameItem(item: any, NewName: string, player: Player, targetSlot: number) {
    system.runTimeout(() => {
        if (item) {
            item.nameTag = NewName;
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
function RemoveLore(item: any, player: Player, targetSlot: number) {
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
function AddLore(item: any, loreText: string, player: Player, targetSlot: number) {
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
            const NewLore = currentLore.filter((line: string) => line !== loreText);
            item.setLore(NewLore);
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
    description: 'lore_docs',
    parent: false,
    maxArgs: -1,
    minArgs: 1, // Changed minArgs to 1 to allow for just 'lore -clear'
    require: (player: Player) => verifier(player, config().commands['lore']),
    executor: (player: Player, args: string[]) => {
        // 引数が提供されていない場合のチェックを追加
        if (!args || args.length < 1) { // Changed condition to check for at least 1 argument
            player.sendMessage(translate(player, "command.lore.UsageLore", { prefix: `${prefix}` }));
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
            player.sendMessage(translate(player, "command.lore.takeItem"));
            return;
        }

        const subCommand = args[0].toLowerCase();

        if (subCommand === '-set') {
            if (args.length < 2) { // Check if there's enough arguments for -set
                player.sendMessage(translate(player, "command.lore.UsageLore", { prefix: `${prefix}` }));
                return;
            }
            const loreText = args.slice(1).join(' ');
            AddLore(heldItem, loreText, player, targetSlot);
            player.sendMessage(translate(player, "command.lore.AddLore"));
        } else if (subCommand === '-remove') {
            if (args.length < 2) { // Check if there's enough arguments for -remove
                player.sendMessage(translate(player, "command.lore.UsageLore", { prefix: `${prefix}` }));
                return;
            }
            const loreText = args.slice(1).join(' ');
            removeSpecificLore(heldItem, loreText, player, targetSlot);
            const currentLore = heldItem.getLore() || [];
            if (currentLore.length === heldItem.getLore()?.length) {
                player.sendMessage(translate(player, "command.lore.NotFoundLore"));
            } else {
                player.sendMessage(translate(player, "command.lore.RemoveLore"));
            }
        } else if (subCommand === '-rename') {
            if (args.length < 2) { // Check if there's enough arguments for -rename
                player.sendMessage(translate(player, "command.lore.UsageLore", { prefix: `${prefix}` }));
                return;
            }
            const NewName = args.slice(1).join(' ');
            renameItem(heldItem, NewName, player, targetSlot);
            player.sendMessage(translate(player, "command.lore.ChangeNames"));
        } else if (subCommand === '-clear') {
            RemoveLore(heldItem, player, targetSlot);
            player.sendMessage(translate(player, "command.lore.RemoveLore"));
        } else {
            player.sendMessage(translate(player, "command.lore.UsageLore", { prefix: `${prefix}` }));
        }
    },
});