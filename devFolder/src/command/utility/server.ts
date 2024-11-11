import { config } from '../../Modules/Util';
import { isPlayer, registerCommand, verifier } from '../../Modules/Handler';
import { EntityInventoryComponent, Player, system, world } from '@minecraft/server';
import { renameItem } from '../plugin/lore';
import { banPlayers } from '../../Modules/globalBan';
import { tickEvent } from '../../Modules/tick';

let isServerPaused = false; // サーバーが一時停止されているかどうかを追跡する変数
let isRealTimePingEnabled = false; // リアルタイムping検知が有効かどうか

let startTime = Date.now();
const oldData: { name: string, id: string }[] = [];

const TICKRUN = 20;


let tps = 20;


tickEvent.subscribe("serverInfoTick", (data: any) => {
    tps = data.tps;
});

const playerMovementData: Record<string, {
    lastPosition: { x: number, y: number, z: number },
    lastVelocity: { x: number, y: number, z: number },
    lastCheckTime: number,
    predictedPosition: { x: number, y: number, z: number }
}> = {};




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

function predictPosition(playerData: any) {
    const timeDiff = (Date.now() - playerData.lastCheckTime) / 1000;
    return {
        x: playerData.lastPosition.x + playerData.lastVelocity.x * timeDiff,
        y: playerData.lastPosition.y + playerData.lastVelocity.y * timeDiff,
        z: playerData.lastPosition.z + playerData.lastVelocity.z * timeDiff
    };
}

function estimatePing(player: Player, playerData: any): number {
    const positionDifference = calculateDistance(player.location, playerData.predictedPosition);
    let ping = Math.min(Math.max(positionDifference * 50, 0), 500);
    ping *= (20 / tps); // TPSが低いほどpingを高く補正
    return ping;

}

function calculateDistance(pos1: { x: number, y: number, z: number }, pos2: { x: number, y: number, z: number }): number {
    return Math.sqrt(Math.pow(pos1.x - pos2.x, 2) + Math.pow(pos1.y - pos2.y, 2) + Math.pow(pos1.z - pos2.z, 2));
}


system.runInterval(() => {
    if (isRealTimePingEnabled) {
        for (const player of world.getPlayers()) {
            const now = Date.now();
            if (!playerMovementData[player.name]) {
                playerMovementData[player.name] = {
                    lastPosition: player.location,
                    lastVelocity: { x: 0, y: 0, z: 0 },
                    lastCheckTime: now,
                    predictedPosition: player.location
                };
            } else {

                playerMovementData[player.name].predictedPosition = predictPosition(playerMovementData[player.name]);

                const estimatedPing = estimatePing(player, playerMovementData[player.name]);

                const level = getPingLevel(estimatedPing); // pingレベルを取得
                player.onScreenDisplay.setActionBar(`Ping: ${Math.floor(estimatedPing)}ms | Level: ${level}`);
                console.log(`Player ${player.name}: Estimated Ping = ${Math.floor(estimatedPing)}ms`);



                // 速度を計算し、次の予測に使用
                const timeDiff = (now - playerMovementData[player.name].lastCheckTime) / 1000;
                const velocity = {
                    x: (player.location.x - playerMovementData[player.name].lastPosition.x) / timeDiff,
                    y: (player.location.y - playerMovementData[player.name].lastPosition.y) / timeDiff,
                    z: (player.location.z - playerMovementData[player.name].lastPosition.z) / timeDiff,
                };

                // データ更新
                playerMovementData[player.name] = {
                    lastPosition: player.location,
                    lastVelocity: velocity,
                    lastCheckTime: now,
                    predictedPosition: player.location
                };
            }
        }
    }
}, TICKRUN);




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
        const item = inventoryComponent.container.getItem(0); 
        if (item && item.typeId === 'minecraft:writable_book') { 

            

            // 全プレイヤーの情報をJSON文字列に変換
            const allPlayerData = JSON.stringify(playerData);

            renameItem(item, allPlayerData, player, 0); 

        } else {
            player.sendMessage('ホットバーの最初のスロットに書き込み可能な本を持ってください。');
        }   
    }
    const combinedData = [...oldData, ...playerData.filter(newData => !oldData.some(existing => existing.id === newData.id))];

    console.warn(JSON.stringify(combinedData));
    oldData.length = 0;
    oldData.push(...combinedData);
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

