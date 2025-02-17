import { Player, system, EntityInventoryComponent } from "@minecraft/server";
import { Handler } from "../../module/Handler";
import { Module, moduleManager } from "../../module/module";



interface LoreFormDefinition {
    type: "rename" | "add" | "remove" | "clear";
    body?: string;       // rename, add, remove の場合に使用
    slot?: number;       // 指定がない場合は undefined (メインハンド)
}

class LoreEditorModule implements Module {
    name = "LoreEditor";
    enabledByDefault = true;
    docs = `Loreを編集。\n
§r- コマンド: §9/scriptevent ws:lore <JSON>\n
§r- JSON形式:\n
  §r  - §9type§r: "rename" | "add" | "remove" | "clear"\n
  §r  - §9body§r: 文字列 (rename, add, removeで使用)\n
  §r  - §9slot§r: (任意)スロット番号。無指定はメインハンド`;


    constructor() {
    }

    async editLore(player: Player, formDefinition: LoreFormDefinition): Promise<void> {

        const inventoryComponent = player.getComponent('minecraft:inventory') as EntityInventoryComponent;
        if (!inventoryComponent || !inventoryComponent.container) {
            player.sendMessage("§cエラー: インベントリが取得できません。");
            return;
        }
        const container = inventoryComponent.container;

        // slot が指定されていない場合はメインハンドのスロットを使用
        const targetSlot = formDefinition.slot !== undefined ? formDefinition.slot : player.selectedSlotIndex;

        if (targetSlot < 0 || targetSlot >= container.size) {
            player.sendMessage(`§cエラー: 無効なスロット番号です: ${targetSlot}`);
            return;
        }


        const item = container.getItem(targetSlot);
        if (!item) {
            player.sendMessage("§cエラー: 指定されたスロットにアイテムがありません。");
            return;
        }

        switch (formDefinition.type) {
            case "rename":
                if (!formDefinition.body) {
                    player.sendMessage("§cエラー: rename には body が必要です。");
                    return;
                }
                this.renameItem(item, formDefinition.body, player, targetSlot);
                break;
            case "add":
                if (!formDefinition.body) {
                    player.sendMessage("§cエラー: add には body が必要です。");
                    return;
                }
                this.addLore(item, formDefinition.body, player, targetSlot);
                break;
            case "remove":
                if (!formDefinition.body) {
                    player.sendMessage("§cエラー: remove には body が必要です。");
                    return;
                }
                this.removeSpecificLore(item, formDefinition.body, player, targetSlot);
                break;
            case "clear":
                this.removeLore(item, player, targetSlot);
                break;
            default:
                player.sendMessage("§cエラー: 不明な type です。");
                return;
        }
        player.sendMessage(`§a${formDefinition.type}を実行しました。`);

    }


    /**
     * アイテムの名前を変更する関数
     * @param item アイテム
     * @param NewName 新しい名前
     * @param player プレイヤー
     * @param targetSlot クローン先のスロット
     */
    renameItem(item: any, NewName: string, player: Player, targetSlot: number) {
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
    removeLore(item: any, player: Player, targetSlot: number) {
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
    addLore(item: any, loreText: string, player: Player, targetSlot: number) {
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
    removeSpecificLore(item: any, loreText: string, player: Player, targetSlot: number) {
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



    registerCommands(handler: Handler): void {
        handler.registerCommand("lore", {
            moduleName: this.name,
            description: `手に持っているアイテム、または指定したスロットのアイテムのLoreを編集します。`,
            usage: `lore {"type": "add", "body": "追加する説明", "slot": 0}\nlore {"type": "remove", "body": "削除する説明"}\nlore {"type":"rename", "body": "新しい名前"}\nlore {"type": "clear"}`,
            execute: (message, event) => {
                if (!(event.sourceEntity instanceof Player)) return;

                const player = event.sourceEntity;
                const jsonString = message;

                try {
                    if (!jsonString) {
                        throw new Error("JSON definition is empty");
                    }
                    const formDefinition: LoreFormDefinition = JSON.parse(jsonString);

                    if (!formDefinition.type || !["rename", "add", "remove", "clear"].includes(formDefinition.type)) {
                        throw new Error("Invalid or missing 'type' property. Must be 'rename', 'add', 'remove', or 'clear'.");
                    }

                    this.editLore(player, formDefinition);

                } catch (error) {
                    player.sendMessage(`§c無効な JSON 形式です: ${error}`);
                    console.error(`Invalid JSON format or missing 'type' property: ${error}`);
                    return;
                }
            }
        });
    }
}

const loreEditorModule = new LoreEditorModule();
moduleManager.registerModule(loreEditorModule);