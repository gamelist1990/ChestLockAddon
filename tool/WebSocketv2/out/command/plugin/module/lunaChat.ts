import { world, registerCommand } from "../../../backend";
import { RomajiKanjiConverter } from "../../../module/jpch";
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
    private autoTranslationEnabled: { [playerName: string]: boolean } = {};
    private converter: RomajiKanjiConverter; // RomajiKanjiConverter のインスタンスを保持

    constructor(converter: RomajiKanjiConverter) {
        this.converter = converter;
        this.registerChatListener();
    }


    private registerChatListener() {
        world.on('playerChat', async (sender: string, message: string, type: string) => {
            if (type !== 'chat' && type !== 'scoreboard') return;

            const player = await world.getEntityByName(sender);
            if (!player) return;


            if (this.japaneseConversionEnabled[player.name] && this.shouldTranslate(message)) {
                //const translatedMessage = await this.translateToJapanese(message); //翻訳APIは使用しない
                const convertedMessage = await this.converter.convert(message); // RomajiKanjiConverterで変換
                this.addMessageToHistory(player.name, convertedMessage, true, message);
                this.broadcastMessage(player.name, convertedMessage, message, convertedMessage);
            }

            else if (this.autoTranslationEnabled[player.name]) {
                const detectedLanguage = await this.detectLanguage(message);
                let translatedMessage = message;
                if (detectedLanguage === "en") {
                    translatedMessage = await this.translateToJapanese(message);
                    this.addMessageToHistory(player.name, translatedMessage, true, message);
                    this.broadcastMessage(player.name, translatedMessage, message, translatedMessage);
                } else if (detectedLanguage === "ja") {
                    translatedMessage = await this.translateToEnglish(message);
                    this.addMessageToHistory(player.name, translatedMessage, true, message);
                    this.broadcastMessage(player.name, translatedMessage, message, translatedMessage);
                } else {
                    // 他の言語の場合は翻訳しない (オプション)
                    this.addMessageToHistory(player.name, message, false, message);
                    this.broadcastMessage(player.name, message);
                }
            }

            else {
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

    private broadcastMessage(sender: string, _message: string, originalMessage?: string, translatedMessage?: string) {
        world.getPlayers().then(players => {
            players.forEach(player => {
                if (originalMessage && translatedMessage) {
                    player.sendMessage(`§f§l[${sender}]§r: ${originalMessage} §6(${translatedMessage})§r`);
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
        const url = `https://script.google.com/macros/s/AKfycbxPh_IjkSYpkfxHoGXVzK4oNQ2Vy0uRByGeNGA6ti3M7flAMCYkeJKuoBrALNCMImEi_g/exec?text=${encodeURIComponent(text)}&from=en&to=ja`;
        try {
            const response = await fetch(url);
            if (!response.ok) {
                console.error(`HTTP error! status: ${response.status}`);
                return text;
            }
            const data: any = await response.json();
            return data?.translation || text;
        } catch (error) {
            console.error('Error during translation:', error);
            return text;
        }
    }

    private async translateToEnglish(text: string): Promise<string> {
        const url = `https://script.google.com/macros/s/AKfycbxPh_IjkSYpkfxHoGXVzK4oNQ2Vy0uRByGeNGA6ti3M7flAMCYkeJKuoBrALNCMImEi_g/exec?text=${encodeURIComponent(text)}&from=ja&to=en`;
        try {
            const response = await fetch(url);
            if (!response.ok) {
                console.error(`HTTP error! status: ${response.status}`);
                return text;
            }
            const data: any = await response.json();
            return data?.translation || text;
        } catch (error) {
            console.error('Error during translation:', error);
            return text;
        }
    }

    private async detectLanguage(text: string): Promise<string> {
        // 簡単な言語検出 (正規表現で日本語の文字かそれ以外かで判断)
        if (/[ぁ-んァ-ン]/.test(text)) {
            return "ja";
        }
        return "en";
    }

    public toggleJapaneseConversion(playerName: string, enabled: boolean) {
        this.japaneseConversionEnabled[playerName] = enabled;
    }


    public toggleAutoTranslation(playerName: string, enabled: boolean) {
        this.autoTranslationEnabled[playerName] = enabled;
    }

    public getJapaneseConversionSetting(playerName: string): boolean {
        return this.japaneseConversionEnabled[playerName] ?? false;
    }

    public getAutoTranslationSetting(playerName: string): boolean {
        return this.autoTranslationEnabled[playerName] ?? false;
    }
}

registerPlugin(
    'lunaChat',
    {},
    true,
    async () => {
        const converter = await RomajiKanjiConverter.create(); // RomajiKanjiConverter を初期化
        const lunaChat = new LunaChat(converter); // インスタンスを LunaChat に渡す

        registerCommand({
            name: 'lunaChat',
            description: 'チャットを便利にするコマンド',
            usage: '/lunaChat <jpch|history|translate> [true|false]',
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
                            player.sendMessage('§c使用法: /lunachat jpch <true|false>§r');
                            return;
                        }
                        lunaChat.toggleJapaneseConversion(player.name, enabled === 'true');
                        player.sendMessage(`§aローマ字 -> 日本語変換を ${enabled === 'true' ? '有効' : '無効'} にしました。§r`);
                        break;
                    }
                    case 'translate': {
                        const enabled = args[1];
                        if (enabled !== 'true' && enabled !== 'false') {
                            player.sendMessage('§c使用法: /lunachat translate <true|false>§r');
                            return;
                        }
                        lunaChat.toggleAutoTranslation(player.name, enabled === 'true');
                        player.sendMessage(`§a自動翻訳を ${enabled === 'true' ? '有効' : '無効'} にしました。§r`);
                        break;
                    }
                    default:
                        player.sendMessage('§c無効なサブコマンドです。 使用法: /lunachat <jpch|history|translate> [true|false]§r');
                }
            },
        });
    },
);