export function getServerUptime(): string {
    const elapsedTimeMs = Date.now() - startTime;
    const uptimeSeconds = Math.floor(elapsedTimeMs / 1000);
    const uptimeMinutes = Math.floor(uptimeSeconds / 60);
    const uptimeHours = Math.floor(uptimeMinutes / 60);
    const uptimeDays = Math.floor(uptimeHours / 24);

    const remainingHours = uptimeHours % 24;
    const remainingMinutes = uptimeMinutes % 60;
    const remainingSeconds = uptimeSeconds % 60;

    return `${uptimeDays}d ${remainingHours}h ${remainingMinutes}m ${remainingSeconds}s`;
}

function displayServerInfo(player: Player | undefined, type: string) {
    switch (type) {
        case 'uptime':
            const uptime = getServerUptime();
            if (player) {
                player.sendMessage(`サーバーの起動時間: ${uptime}`);
            } else {
                world.sendMessage(`サーバーの起動時間: ${uptime}`);
            }
            break;
        case 'tps':
            const message = `TPS: ${tps}`;
            if (player) {
                player.sendMessage(message);
            } else {
                world.sendMessage(message); 
            }
            break;
        default:
            if (player) {
                player.sendMessage('Invalid info type.');
            } else {
                console.warn('Invalid info type.'); 
            }


    }
}

function addNametag(player: Player | undefined, targetPlayer: Player | undefined, nametag: string) {
    const target = targetPlayer || player;
    if (!target) {
        return;
    }

    const prefixNametag = `${nametag}|${target.name}`;

    system.runTimeout(() => {
        if (target.nameTag === prefixNametag) { // 既に同じ名前タグが存在する場合
            if (player) {
                player.sendMessage('[server] 既にネームタグ付いてまっせ.');
            }
            return; 
        } else { 
            target.nameTag = prefixNametag;
            //target.sendMessage(`[server] ネームタグが追加されたよ！: ${nametag}`);
            if (player && player !== target) {
                player.sendMessage(`[server] ネームタグを "${nametag}" に対して追加しました ${target.name}`);
            }
        }
    }, 1);
}

function removeNametag(player: Player | undefined, targetPlayer: Player | undefined) {
    const target = targetPlayer || player;
    if (!target) {
        return;
    }
    system.runTimeout(() => {
        if (target.nameTag.includes('|')) {
            target.nameTag = target.name;
            target.sendMessage('[server] 追加されていたネームタグを削除しました');
            if (player && player !== target) {
                player.sendMessage(`[server]  ${target.name}のネームタグを削除!`);
            }
        } else {
            if (player) {
                player.sendMessage('[server] ネームタグないぜ.');
            }
        }
    }, 1);
}



registerCommand({
    name: 'server',
    description: 'server_command_description',
    parent: false,
    maxArgs: 4, 
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
        } else if (args[0] === '-nametag') {
            if (args[1] === 'add' && args[2]) {
                addNametag(player, undefined, args[2]); 
            } else if (args[1] === 'addTo' && args[2] && args[3]) {
                const targetPlayer = world.getPlayers().find(p => p.name === args[2].replace('@', ''));
                if (targetPlayer) {
                    addNametag(player, targetPlayer, args[3]);
                } else {
                    player.sendMessage(`Player ${args[2]} not found.`);
                }
            } else if (args[1] === 'remove') {
                removeNametag(player, undefined);
            } else if (args[1] === 'removeTo' && args[2]) {
                const targetPlayer = world.getPlayers().find(p => p.name === args[2].replace('@', ''));
                if (targetPlayer) {
                    removeNametag(player, targetPlayer); 
                } else {
                    player.sendMessage(`Player ${args[2]} not found.`);
                }
            } else {
                player.sendMessage('Invalid nametag command. Use "-nametag add <nametag>", "-nametag addTo <player> <nametag>", "-nametag remove", or "-nametag removeTo <player>".');
            }
        } else {
            player.sendMessage('Invalid argument. Use "-pause", "-check", "-checkban", "-info uptime", "-ping [-true|-false]", or "-nametag ..."');
        }
    },
});



