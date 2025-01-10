import { Player } from '@minecraft/server';
import { PlayerDataManager, PlayerData } from '../PlayerData';
import { handleCheatDetection } from '../actions';
import { badWords } from './BadList';

// スコアリングシステムの設定
const ruleScores = {
    exactMatch: 2,
    fuzzyMatch: 1.5,
    similarMatch: 1
};

const threshold = 2.5;
const muteDurationSecondsBadWord = 10;
const muteDurationSecondsSpam = 5;
const maxBadWordCount = 5;
const maxMessageLength = 40;
const spamMessageThreshold = 4;
const spamCheckInterval = 5000;

class SpamDetector {
    private learnedBadWords: string[] = [];
    private badWordRegex: RegExp = /./;
    private exactBadWordRegex: RegExp = /./;
    private fuzzyBadWordRegex: RegExp[] = [];
    private similarBadWordRegex: RegExp[] = [];

    constructor() {
        this.initializeRegex();
    }

    private initializeRegex(): void {
        this.badWordRegex = new RegExp(badWords.join('|'), 'gi');
        this.exactBadWordRegex = new RegExp(`\\b(${badWords.join('|')})\\b`, 'gi');
        this.fuzzyBadWordRegex = badWords.map(word => new RegExp(this.generateFuzzyRegex(word), 'gi'));
        this.similarBadWordRegex = badWords.map(word => new RegExp(this.generateSimilarWordRegex(word), 'gi'));
    }

    private generateFuzzyRegex(word: string): string {
        let pattern = "";
        for (const char of word) {
            switch (char) {
                case 'a': pattern += "[aA@]"; break;
                case 'i': pattern += "[iI1!]"; break;
                case 'o': pattern += "[oO0]"; break;
                case 'e': pattern += "[eE3]"; break;
                case 's': pattern += "[sS$]"; break;
                case 'c': pattern += "[c(cC)]"; break;
                case 'u': pattern += "[uU@]"; break;
                default: pattern += `[${char.toLowerCase()}${char.toUpperCase()}]`;
            }
        }
        return pattern;
    }

    private generateSimilarWordRegex(word: string): string {
        let pattern = word.replace(/\*/g, '.*');
        return `\\b${pattern}\\b`;
    }

    private calculateBadWordScore(message: string): number {
        let score = 0;
        const exactMatches = message.match(this.exactBadWordRegex);
        if (exactMatches) {
            score += exactMatches.length * ruleScores.exactMatch;
        }
        for (const regex of this.fuzzyBadWordRegex) {
            const matches = message.match(regex);
            if (matches) {
                score += matches.length * ruleScores.fuzzyMatch;
            }
        }
        for (const regex of this.similarBadWordRegex) {
            const matches = message.match(regex);
            if (matches) {
                score += matches.length * ruleScores.similarMatch;
            }
        }
        return score;
    }

    private isSpam(recentMessages: string[]): boolean {
        if (recentMessages.length < 3) {
            return false;
        }
        for (let i = 0; i < recentMessages.length - 2; i++) {
            if (recentMessages[i] === recentMessages[i + 1] && recentMessages[i] === recentMessages[i + 2]) {
                return true;
            }
        }
        return false;
    }

    private mutePlayer(player: Player, data: PlayerData, playerDataManager: PlayerDataManager, message: string, configs: any, reason: string): void {
        const muteDurationSeconds = reason === "BadWord" ? muteDurationSecondsBadWord : muteDurationSecondsSpam;
        const mutedUntil = data.mutedUntil ? data.mutedUntil + muteDurationSeconds * 1000 : Date.now() + muteDurationSeconds * 1000;

        handleCheatDetection(player, { cheatType: reason, value: message }, configs, playerDataManager);

        const muteDuration = Math.floor((mutedUntil - Date.now()) / 1000);
        player.sendMessage(`§l§a[自作§3AntiCheat]§f ${reason === "BadWord" ? "卑猥な単語を複数回使用したため" : "スパム行為を検知したため"}、${muteDuration}秒間ミュートされました。`);

        playerDataManager.update(player, {
            lastMessages: [],
            mutedUntil: mutedUntil,
            lastMessageTimes: []
        });
    }

    private handleLongMessage(player: Player, data: PlayerData, playerDataManager: PlayerDataManager, message: string, configs: any): void {
        this.mutePlayer(player, data, playerDataManager, message, configs, "LongMessage");
    }

    private handleBadWord(player: Player, data: PlayerData, playerDataManager: PlayerDataManager, message: string, configs: any): void {
        const badWordScore = this.calculateBadWordScore(message);
        if (badWordScore >= threshold) {
            data.badWordCount += 1;
            if (data.badWordCount >= maxBadWordCount) {
                this.mutePlayer(player, data, playerDataManager, message, configs, "BadWord");
                data.badWordCount = 0;
                const detectedWords = message.match(this.badWordRegex) || [];
                detectedWords.forEach(word => {
                    if (!this.learnedBadWords.includes(word)) {
                        this.learnedBadWords.push(word);
                        console.warn(`[AntiCheat] 新しい不適切単語を学習しました: ${word}`);
                        badWords.push(word);
                        this.initializeRegex();
                    }
                });
            } else {
                player.sendMessage(`§l§a[自作§3AntiCheat]§f 卑猥な単語が含まれています。あと${maxBadWordCount - data.badWordCount}回でミュートされます。`);
            }
            playerDataManager.update(player, { badWordCount: data.badWordCount, mutedUntil: data.mutedUntil });
        }
    }

    public detectSpam(event: any, playerDataManager: PlayerDataManager, configs: any): void {
        const player = event.sender;
        const message = event.message;
        const data = playerDataManager.get(player);

        if (!data) return;

        if (data.mutedUntil && Date.now() < data.mutedUntil) {
            event.cancel = true;
            player.sendMessage("§l§a[自作§3AntiCheat]§f あなたはメッセージの送信を禁止されています。");
            return;
        }

        if (this.calculateBadWordScore(message) >= threshold) {
            event.cancel = true;
            this.handleBadWord(player, data, playerDataManager, message, configs);
            return;
        }

        if (message.startsWith("!")) return;

        if (message.length > maxMessageLength) {
            event.cancel = true;
            this.handleLongMessage(player, data, playerDataManager, "x", configs);
            return;
        }

        const now = Date.now();
        data.lastMessages.push(message);
        data.lastMessageTimes.push(now);

        const recentMessages = data.lastMessages.filter((_, index) => now - data.lastMessageTimes[index] <= spamCheckInterval);
        const recentMessageTimes = data.lastMessageTimes.filter(time => now - time <= spamCheckInterval);

        if (recentMessages.length >= spamMessageThreshold && this.isSpam(recentMessages)) {
            event.cancel = true;
            this.mutePlayer(player, data, playerDataManager, message, configs, "Spam");
            return;
        }

        playerDataManager.update(player, {
            lastMessages: recentMessages,
            lastMessageTimes: recentMessageTimes
        });
    }
}

const spamDetector = new SpamDetector();

export function detectSpam(event: any, playerDataManager: PlayerDataManager, configs: any): void {
    spamDetector.detectSpam(event, playerDataManager, configs);
}