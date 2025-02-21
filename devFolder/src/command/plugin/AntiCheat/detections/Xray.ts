import { Player, Block } from '@minecraft/server';
import { PlayerDataManager } from '../PlayerData';
import { calculateDistance } from '../utils';
import { handleCheatDetection } from '../actions';

const targetXrayBlockIds = ['minecraft:diamond_ore', 'minecraft:ancient_debris', 'minecraft:emerald_ore', 'minecraft:iron_ore', 'minecraft:gold_ore', 'minecraft:lapis_ore', 'minecraft:redstone_ore', 'minecraft:nether_quartz_ore', 'minecraft:nether_gold_ore'];

const WORLD_MIN_X = -30000000;
const WORLD_MAX_X = 30000000;
const WORLD_MIN_Y = -64;
const WORLD_MAX_Y = 320;
const WORLD_MIN_Z = -30000000;
const WORLD_MAX_Z = 30000000;


export function getBlockFromReticle(player: Player, maxDistance: number): Block | null {
    const playerDimension = player.dimension;
    const playerLocation = player.getHeadLocation();
    const viewDirection = player.getViewDirection();

    for (let i = 0; i <= maxDistance; i++) {
        const currentPosition = {
            x: Math.floor(playerLocation.x + viewDirection.x * i),
            y: Math.floor(playerLocation.y + viewDirection.y * i),
            z: Math.floor(playerLocation.z + viewDirection.z * i),
        };

        // ワールド境界チェック
        if (currentPosition.x < WORLD_MIN_X || currentPosition.x > WORLD_MAX_X ||
            currentPosition.y < WORLD_MIN_Y || currentPosition.y > WORLD_MAX_Y ||
            currentPosition.z < WORLD_MIN_Z || currentPosition.z > WORLD_MAX_Z) {
            continue;
        }

        const block = playerDimension.getBlock(currentPosition);
        if (block && targetXrayBlockIds.includes(block.typeId)) {
            return block;
        }
    }
    return null;
}


export function detectXrayOnSight(player: Player, configs: any, playerDataManager: PlayerDataManager): void {
    // データ取得と初期化
    if (!playerDataManager.has(player)) playerDataManager.initialize(player);
    const suspiciousBlocks = playerDataManager.getData(player, "suspiciousBlocks") ?? {};


    const targetBlock = getBlockFromReticle(player, configs.antiCheat.xrayDetectionDistance);

    if (targetBlock && targetXrayBlockIds.includes(targetBlock.typeId)) {
        const distanceToBlock = calculateDistance(player.location, targetBlock.location);
        if (distanceToBlock > 4) { // プレイヤーがブロックから4ブロック以上離れている場合のみ検知
            const blockLocationString = `${targetBlock.location.x},${targetBlock.location.y},${targetBlock.location.z}`;
            const currentTime = Date.now();

            if (suspiciousBlocks[blockLocationString]) {
                suspiciousBlocks[blockLocationString].count++;
            } else {
                suspiciousBlocks[blockLocationString] = { timestamp: currentTime, count: 1 };
            }
            playerDataManager.updateData(player, "suspiciousBlocks", suspiciousBlocks); // playerData を更新
        }
    }
}

export function handleBlockBreak(event: any, playerDataManager: PlayerDataManager, configs: any) {
    const player = event.player;
    const blockLocation = event.block.location;

    if (!playerDataManager.has(player)) playerDataManager.initialize(player);
    const suspiciousBlocks = playerDataManager.getData(player, "suspiciousBlocks") ?? {};

    const blockLocationString = `${blockLocation.x},${blockLocation.y},${blockLocation.z}`;
    if (suspiciousBlocks[blockLocationString]) {
        handleCheatDetection(player, { cheatType: 'Xray' }, configs, playerDataManager);
        delete suspiciousBlocks[blockLocationString];
        playerDataManager.updateData(player, "suspiciousBlocks", suspiciousBlocks); // playerData を更新
    }
}