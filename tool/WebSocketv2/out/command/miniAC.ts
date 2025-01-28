import { registerCommand, Player, world } from "../backend";
import { PlayerBAN } from "./ban";

class AntiCheatFeature {
    public name: string;
    public description: string;
    public enabled: boolean;
    public detect: (player: Player, message: string) => void;

    constructor(
        name: string,
        description: string,
        detect: (player: Player, message: string) => void
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

// スパム検知機能
function detectSpam(player: Player, message: string): void {
    const spamLog: Map<string, { count: number; lastMessageTime: number; longMessageCount: number }> = new Map();
    const spamThreshold: number = 6; // 3秒間に6回以上
    const longMessageThreshold: number = 4; // 3秒間に4回以上
    const spamInterval: number = 3000; // 3秒間
    const longMessageLength: number = 50; // 50文字以上

    const spamAction: (player: Player) => Promise<void> = async (player) => {
        const playerName = player.name; // プレイヤー名を事前取得

        try {
            await PlayerBAN("Server", player.name, "スパム行為(1day)", "[1d]");
            console.warn(`${playerName} was banned for spamming.`);
        } catch (error) {
            console.error(`Error banning player ${playerName}:`, error);
            return;
        }
    };

    const playerName = player.name;
    const now = Date.now();

    if (!spamLog.has(playerName)) {
        spamLog.set(playerName, { count: 0, lastMessageTime: 0, longMessageCount: 0 });
    }

    const playerData = spamLog.get(playerName)!;

    if (now - playerData.lastMessageTime <= spamInterval) {
        playerData.count++;
        if (message.length > longMessageLength) {
            playerData.longMessageCount++;
        }
    } else {
        playerData.count = 1;
        playerData.longMessageCount = message.length > longMessageLength ? 1 : 0;
    }
    playerData.lastMessageTime = now;

    if (playerData.count >= spamThreshold || playerData.longMessageCount >= longMessageThreshold) {
        spamAction(player);
        spamLog.delete(playerName); // スパムとして処理したらログをリセット
    }
}

// Horionコマンド検知機能
function detectHorionCommand(player: Player, message: string): void {
    const horionCommands = [".config load", ".config save", ".bind",".eject",".top"];
    const lowerCaseMessage = message.toLowerCase();

    if (horionCommands.some(command => lowerCaseMessage.startsWith(command))) {
        world.sendMessage(`§c[§fServer§c]§r §e${player.name} がHorionコマンドを使用している可能性があります: ${message}`);
        console.warn(`${player.name} may be using a Horion command: ${message}`);
    }
}

// スパム検知機能を登録
antiCheat.registerFeature(
    new AntiCheatFeature("spam", "スパム行為を検知します。", detectSpam)
);

// Horionコマンド検知機能を登録
antiCheat.registerFeature(
    new AntiCheatFeature("horion", "Horion系クライアントの使用を検知します。", detectHorionCommand)
);

// メッセージ受信イベントをリッスンする関数
function onPlayerMessage(player: Player, message: string) {
    antiCheat.check(player, message);
}

if (world) {
    world.on("playerChat", async (sender: string, message: string, type: string, receiver: string) => {
        const player = await world.getEntityByName(sender);
        if (player && type === "chat") {
            onPlayerMessage(player, message)
        }
    })
}

// miniAC コマンド
registerCommand({
    name: "miniAC",
    description: "アンチチート機能の設定を変更します。",
    minArgs: 2,
    config: { enabled: true, adminOnly: true, requireTag: [] },
    executor: async (player: Player, args: string[]) => {
        const [subCommand, featureName] = args;

        if (subCommand === "toggle") {
            const feature = antiCheat.getFeature(featureName);
            if (feature) {
                feature.toggle();
                player.sendMessage(
                    `機能 "${feature.name}" を ${feature.enabled ? "有効化" : "無効化"
                    } しました。`
                );
            } else {
                player.sendMessage(`"${featureName}" という機能は存在しません。`);
            }
        } else {
            player.sendMessage("無効なサブコマンドです。");
        }
    },
});