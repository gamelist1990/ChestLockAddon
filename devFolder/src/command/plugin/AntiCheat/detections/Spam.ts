// Modules/AntiCheat/detections/Spam.ts
import { ChatSendBeforeEvent } from '@minecraft/server'; // BeforeChatEventをインポート
import { PlayerDataManager } from '../PlayerData';
import { handleCheatDetection } from '../actions';
import { updatePlayerData } from '../DataUpdate'; // updatePlayerData をインポート

export function detectSpam(event: ChatSendBeforeEvent, playerDataManager: PlayerDataManager, configs: any): void { // eventの型を指定
    const player = event.sender;
    const message = event.message;
    const data = playerDataManager.get(player);

    if (!data) return;

    if (data.mutedUntil && Date.now() < data.mutedUntil) {
        event.cancel = true;
        player.sendMessage("§l§a[自作§3AntiCheat]§f あなたはメッセージの送信を禁止されています。");
        return;
    }

    const now = Date.now();
    data.lastMessages.push(message);
    data.lastMessageTimes.push(now);

    const recentMessages = data.lastMessages.filter((_, index) => now - data.lastMessageTimes[index] <= 5000);
    const recentMessageTimes = data.lastMessageTimes.filter(time => now - time <= 5000);

    if (recentMessages.length >= 4) {
        for (let i = 0; i < recentMessages.length - 2; i++) {
            if (recentMessages[i] === recentMessages[i + 1] && recentMessages[i] === recentMessages[i + 2]) {
                data.mutedUntil = Date.now() + 5000;
                handleCheatDetection(player, { cheatType: "Spam", value: message }, configs, playerDataManager);
                event.cancel = true;
                player.sendMessage("§l§a[自作§3AntiCheat]§f スパム行為を検知したため、5秒間ミュートされました。");

                // DataUpdate を使用して更新
                updatePlayerData(player, playerDataManager, {
                    lastMessages: [],
                    mutedUntil: data.mutedUntil,
                    lastMessageTimes: []
                });
                return;
            }
        }
    }

    // DataUpdate を使用して更新
    updatePlayerData(player, playerDataManager, {
        lastMessages: recentMessages,
        lastMessageTimes: recentMessageTimes
    });
}