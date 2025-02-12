import { world, registerCommand } from "../../../backend";
import { Player } from "../../../module/player";
import { registerPlugin } from "../plugin";

interface ChatMessage {
    sender: string;
    message: string;
    timestamp: number;
    translated: boolean;
    originalMessage: string;
}

class LunaChat {
    private chatHistory: ChatMessage[] = [];
    private maxHistoryLength: number = 20;
    private japaneseConversionEnabled: { [playerName: string]: boolean } = {};

    constructor() {
        this.registerChatListener();
    }

    private registerChatListener() {
        world.on('playerChat', async (sender: string, message: string, type: string) => {
            if (type !== 'chat') return;

            const player = await world.getEntityByName(sender);
            if (!player) return;

            //日本語変換設定が有効になっているか確認
            if (this.japaneseConversionEnabled[player.name] && this.shouldTranslate(message)) {
                const translatedMessage = await this.translateToJapanese(message);
                this.addMessageToHistory(player.name, translatedMessage, true, message);
                this.broadcastMessage(player.name, translatedMessage, message); // オリジナルメッセージも渡す
            } else {
                this.addMessageToHistory(player.name, message, false, message);
                if (this.shouldTranslate(message) === false) this.broadcastMessage(player.name, message); 
            }
        });
    }


    public addMessageToHistory(sender: string, message: string, translated: boolean, originalMessage: string) {
        const chatMessage: ChatMessage = {
            sender,
            message,
            timestamp: Date.now(),
            translated,
            originalMessage
        };

        this.chatHistory.push(chatMessage);
        if (this.chatHistory.length > this.maxHistoryLength) {
            this.chatHistory.shift();
        }
    }

    private broadcastMessage(sender: string, message: string, originalMessage?: string) {
        world.getPlayers().then(players => {
            players.forEach(player => {
                if (originalMessage) {
                    player.sendMessage(`§f§l[${sender}]§r: ${originalMessage} §6(${message})§r`); // ここを変更
                }
            });
        });
    }

    public getChatHistory(): ChatMessage[] {
        return this.chatHistory;
    }

    private shouldTranslate(message: string): boolean {
        return /^[a-zA-Z0-9\s\.,!?]*$/.test(message);
    }

    private async translateToJapanese(text: string): Promise<string> {
        const url = `https://script.google.com/macros/s/AKfycbxPh_IjkSYpkfxHoGXVzK4oNQ2Vy0uRByGeNGA6ti3M7flAMCYkeJKuoBrALNCMImEi_g/exec?romaji=${encodeURIComponent(text)}`;
        try {
            const response = await fetch(url);
            if (!response.ok) {
                console.error(`HTTP error! status: ${response.status}`);
                return text;
            }
            const data: any = await response.json();
            return data?.japanese || text;
        } catch (error) {
            console.error('Error during translation:', error);
            return text;
        }
    }

    public toggleJapaneseConversion(playerName: string, enabled: boolean) {
        this.japaneseConversionEnabled[playerName] = enabled;
    }

    public getJapaneseConversionSetting(playerName: string): boolean {
        return this.japaneseConversionEnabled[playerName] ?? false;
    }
}

registerPlugin(
    'lunaChat',
    {},
    true,
    async () => {
        const lunaChat = new LunaChat();

        registerCommand({
            name: 'lunaChat',
            description: 'ローマ字を日本語化してくれます',
            usage: '/lunaChat <jpch|history> [true|false]',
            config: { enabled: true, adminOnly: false, requireTag: [] },
            executor: async (player: Player, args: string[]) => {
                const subCommand = args[0];

                switch (subCommand) {
                    case 'history': {
                        const history = lunaChat.getChatHistory();
                        if (history.length === 0) {
                            player.sendMessage('§cチャット履歴がありません。§r');
                            return;
                        }
                        player.sendMessage('§6--- チャット履歴 ---§r');
                        history.forEach(msg => {
                            const time = new Date(msg.timestamp).toLocaleTimeString();
                            const translatedText = msg.translated ? ` §6(翻訳: ${msg.message})§r` : '';
                            player.sendMessage(`[${time}] §b${msg.sender}§r: ${msg.originalMessage}${translatedText}`);
                        });
                        break;
                    }
                    case 'jpch': {
                        const enabled = args[1];
                        if (enabled !== 'true' && enabled !== 'false') {
                            player.sendMessage('§c使用法: /lunachat main <true|false>§r');
                            return;
                        }
                        lunaChat.toggleJapaneseConversion(player.name, enabled === 'true');
                        player.sendMessage(`§a日本語変換を ${enabled === 'true' ? '有効' : '無効'} にしました。§r`);
                        break;
                    }
                    default:
                        player.sendMessage('§c無効なサブコマンドです。 使用法: /lunachat <main|history> [true|false]§r');
                }
            },
        });
    },
);