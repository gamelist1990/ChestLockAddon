import { Player } from '@minecraft/server';
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

function mutePlayer(player: Player, data: any, playerDataManager: PlayerDataManager, message: string, configs: any, reason: string): void {
    const muteDurationSeconds = reason === "BadWord" ? 10 : 5;

    if (data.mutedUntil) {
        data.mutedUntil += muteDurationSeconds * 1000;
    } else {
        data.mutedUntil = Date.now() + muteDurationSeconds * 1000;
    }

    handleCheatDetection(player, { cheatType: reason, value: message }, configs, playerDataManager);

    const muteDuration = Math.floor((data.mutedUntil - Date.now()) / 1000);
    player.sendMessage(`§l§a[自作§3AntiCheat]§f ${reason === "BadWord" ? "卑猥な単語を複数回使用したため" : "スパム行為を検知したため"}、${muteDuration}秒間ミュートされました。`);

    updatePlayerData(player, playerDataManager, {
        lastMessages: [],
        mutedUntil: data.mutedUntil,
        lastMessageTimes: []
    });
}

function handleLongMessage(player: Player, data: any, playerDataManager: PlayerDataManager, message: string, configs: any): void {
    mutePlayer(player, data, playerDataManager, message, configs, "LongMessage");
}

function containsBadWords(message: string): number {
    let count = 0;
    badWords.forEach(word => {
        const regex = new RegExp(word, 'gi');
        const matches = message.match(regex);
        if (matches) {
            count += matches.length;
        }
    });
    return count;
}

function handleBadWord(player: Player, data: any, playerDataManager: PlayerDataManager, message: string, configs: any): void {
    const badWordCount = containsBadWords(message);

    if (badWordCount >= 1) {
        data.badWordCount += badWordCount;
        if (data.badWordCount >= 5) {
            mutePlayer(player, data, playerDataManager, message, configs, "BadWord");
            data.badWordCount = 0;
        } else {
            player.sendMessage(`§l§a[自作§3AntiCheat]§f 卑猥な単語が含まれています。あと${5 - data.badWordCount}回でミュートされます。`);
        }
        updatePlayerData(player, playerDataManager, { badWordCount: data.badWordCount, mutedUntil: data.mutedUntil });
    }
}

export function detectSpam(event: any, playerDataManager: PlayerDataManager, configs: any): void {
    const player = event.sender;
    const message = event.message;
    const data = playerDataManager.get(player);

    if (!data) return;

    if (data.mutedUntil && Date.now() < data.mutedUntil) {
        event.cancel = true;
        player.sendMessage("§l§a[自作§3AntiCheat]§f あなたはメッセージの送信を禁止されています。");
        return;
    }

    if (containsBadWords(message) >= 1) {
        event.cancel = true;
        handleBadWord(player, data, playerDataManager, message, configs);
        return;
    }

    if (message.startsWith("!")) return;

    if (message.length > 40) {
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
        mutePlayer(player, data, playerDataManager, message, configs, "Spam");
        return;
    }

    updatePlayerData(player, playerDataManager, {
        lastMessages: recentMessages,
        lastMessageTimes: recentMessageTimes
    });
}