import { Player } from '@minecraft/server';
import { PlayerDataManager } from '../PlayerData';
import { handleCheatDetection } from '../actions';
import { badWords } from './BadList';

// スコアリングシステムの設定
const ruleScores = {
    exactMatch: 2,  // 完全一致のスコア
    fuzzyMatch: 1.5, // あいまい一致のスコア
    similarMatch: 1  // 類似一致のスコア
};

// スコアの閾値 (この値以上で不適切と判定)
const threshold = 2.5;
const muteDurationSecondsBadWord = 10;
const muteDurationSecondsSpam = 5;
const maxBadWordCount = 5;
const maxMessageLength = 40;
const spamMessageThreshold = 4;
const spamCheckInterval = 5000;


let learnedBadWords: string[] = [];
let badWordRegex: RegExp;
let exactBadWordRegex: RegExp;
let fuzzyBadWordRegex: RegExp[];
let similarBadWordRegex: RegExp[];


// 初期化関数: 正規表現を生成し、グローバル変数を設定する
function initializeRegex(): void {
    badWordRegex = new RegExp(badWords.join('|'), 'gi');
    exactBadWordRegex = new RegExp(`\\b(${badWords.join('|')})\\b`, 'gi');
    fuzzyBadWordRegex = badWords.map(word => new RegExp(generateFuzzyRegex(word), 'gi'));
    similarBadWordRegex = badWords.map(word => new RegExp(generateSimilarWordRegex(word), 'gi'));
}
initializeRegex();


// あいまい検索用の正規表現パターンを生成する関数
function generateFuzzyRegex(word: string): string {
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


// 類似単語を検出するための正規表現パターンを生成する関数
function generateSimilarWordRegex(word: string): string {
    let pattern = word.replace(/\*/g, '.*');
    return `\\b${pattern}\\b`;
}


function isSpam(recentMessages: string[]): boolean {
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

function mutePlayer(player: Player, data: any, playerDataManager: PlayerDataManager, message: string, configs: any, reason: string): void {
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

function handleLongMessage(player: Player, data: any, playerDataManager: PlayerDataManager, message: string, configs: any): void {
    mutePlayer(player, data, playerDataManager, message, configs, "LongMessage");
}


// 不適切語のスコアを計算する関数
function calculateBadWordScore(message: string): number {
    let score = 0;
    const exactMatches = message.match(exactBadWordRegex);
    if (exactMatches) {
        score += exactMatches.length * ruleScores.exactMatch;
    }
    for (const regex of fuzzyBadWordRegex) {
        const matches = message.match(regex);
        if (matches) {
            score += matches.length * ruleScores.fuzzyMatch;
        }
    }
    for (const regex of similarBadWordRegex) {
        const matches = message.match(regex);
        if (matches) {
            score += matches.length * ruleScores.similarMatch;
        }
    }
    return score;
}


function handleBadWord(player: Player, data: any, playerDataManager: PlayerDataManager, message: string, configs: any): void {
    const badWordScore = calculateBadWordScore(message);
    if (badWordScore >= threshold) {
        data.badWordCount += 1;
        if (data.badWordCount >= maxBadWordCount) {
            mutePlayer(player, data, playerDataManager, message, configs, "BadWord");
            data.badWordCount = 0;
            const detectedWords = message.match(badWordRegex) || [];
            detectedWords.forEach(word => {
                if (!learnedBadWords.includes(word)) {
                    learnedBadWords.push(word);
                    console.warn(`[AntiCheat] 新しい不適切単語を学習しました: ${word}`);
                    badWords.push(word);
                    initializeRegex();
                }
            });

        } else {
            player.sendMessage(`§l§a[自作§3AntiCheat]§f 卑猥な単語が含まれています。あと${maxBadWordCount - data.badWordCount}回でミュートされます。`);
        }
        playerDataManager.update(player, { badWordCount: data.badWordCount, mutedUntil: data.mutedUntil });
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

    if (calculateBadWordScore(message) >= threshold) {
        event.cancel = true;
        handleBadWord(player, data, playerDataManager, message, configs);
        return;
    }

    if (message.startsWith("!")) return;

    if (message.length > maxMessageLength) {
        event.cancel = true;
        handleLongMessage(player, data, playerDataManager, message, configs);
        return;
    }

    const now = Date.now();
    data.lastMessages.push(message);
    data.lastMessageTimes.push(now);

    const recentMessages = data.lastMessages.filter((_, index) => now - data.lastMessageTimes[index] <= spamCheckInterval);
    const recentMessageTimes = data.lastMessageTimes.filter(time => now - time <= spamCheckInterval);

    if (recentMessages.length >= spamMessageThreshold && isSpam(recentMessages)) {
        event.cancel = true;
        mutePlayer(player, data, playerDataManager, message, configs, "Spam");
        return;
    }

    playerDataManager.update(player, {
        lastMessages: recentMessages,
        lastMessageTimes: recentMessageTimes
    });
}