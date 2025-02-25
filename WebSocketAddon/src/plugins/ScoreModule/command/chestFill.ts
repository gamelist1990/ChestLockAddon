import { ItemLockMode, Player, system, world, BlockInventoryComponent, ItemStack, Vector3, EnchantmentTypes } from "@minecraft/server";
import { Handler } from "../../../module/Handler";

interface ItemData {
    id: string;
    amount?: number;
    data?: number;
    name?: string;
    lore?: string[];
    lockMode?: ItemLockMode;
    keepOnDeath?: boolean;
    enchantments?: { type: string; level?: number }[];
}

interface ChestFillData {
    locations: { x: number; y: number; z: number }[];
    items: ItemData[];
    randomSlot?: boolean;
}

export function registerChestFillCommand(handler: Handler, moduleName: string) {
    handler.registerCommand('chestFill', {
        moduleName: moduleName,
        description: '指定された座標のコンテナブロックに、指定されたアイテムを格納します。',
        usage: 'chestFill <JSON>\n  <JSON>: {"locations":[{"x":0,"y":64,"z":0},...],"items":[{"id":"minecraft:diamond",...},...],"randomSlot":true}',
        execute: (_message, event) => {
            const consoleOutput = (msg: string) => console.warn(msg);

            const sendMessage = (msg: string) => {
                if (event.sourceEntity instanceof Player) {
                    const player = event.sourceEntity;
                    system.run(() => player.sendMessage(msg));
                } else {
                    consoleOutput(msg);
                }
            };

            try {
                const matchResult = event.message.match(/\{.*\}/);
                if (!matchResult) {
                    sendMessage('JSONオブジェクトが見つかりませんでした。');
                    return;
                }

                const chestFillDataStr = matchResult[0];
                const chestFillData: ChestFillData = JSON.parse(chestFillDataStr);


                if (!chestFillData.locations || !chestFillData.items) {
                    sendMessage('JSONは "locations" と "items" 配列を含む必要があります。');
                    return;
                }
                if (!Array.isArray(chestFillData.locations) || !Array.isArray(chestFillData.items)) {
                    sendMessage('"locations" と "items" は配列である必要があります。');
                    return;
                }
                if (chestFillData.locations.length === 0) {
                    sendMessage('"locations" は空にできません。');
                    return;
                }

                const dimension = event.sourceEntity?.dimension ?? world.getDimension('overworld');
                const randomSlot = chestFillData.randomSlot ?? false;

                for (const loc of chestFillData.locations) {
                    if (typeof loc.x !== 'number' || typeof loc.y !== 'number' || typeof loc.z !== 'number') {
                        sendMessage('座標は数値で指定してください。');
                        continue;
                    }

                    const blockLoc: Vector3 = { x: loc.x, y: loc.y, z: loc.z };
                    const block = dimension.getBlock(blockLoc);

                    if (!block) {
                        consoleOutput(`座標 ${blockLoc.x}, ${blockLoc.y}, ${blockLoc.z} にブロックが見つかりません。`);
                        continue;
                    }

                    const inventoryComponent = block.getComponent('inventory') as BlockInventoryComponent;
                    if (!inventoryComponent) {
                        consoleOutput(`座標 ${blockLoc.x}, ${blockLoc.y}, ${blockLoc.z} のブロックはインベントリを持ちません。`);
                        continue;
                    }

                    const container = inventoryComponent.container;
                    if (!container) {
                        consoleOutput(`座標 ${blockLoc.x}, ${blockLoc.y}, ${blockLoc.z} のコンテナが取得できません。`);
                        continue;
                    }


                    for (const itemData of chestFillData.items) {
                        try {
                            const itemStack = new ItemStack(itemData.id, itemData.amount ?? 1);

                            if (itemData.name) {
                                itemStack.nameTag = itemData.name;
                            }
                            if (itemData.lore) {
                                itemStack.setLore(itemData.lore);
                            }
                            if (itemData.lockMode) {
                                itemStack.lockMode = itemData.lockMode
                            }
                            if (itemData.keepOnDeath) {
                                itemStack.keepOnDeath = itemData.keepOnDeath
                            }


                            if (itemData.enchantments) {
                                const enchantable = itemStack.getComponent('enchantable');
                                if (enchantable) {
                                    for (const enchantData of itemData.enchantments) {
                                        try {
                                            const enchantmentType = EnchantmentTypes.get(enchantData.type);
                                            if (!enchantmentType) {
                                                throw new Error(`Invalid enchantment type: ${enchantData.type}`);
                                            }

                                            enchantable.addEnchantment({ type: enchantmentType, level: enchantData.level ?? 1 });
                                        } catch (enchError) {
                                            consoleOutput(`エンチャント追加エラー: ${enchError}`);
                                        }
                                    }
                                }

                            }


                            if (randomSlot) {
                                let slot = Math.floor(Math.random() * container.size);
                                let maxAttempts = container.size; 
                                let attempts = 0;
                                while (container.getItem(slot) && attempts < maxAttempts) {
                                    slot = Math.floor(Math.random() * container.size);
                                    attempts++;
                                }
                                if (attempts < maxAttempts) {
                                    system.run(() => container.setItem(slot, itemStack));
                                } else {
                                    consoleOutput(`座標 ${blockLoc.x}, ${blockLoc.y}, ${blockLoc.z} のコンテナに空きスロットが見つかりませんでした。`);
                                }

                            } else {
                                let added = false;
                                for (let i = 0; i < container.size; i++) {
                                    if (!container.getItem(i)) {
                                        system.run(() => container.setItem(i, itemStack));
                                        added = true;
                                        break;
                                    }
                                }
                                if (!added) {
                                    consoleOutput(`座標 ${blockLoc.x}, ${blockLoc.y}, ${blockLoc.z} のコンテナに空きスロットが見つかりませんでした。`);
                                }

                            }
                        } catch (itemError) {
                            consoleOutput(`アイテム処理エラー: ${itemError}`);
                            sendMessage(`アイテム処理エラー: ${itemError}`); 
                        }
                    }
                }
            } catch (error) {
                consoleOutput(`JSON解析エラー、または処理中にエラーが発生しました: ${error}`);
                sendMessage(`JSON解析エラー、または処理中にエラーが発生しました: ${error}`);
            }
        },
    });
}