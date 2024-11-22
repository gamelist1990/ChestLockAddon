import { ChatSendBeforeEvent, Player } from '@minecraft/server';
import { PlayerDataManager } from '../PlayerData';
import { handleCheatDetection } from '../actions';
import { updatePlayerData } from '../DataUpdate';
import { badWords } from './BadList';



function isSpam(recentMessages: string[]): boolean {
    for (let i = 0; i < recentMessages.length - 2; i++) {
        if (recentMessages[i] === recentMessages[i + 1] && recentMessages[i] === recentMessages[i + 2]) {
            return true;
        }
    }
    return false;
}

function mutePlayer(player: Player, data: any, playerDataManager: PlayerDataManager, message: string, configs: any): void {
    if (data.mutedUntil) {
        data.mutedUntil += 5000;
    } else {
        data.mutedUntil = Date.now() + 5000;
    }

    handleCheatDetection(player, { cheatType: "Spam", value: message }, configs, playerDataManager);

    const muteDuration = Math.floor((data.mutedUntil - Date.now()) / 1000);
    player.sendMessage(`§l§a[自作§3AntiCheat]§f スパム行為を検知したため、${muteDuration}秒間ミュートされました。`);

    updatePlayerData(player, playerDataManager, {
        lastMessages: [],
        mutedUntil: data.mutedUntil,
        lastMessageTimes: []
    });
}

function handleLongMessage(player: Player, data: any, playerDataManager: PlayerDataManager, message: string, configs: any): void {

    if (data.mutedUntil) {
        data.mutedUntil += 5000;
    } else {
        data.mutedUntil = Date.now() + 5000;
    }

    handleCheatDetection(player, { cheatType: "LongMessage", value: message }, configs, playerDataManager);

    const muteDuration = Math.floor((data.mutedUntil - Date.now()) / 1000);

    player.sendMessage(`§l§a[自作§3AntiCheat]§f 長すぎるメッセージを送信したため、${muteDuration}秒間ミュートされました。`);

    updatePlayerData(player, playerDataManager, {
        lastMessages: [],
        mutedUntil: data.mutedUntil,
        lastMessageTimes: []
    });

}
function containsBadWord(message: string): boolean {
    return badWords.some(word => message.includes(word));
}


function handleBadWord(player: Player, data: any, playerDataManager: PlayerDataManager, message: string, configs: any): void {
    data.badWordCount++;

    player.sendMessage(`§l§a[自作§3AntiCheat]§f 卑猥な単語が含まれています。あと${5 - data.badWordCount}回でミュートされます。`);

    if (data.badWordCount >= 5) {
        // ミュート処理、警告回数をリセット
        if (data.mutedUntil) {
            data.mutedUntil += 10000; // 10秒追加
        } else {
            data.mutedUntil = Date.now() + 10000; // 10秒ミュート
        }
        data.badWordCount = 0;

        const muteDuration = Math.floor((data.mutedUntil - Date.now()) / 1000);

        handleCheatDetection(player, { cheatType: "BadWord", value: message }, configs, playerDataManager);
        player.sendMessage(`§l§a[自作§3AntiCheat]§f 卑猥な単語を複数回使用したため、${muteDuration}秒間ミュートされました。`);

    }

    updatePlayerData(player, playerDataManager, { badWordCount: data.badWordCount, mutedUntil: data.mutedUntil });
}


export function detectSpam(event: ChatSendBeforeEvent, playerDataManager: PlayerDataManager, configs: any): void {
    const player = event.sender;
    const message = event.message;
    const data = playerDataManager.get(player);

    if (!data) return;

    if (data.mutedUntil && Date.now() < data.mutedUntil) {
        event.cancel = true;
        player.sendMessage("§l§a[自作§3AntiCheat]§f あなたはメッセージの送信を禁止されています。");
        return;
    }

    if (containsBadWord(message)) {
        event.cancel = true;
        handleBadWord(player, data, playerDataManager, message, configs);
        return;
    }

    if (message.startsWith("!")) return;


    if (message.length > 20) {
        event.cancel = true;
        handleLongMessage(player, data, playerDataManager, message, configs);
        return;
    }

    const now = Date.now();
    data.lastMessages.push(message);
    data.lastMessageTimes.push(now);


    const recentMessages = data.lastMessages.filter((_, index) => now - data.lastMessageTimes[index] <= 5000);
    const recentMessageTimes = data.lastMessageTimes.filter(time => now - time <= 5000);

    if (recentMessages.length >= 4 && isSpam(recentMessages)) {
        event.cancel = true;
        mutePlayer(player, data, playerDataManager, message, configs);
        return;
    }

    updatePlayerData(player, playerDataManager, {
        lastMessages: recentMessages,
        lastMessageTimes: recentMessageTimes
    });
}