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

const antiCheat = new AntiCheat();

interface SpamPlayerData {
    recentMessages: { time: number }[]; // メッセージ時刻のみを記録
    warningCount: number;
}

const spamLog: Map<string, SpamPlayerData> = new Map();

function detectSpam(player: Player, message: string): void {
    const timeWindow: number = 3000;
    const spamThreshold: number = 4;
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
                    player.sendMessage("§c[警告] この次またスパムした場合はServerによりBAN処理が行われます");
                }, 60000);
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
        if (level === 3) {
            resetSpamData(playerName);
        }

    };

    const resetSpamData = (playerName: string) => {
        spamLog.set(playerName, { recentMessages: [], warningCount: 0 });
    };



    const playerName = player.name;
    const now = Date.now();

    if (!spamLog.has(playerName)) {
        resetSpamData(playerName);
    }

    const playerData = spamLog.get(playerName)!;
    
    playerData.recentMessages = playerData.recentMessages.filter(msg => {
        const isRecent = now - msg.time <= timeWindow;
        return isRecent;
    });
    playerData.recentMessages.push({ time: now });



    // スパム判定
    if (playerData.recentMessages.length >= spamThreshold) {
        playerData.warningCount++;
        if (playerData.warningCount >= maxWarnings) {
            spamAction(player, 3);  // BAN
        } else {
            spamAction(player, playerData.warningCount);
        }
    }
}

antiCheat.registerFeature(new AntiCheatFeature('spam', 'スパム行為を検知します。', detectSpam));

if (world) {
    world.on(
        'playerChat',
        async (sender: string, message: string, type: string) => {
            const player = await world.getEntityByName(sender);
            if (player) {
                if (type === "chat" || type === "scoreboard")
                    onPlayerMessage(player, message);
            } else {
            }
        },
    );
}

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


function onPlayerMessage(player: Player, message: string): void {
    antiCheat.check(player, message);
}