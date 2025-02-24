import { world } from '../backend';
import { Player } from '../module/player';
import JsonDB from '../module/DataBase';
import { registerCommand } from '../backend';

interface WhiteListData {
    name: string;
    uuid: string;
}

const db = new JsonDB('whiteList');

async function loadWhiteListEnabled(): Promise<boolean> {
    try {
        const enabled = await db.get('enabled');
        return enabled === true; //  null or undefined の場合は falseになるように
    } catch (error) {
        console.error('Error reading white list enabled status:', error);
        return false;
    }
}

async function saveWhiteListEnabled(enabled: boolean): Promise<void> {
    try {
        await db.set('enabled', enabled);
    } catch (error) {
        console.error('Error saving white list enabled status:', error);
    }
}


async function loadWhiteList(): Promise<WhiteListData[]> {
    try {
        const data = await db.getAll();
        if (Object.keys(data).length === 0) {
            return [];
        }

        const whiteList: WhiteListData[] = [];
        for (const key in data) {
            if (key !== 'enabled') {
                if (data[key] && typeof data[key] === 'object' && 'name' in data[key] && 'uuid' in data[key]) {
                    whiteList.push(data[key] as WhiteListData);
                }
            }
        }
        return whiteList;

    } catch (error) {
        console.error('Error reading white list:', error);
        return [];
    }
}

async function saveWhiteList(whiteList: WhiteListData[]): Promise<void> {
    try {
        // 既存のデータを一旦クリア (enabled は残す)
        const currentEnabled = await loadWhiteListEnabled();

        const allData = await db.getAll();
        for (const key in allData) {
            if (key !== 'enabled') {
                await db.delete(key);
            }
        }

        // ホワイトリストデータを保存
        const dataToSave: { [key: string]: WhiteListData } = {};
        whiteList.forEach(entry => {
            dataToSave[entry.name] = entry;
        });
        for (const key in dataToSave) {
            await db.set(key, dataToSave[key]);
        }

        // enabled を再設定
        await saveWhiteListEnabled(currentEnabled);

    } catch (error) {
        console.error('Error saving white list:', error);
    }
}

async function checkAndKickNonWhiteListedPlayer(player: Player): Promise<void> {
    const whiteListEnabled = await loadWhiteListEnabled();
    if (!whiteListEnabled) return;

    const whiteList = await loadWhiteList();
    const isWhiteListed = whiteList.some(entry => entry.name === player.name);

    if (!isWhiteListed) {
        const kickMessage = `§4[§c通知§4]\n\n§fあなたはホワイトリストに登録されていない為§a参加§f出来ませんでした\n§6#参加したい場合お手数ですがワールド主にご連絡をお願い致します`;
        world.runCommand(`kick ${player.name} ${kickMessage}`);
        world.sendMessage(`§l§f[Server]§r\n§c X §aユーザー §b${player.name}§a はホワイトリストに登録されていません。§r\n§c参加を拒否しました。`);
    }
}


async function addPlayerToWhiteList(addedBy: Player | "Server", playerName: string): Promise<void> {

    if (addedBy !== "Server" && !(await world.isPlayer(playerName))) {
        addedBy.sendMessage(`プレイヤー ${playerName} はオンラインではありません。`);
        return;
    }

    const targetPlayer = await world.getEntityByName(playerName);
    if (!targetPlayer) {
        if (addedBy !== "Server") {
            addedBy.sendMessage(`プレイヤー ${playerName} の情報取得に失敗しました。`);
        }
        return;
    }

    const whiteList = await loadWhiteList();
    if (whiteList.some(entry => entry.name === playerName)) {
        if (addedBy !== "Server") {
            addedBy.sendMessage(`プレイヤー ${playerName} は既にホワイトリストに登録されています。`);
        }
        return;
    }

    const newEntry: WhiteListData = {
        name: playerName,
        uuid: targetPlayer.uuid,
    };

    whiteList.push(newEntry);
    await saveWhiteList(whiteList);
    if (addedBy !== "Server") {
        addedBy.sendMessage(`プレイヤー ${playerName} をホワイトリストに追加しました。`);
    }
}

async function removePlayerFromWhiteList(removedBy: Player | "Server", playerName: string): Promise<void> {
    const whiteList = await loadWhiteList();
    const index = whiteList.findIndex(entry => entry.name === playerName);

    if (index === -1) {
        if (removedBy !== "Server") {
            removedBy.sendMessage(`プレイヤー ${playerName} はホワイトリストに登録されていません。`);
        }
        return;
    }

    whiteList.splice(index, 1);
    await saveWhiteList(whiteList);

    if (removedBy !== "Server") {
        removedBy.sendMessage(`プレイヤー ${playerName} をホワイトリストから削除しました。`);
    }
}


async function setWhiteListStatus(enabled: boolean, player?: Player): Promise<void> {
    await saveWhiteListEnabled(enabled);
    if (player) {
        player.sendMessage(`ホワイトリストを${enabled ? '有効' : '無効'}にしました。`);
    } else {
        world.sendMessage(`ホワイトリストを${enabled ? '有効' : '無効'}にしました。`);
    }
}

async function listWhiteList(player: Player): Promise<void> {
    const whiteList = await loadWhiteList();
    if (whiteList.length === 0) {
        player.sendMessage("ホワイトリストは空です。");
        return;
    }

    let message = "ホワイトリスト登録済みプレイヤー:\n";
    whiteList.forEach(entry => {
        message += `- ${entry.name}\n`;
    });
    player.sendMessage(message);
}



// コマンド登録
registerCommand({
    name: 'whitelist',
    description: 'ホワイトリストを管理します。',
    usage: 'whitelist <add|remove|list|true|false> [プレイヤー名]',
    maxArgs: 2,
    minArgs: 1,
    config: { enabled: true, adminOnly: true, requireTag: [] },
    executor: async (player: Player, args: string[]) => {
        const action = args[0].toLowerCase();

        switch (action) {
            case 'add':
                if (args.length < 2) {
                    player.sendMessage("使用法: whitelist add <プレイヤー名>");
                    return;
                }
                await addPlayerToWhiteList(player, args[1]);
                break;
            case 'remove':
                if (args.length < 2) {
                    player.sendMessage("使用法: whitelist remove <プレイヤー名>");
                    return;
                }
                await removePlayerFromWhiteList(player, args[1]);
                break;
            case 'list':
                await listWhiteList(player);
                break;
            case 'true':
                await setWhiteListStatus(true, player);
                break;
            case 'false':
                await setWhiteListStatus(false, player);
                break;
            default:
                player.sendMessage("不明なサブコマンドです。使用法: whitelist <add|remove|list|true|false> [プレイヤー名]");
        }
    },
});


if (world) {
    world.on("playerJoin", async (name: string) => {
        const player = await world.getRealname(name);
        if (player) {
            await checkAndKickNonWhiteListedPlayer(player);
        }
    });
    setInterval(async () => {
        const player = await world.getPlayers();
        if (player) {
            player.forEach((player) => {
                checkAndKickNonWhiteListedPlayer(player);
            })
        }
    }, 1000 * 60)
}