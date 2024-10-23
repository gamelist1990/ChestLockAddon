import { config } from '../../Modules/Util';
import { registerCommand, verifier } from '../../Modules/Handler';
import { EntityInventoryComponent, Player, system, world } from '@minecraft/server';
import { renameItem } from '../plugin/lore';
import { banPlayers } from '../../Modules/globalBan';

let isServerPaused = false; // サーバーが一時停止されているかどうかを追跡する変数
let isRealTimePingEnabled = false; // リアルタイムping検知が有効かどうか
const playerPingData: Record<string, { lastPingRequestTime: number }> = {};




function getPingLevel(ping: number): string {
    if (ping < 40) {
        return "§a通常";
    } else if (ping < 120) {
        return "§eちょいラグい";
    } else if (ping < 300) {
        return "§gかなりラグい";
    } else if (ping < 800) {
        return "§cめちゃラグい";
    } else {
        return "§dラグさ上限突破！！";
    }
}


system.runInterval(async () => { // async 関数に変更
    if (isRealTimePingEnabled) {
        const players = world.getPlayers();

        for (const player of players) {
            if (!playerPingData[player.name]) {
                playerPingData[player.name] = {
                    lastPingRequestTime: 0,
                };
            }

            const playerData = playerPingData[player.name];

            if (Date.now() - playerData.lastPingRequestTime > 1000) {
                playerData.lastPingRequestTime = Date.now();

                const { ping, level } = await getPing(player);

                player.onScreenDisplay.setActionBar(`Ping: ${ping}ms | Level: ${level}`);
                console.log(`Player ${player.name}: Ping = ${ping}ms`);
            }
        }
    }
}, 20);



export function getPing(player: Player): Promise<{ ping: number; level: string }> {
    const startTime = Date.now();
    return new Promise<{ ping: number; level: string }>(resolve => {
        player.runCommandAsync('testfor @s').then(() => {
            const endTime = Date.now();
            const ping = Math.abs(endTime - startTime - 50);
            const level = getPingLevel(ping);
            resolve({ ping, level });
        });
    });
}


export function toggleServerPause() {
    isServerPaused = !isServerPaused; // 一時停止状態を反転

    if (isServerPaused) {
        system.runTimeout(() => { // 1 ティック遅延させてゲームルールを変更
            // 一時停止 
            world.gameRules.mobGriefing = false;
            world.gameRules.doFireTick = false;
            world.gameRules.tntExplodes = false;
            world.gameRules.respawnBlocksExplode = false;
            world.sendMessage('Server paused. Protection enabled');

            // 全プレイヤーの現在地
            for (const player of world.getPlayers()) {
                const { x, y, z } = player.location;
                world.sendMessage(`§f>>§a${player.name}'s   §blocation: x= ${Math.floor(x)}, y= ${Math.floor(y)}, z= ${Math.floor(z)}`);
            }
        }, 1);
    } else {
        system.runTimeout(() => { // 1 ティック遅延させてゲームルールを変更
            // 再開
            world.gameRules.mobGriefing = true;
            world.gameRules.doFireTick = true;
            world.gameRules.tntExplodes = true;
            world.gameRules.respawnBlocksExplode = true;
            world.sendMessage('Server resumed. Protection disabled');
        }, 1);
    }
}

export function outputPlayerData(player: Player) {
    const playerData = [];
    for (const p of world.getPlayers()) {
        playerData.push({
            name: p.name,
            id: p.id
        });
    }

    // プレイヤーの手持ちアイテムを取得
    const inventoryComponent = player.getComponent('minecraft:inventory') as EntityInventoryComponent;
    if (inventoryComponent && inventoryComponent.container) {
        const item = inventoryComponent.container.getItem(0); // ホットバーの最初のスロットからアイテムを取得
        if (item && item.typeId === 'minecraft:writable_book') { // writable_bookかどうかを確認

            // 全プレイヤーの情報をJSON文字列に変換
            const allPlayerData = JSON.stringify(playerData);

            renameItem(item, allPlayerData, player, 0); // renameItem関数で名前を変更

        } else {
            player.sendMessage('ホットバーの最初のスロットに書き込み可能な本を持ってください。');
        }
    }

    console.warn(JSON.stringify(playerData));
    player.sendMessage("Check Book")
}

export function checkBanList(player: Player) {
    // banPlayers 配列の情報を文字列に変換
    let banListMessage = "Ban List:\n";
    for (const bannedPlayer of banPlayers) {
        banListMessage += `- Name: ${bannedPlayer.name || "N/A"}, ID: ${bannedPlayer.id || "N/A"}\n`;
    }

    player.sendMessage(banListMessage);
}
const startTime = Date.now();

function displayServerInfo(player: Player, type: string) {
    switch (type) {
        case 'uptime':
            // スクリプト開始時からの経過時間をミリ秒単位で取得
            const elapsedTimeMs = Date.now() - startTime;
            // ミリ秒を秒に変換
            const uptimeSeconds = Math.floor(elapsedTimeMs / 1000);
            const uptimeMinutes = Math.floor(uptimeSeconds / 60);
            const uptimeHours = Math.floor(uptimeMinutes / 60);
            const uptimeDays = Math.floor(uptimeHours / 24);
            const remainingHours = uptimeHours % 24;
            const remainingMinutes = uptimeMinutes % 60;
            const remainingSeconds = uptimeSeconds % 60;

            world.sendMessage(`サーバーの起動時間: ${uptimeDays}d ${remainingHours}h ${remainingMinutes}m ${remainingSeconds}s`);
            break;
        default:
            player.sendMessage('Invalid info type.');
    }
}




registerCommand({
    name: 'server',
    description: 'server_command_description',
    parent: false,
    maxArgs: 3, // サブコマンド用に maxArgs を 3 に変更
    minArgs: 1,
    require: (player: Player) => verifier(player, config().commands['server']),
    executor: (player: Player, args: string[]) => {
        if (args[0] === '-pause') {
            toggleServerPause();
        } else if (args[0] === '-check') {
            outputPlayerData(player);
        } else if (args[0] === '-checkban') {
            checkBanList(player);
        } else if (args[0] === '-info' && args[1]) {
            displayServerInfo(player, args[1]);
        } else if (args[0] === '-ping') {
            if (args[1] === '-true') {
                isRealTimePingEnabled = true;
                player.sendMessage('リアルタイムping検知を有効にしました。');
            } else if (args[1] === '-false') {
                isRealTimePingEnabled = false;
                player.sendMessage('リアルタイムping検知を無効にしました。');
            } else {
                const startTime = Date.now();
                new Promise<void>(resolve => {
                    system.run(() => {
                        const endTime = Date.now();
                        const ping = Math.abs(endTime - startTime - 50);
                        const level = getPingLevel(ping);
                        player.sendMessage(`Ping: ${ping}ms | Level: ${level}`);
                        resolve();
                    });
                }).then(() => { });
            }
        } else {
            player.sendMessage('Invalid argument. Use "-pause", "-check", "-checkban", "-info <seed|uptime|tps>", or "-ping [-true|-false]".');
        }
    },
});