system.afterEvents.scriptEventReceive.subscribe((event) => {
    // 1. Check Event Source (Example: Chat Message)

    const args = event.id.split(" ");
    const command = args[0];

    if (command === "ch:name") {
        const message = event.message.trim();  // Trim whitespace
        const subargs = message.match(/"([^"]+)"|([^\s"]+)/g) || []; // Handle quoted strings with spaces

        if (subargs.length < 1) {
            console.error("サブコマンドがありません (add/remove).");
            return;
        } else {
            //@ts-ignore
            const subcommand = subargs[0].toLowerCase(); // Handle case

            if (subargs.length < 2) {
                console.error("Missing player name argument.");
                return;
            }

            let targetPlayerName = subargs[1].replace(/^"|"$/g, ''); // Remove quotes if present

            let targetPlayer: Player | undefined = undefined;

            // [tag=xx] の形式でタグ名を取得
            const tagMatch = targetPlayerName.match(/\[tag=(.*?)\]/);

            if (tagMatch) {
                const tagName = tagMatch[1]; 

                // tag に一致するプレイヤーを検索
                targetPlayer = world.getPlayers().find(player =>
                    player.getTags().filter((tag) => tag === tagName).length > 0
                );

                if (targetPlayer) {
                    // タグ付きプレイヤーが見つかった場合、処理を実行
                    if (subcommand === "add") {
                        if (subargs.length < 3) {
                            console.error("Missing nametag argument.");
                            return;
                        }
                        const nametag = subargs.slice(2).join(" ").replace(/^"|"$/g, ''); // Improved handling of spaces within quotes

                        try {
                            addNametag(undefined, targetPlayer, nametag); // addNametag を使用してタグを追加
                        } catch (error) {
                            console.error("Error adding nametag:", error);
                        }
                    } else if (subcommand === "remove") {
                        try {
                            removeNametag(undefined, targetPlayer); // removeNametag を使用してタグを削除
                        } catch (error) {
                            console.error("Error removing nametag:", error);
                        }
                    } else {
                        console.warn("Invalid subcommand:", subcommand);
                    }
                } else {
                    return;
                }

            } else {
                // タグ名が指定されていない場合は通常のプレイヤーを検索
                try {
                    targetPlayer = isPlayer(targetPlayerName);
                    if (!targetPlayer) {
                        console.warn("プレイヤーが見つかりませんでした:", targetPlayerName);
                        return;
                    }
                } catch (error) {
                    console.error("プレイヤーの検索中にエラーが発生しました:", error);
                    return;
                }
            }

            // targetPlayer が定義されている場合、add または remove の処理を実行
            if (targetPlayer) {
                if (subcommand === "add") {
                    if (subargs.length < 3) {
                        console.error("Missing nametag argument.");
                        return;
                    }
                    const nametag = subargs.slice(2).join(" ").replace(/^"|"$/g, ''); // Improved handling of spaces within quotes

                    try {
                        addNametag(undefined, targetPlayer, nametag); // addNametag を使用してタグを追加
                    } catch (error) {
                        console.error("Error adding nametag:", error);
                    }

                } else if (subcommand === "remove") {
                    try {
                        removeNametag(undefined, targetPlayer); // removeNametag を使用してタグを削除
                    } catch (error) {
                        console.error("Error removing nametag:", error);
                    }
                } else {
                    console.warn("Invalid subcommand:", subcommand);
                }
            }
        }
    }
});