import { config } from '../../Modules/Util';
import { registerCommand, verifier } from '../../Modules/Handler';
import { Player, ItemStack, EquipmentSlot, world, system, BlockRaycastOptions, Direction } from '@minecraft/server';
import { translate } from '../langs/list/LanguageManager';

interface OffhandItemData {
    typeId: string;
    durability: number;
    hasEnchantments: boolean;
}

const offhandData: { [playerName: string]: OffhandItemData } = {}; // プレイヤーとオフハンドアイテムID、耐久値、エンチャント有無を保存
const lastPlacementTime: { [playerName: string]: number } = {}; // プレイヤーごとの前回の設置時刻を記録


function fetchPlayerEquipments(player: Player): (ItemStack | undefined)[] {
    const equipment = player.getComponent("equippable");
    if (!equipment) {
        return [];
    }
    return [
        equipment.getEquipment(EquipmentSlot.Head),
        equipment.getEquipment(EquipmentSlot.Chest),
        equipment.getEquipment(EquipmentSlot.Legs),
        equipment.getEquipment(EquipmentSlot.Feet),
        equipment.getEquipment(EquipmentSlot.Offhand)
    ];
}

function setOffhandItem(player: Player) {
    const inventoryComponent = player.getComponent("inventory");
    const heldItem = inventoryComponent && inventoryComponent.container ? inventoryComponent.container.getItem(player.selectedSlotIndex) : null;

    if (heldItem) {
        // エンチャントが付いているかどうかをチェック
        const enchantableComponent = heldItem.getComponent('enchantable');
        const hasEnchantments = enchantableComponent ? enchantableComponent.getEnchantments().length > 0 : false;

        if (hasEnchantments) {
            player.sendMessage(translate(player, "command.NotEnchant"));
            return;
        }

        const equipments = fetchPlayerEquipments(player);
        const offhandItem = equipments[4]; // Offhandのアイテムを取得

        if (offhandItem) {
            player.sendMessage(translate(player, "command.alreadyOffhand"));
        } else {
            system.runTimeout(() => {
                // メインハンドのアイテムの個数と耐久値を取得
                const amount = heldItem.amount;
                const durabilityComponent = heldItem.getComponent('durability');
                const damage = durabilityComponent ? durabilityComponent.damage : 0;

                // /replaceitem コマンドを使用してオフハンドにアイテムを設定
                // 個数とデータ値（耐久値）を指定
                player.runCommandAsync(`replaceitem entity @s slot.weapon.offhand 0 ${heldItem.typeId} ${amount} ${damage}`);
                if (inventoryComponent && inventoryComponent.container) {
                    inventoryComponent.container.setItem(player.selectedSlotIndex, undefined);
                }
                player.sendMessage(translate(player, "command.OffhandItem"));

                // アイテムID、耐久値、エンチャント有無を保存
                offhandData[player.name] = {
                    typeId: heldItem.typeId,
                    durability: damage,
                    hasEnchantments: hasEnchantments
                };
            }, 6);

        }
    } else {
        player.sendMessage(translate(player, "command.NoMainHand"));
    }
}

function checkOffhandItem(player: Player) {
    const equipments = fetchPlayerEquipments(player);
    const offhandItem = equipments[4]; // Offhandのアイテムを取得

    if (offhandData[player.name]) { // プレイヤーのオフハンドアイテムが設定されている場合
        if (!offhandItem || offhandItem.typeId !== offhandData[player.name].typeId) {
            // オフハンドアイテムが消えているか、異なるアイテムになっている場合
            player.sendMessage(translate(player, "command.RemoveOffhand"));

            delete offhandData[player.name]; // データを削除
        }
    }
}

function handleEmoteBlockPlacement(player: Player) {
    if (!offhandData[player.name]) return;

    const equipments = fetchPlayerEquipments(player);
    const offhandItem = equipments[4];
    const currentTime = Date.now();

    if (offhandItem) {
        const raycastOptions: BlockRaycastOptions = {
            maxDistance: 5,
        };
        const blockHit = player.getBlockFromViewDirection(raycastOptions);

        if (blockHit) {
            // 3秒ごとの設置制限
            if (
                !lastPlacementTime[player.name] ||
                currentTime - lastPlacementTime[player.name] >= 3000
            ) {
                const blockLocation = blockHit.block.location;
                let x = blockLocation.x;
                let y = blockLocation.y;
                let z = blockLocation.z;

                // プレイヤーが見ているブロックの面に基づいて設置位置を調整
                switch (blockHit.face) {
                    case Direction.Up:
                        y++;
                        break;
                    case Direction.Down:
                        y--;
                        break;
                    case Direction.North:
                        z--;
                        break;
                    case Direction.South:
                        z++;
                        break;
                    case Direction.West:
                        x--;
                        break;
                    case Direction.East:
                        x++;
                        break;
                }

                const setblockPromise = player.runCommandAsync(`setblock ${x} ${y} ${z} ${offhandItem.typeId}`);

                setblockPromise.then(() => {
                    if (offhandItem.amount > 1) {
                        player.runCommandAsync(`replaceitem entity @s slot.weapon.offhand 0 ${offhandItem.typeId} ${offhandItem.amount - 1}`);
                    } else {
                        const equipment = player.getComponent("equippable");
                        if (equipment) {
                            equipment.setEquipment(EquipmentSlot.Offhand, undefined);
                            delete offhandData[player.name];
                        }
                    }
                }).catch((error) => {
                    console.error("Error executing setblock command:", error);
                });

                lastPlacementTime[player.name] = currentTime;
            }
        }
    }
}



function checkAllPlayersOffhand() {
    for (const player of world.getPlayers()) {
        checkOffhandItem(player);
    }
}

function runTick() {
    checkAllPlayersOffhand();

    // エモート中のプレイヤーに対してブロック設置処理を実行
    for (const player of world.getPlayers()) {
        if (player.isEmoting) {
            handleEmoteBlockPlacement(player);
        }
    }

    system.runTimeout(runTick, 10); // 5tick後に再度実行
}


// コマンドの登録
registerCommand({
    name: 'offhand',
    description: 'Manage offhand item. | オフハンドアイテムを管理します。',
    parent: false,
    maxArgs: 1,
    minArgs: 1,
    require: (player: Player) => verifier(player, config().commands['offhand']),
    executor: (player: Player, args: string[]) => {
        if (args[0] === '-set') {
            setOffhandItem(player);
        } else {
            player.sendMessage(translate(player, "command.offhandUsage"));
        }
    },
});

// システムの初期化とループの開始
runTick();