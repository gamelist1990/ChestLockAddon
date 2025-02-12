import { registerCommand, world } from '../backend';
import { PlayerBAN } from './ban';
import { Player } from '../module/player';

class AntiCheatFeature {
    public name: string;
    public description: string;
    public enabled: boolean;
    public detect: (player: Player, message: string) => void;

    constructor(
        name: string,
        description: string,
        detect: (player: Player, message: string) => void,
    ) {
        this.name = name;
        this.description = description;
        this.enabled = true;
        this.detect = detect;
    }

    public toggle(): void {
        this.enabled = !this.enabled;
    }
}

class AntiCheat {
    private features: Map<string, AntiCheatFeature>;

    constructor() {
        this.features = new Map();
    }

    public registerFeature(feature: AntiCheatFeature): void {
        this.features.set(feature.name, feature);
    }

    public getFeature(name: string): AntiCheatFeature | undefined {
        return this.features.get(name);
    }

    public check(player: Player, message: string): void {
        for (const feature of this.features.values()) {
            if (feature.enabled) {
                feature.detect(player, message);
            }
        }
    }
}

// アンチチートのインスタンスを作成
const antiCheat = new AntiCheat();

// スパム検知機能（強化版 - 1秒間隔, 長文2回, 詳細ログ付き）
interface SpamPlayerData {
    lastMessageTime: number;
    recentMessages: { time: number; content: string }[];
    warningCount: number;
}



//SpanLog
const spamLog: Map<string, SpamPlayerData> = new Map();

function detectSpam(player: Player, message: string): void {
    const shortTimeWindow: number = 1000;
    const longTimeWindow: number = 5000;
    const shortSpamThreshold: number = 3;
    const longSpamThreshold: number = 6;
    const longMessageLength: number = 50;
    const similarityThreshold: number = 0.8;
    const maxWarnings: number = 3;

    const spamAction = async (player: Player, level: number) => {
        const playerName = player.name;
        switch (level) {
            case 1:
                player.sendMessage("§c[警告] スパム行為はやめてください。");
                console.warn(`[AntiCheat] ${playerName} - Spam warning (Level 1).`);
                break;
            case 2:
                player.sendMessage("§c[警告] スパム行為を繰り返したため、1分間ミュートします。");
                console.warn(`[AntiCheat] ${playerName} - Spam warning (Level 2). Muted for 1 minute.`);
                player.runCommand(`ability @s mute true`);
                setTimeout(() => {
                    player.runCommand(`ability @s mute false`);
                }, 10000)
                break;
            case 3:
                try {
                    await PlayerBAN("Server", player.name, "スパム行為(1day)", "[1d]");
                    console.warn(`[AntiCheat] ${playerName} was banned for spamming.`);
                } catch (error) {
                    console.error(`[AntiCheat] Error banning player ${playerName}:`, error);
                }
                break;
        }
        // Reset Spam Data after action
        resetSpamData(playerName);
    };
    const resetSpamData = (playerName: string) => {
        if (spamLog.has(playerName)) {
            spamLog.set(playerName, { lastMessageTime: 0, recentMessages: [], warningCount: 0 });
        }
    };

    const playerName = player.name;
    const now = Date.now();

    if (!spamLog.has(playerName)) {
        spamLog.set(playerName, { lastMessageTime: 0, recentMessages: [], warningCount: 0 });
    }

    const playerData = spamLog.get(playerName)!;

    // 古いメッセージの削除 (longTimeWindow より古いものを削除)
    playerData.recentMessages = playerData.recentMessages.filter(msg => now - msg.time <= longTimeWindow);

    // メッセージを recentMessages に追加
    playerData.recentMessages.push({ time: now, content: message });

    // 類似メッセージのカウント
    let similarMessageCount = 0;
    for (let i = 0; i < playerData.recentMessages.length - 1; i++) {
        const similarity = calculateSimilarity(message, playerData.recentMessages[i].content);
        //   console.debug(`[AntiCheat] ${playerName} - Similarity between "${message}" and "${playerData.recentMessages[i].content}": ${similarity}`);
        if (similarity >= similarityThreshold) {
            similarMessageCount++;
        }
    }

    // 長文メッセージのカウント
    const longMessageCount = playerData.recentMessages.filter(msg => msg.content.length > longMessageLength).length;

    // 時間枠内でのメッセージ数
    const shortTimeMessages = playerData.recentMessages.filter(msg => now - msg.time <= shortTimeWindow).length;
    const longTimeMessages = playerData.recentMessages.length;

    // スパム判定
    let spamDetected = false;
    let spamLevel = 0;

    // メッセージ追加後に判定
    if (shortTimeMessages >= shortSpamThreshold) {
        //console.debug(`[AntiCheat] ${playerName} - Short time spam detected! ${shortTimeMessages} messages in ${shortTimeWindow}ms.`);
        spamDetected = true;
        spamLevel = 2; 
    } else if (longTimeMessages >= longSpamThreshold) {
        //     console.debug(`[AntiCheat] ${playerName} - Long time spam detected! ${longTimeMessages} messages in ${longTimeWindow}ms.`);
        spamDetected = true;
        spamLevel = 1; 
    } else if (similarMessageCount >= shortSpamThreshold) {
        //   console.debug(`[AntiCheat] ${playerName} - Similar message spam detected! ${similarMessageCount} similar messages.`);
        spamDetected = true;
        spamLevel = 1;
    } else if (longMessageCount >= 2) {
        //   console.debug(`[AntiCheat] ${playerName} - Long message spam detected! ${longMessageCount} long messages.`);
        spamDetected = true;
        spamLevel = 1;
    }

    if (spamDetected) {
        playerData.warningCount++;
        if (playerData.warningCount >= maxWarnings) {
            spamAction(player, 3);
        } else {
            spamAction(player, spamLevel);
            playerData.lastMessageTime = now; 
        }
    } else {
        if (now - playerData.lastMessageTime > longTimeWindow) {
            resetSpamData(playerName);
        }
        playerData.lastMessageTime = now;
    }
}


function calculateSimilarity(str1: string, str2: string): number {
    if (str1.length === 0 && str2.length === 0) return 1;
    if (str1.length === 0 || str2.length === 0) return 0;

    const matrix: number[][] = [];
    for (let i = 0; i <= str2.length; i++) {
        matrix[i] = [i];
    }
    for (let j = 0; j <= str1.length; j++) {
        matrix[0][j] = j;
    }

    for (let i = 1; i <= str2.length; i++) {
        for (let j = 1; j <= str1.length; j++) {
            if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
                matrix[i][j] = matrix[i - 1][j - 1];
            } else {
                matrix[i][j] = Math.min(
                    matrix[i - 1][j - 1] + 1,
                    Math.min(matrix[i][j - 1] + 1, matrix[i - 1][j] + 1),
                );
            }
        }
    }

    const maxLen = Math.max(str1.length, str2.length);
    const similarity = (maxLen - matrix[str2.length][str1.length]) / maxLen;
    return similarity;
}



// スパム検知機能を登録
antiCheat.registerFeature(new AntiCheatFeature('spam', 'スパム行為を検知します。', detectSpam));



// メッセージ受信イベントをリッスンする関数
function onPlayerMessage(player: Player, message: string) {
    // console.debug(`[AntiCheat] ${player.name} sent a message: ${message}`);
    antiCheat.check(player, message);
}

if (world) {
    world.on(
        'playerChat',
        async (sender: string, message: string, type: string) => {
            const player = await world.getEntityByName(sender);
            if (player && type === 'chat') {
                onPlayerMessage(player, message);
            }
        },
    );
}

// miniAC コマンド
registerCommand({
    name: 'miniAC',
    description: 'アンチチート機能の設定を変更します。',
    minArgs: 2,
    config: { enabled: true, adminOnly: true, requireTag: [] },
    executor: async (player: Player, args: string[]) => {
        const [subCommand, featureName] = args;

        if (subCommand === 'toggle') {
            const feature = antiCheat.getFeature(featureName);
            if (feature) {
                feature.toggle();
                player.sendMessage(
                    `機能 "${feature.name}" を ${feature.enabled ? '有効化' : '無効化'} しました。`,
                );
            } else {
                player.sendMessage(`"${featureName}" という機能は存在しません。`);
            }
        } else {
            player.sendMessage('無効なサブコマンドです。');
        }
    },
});