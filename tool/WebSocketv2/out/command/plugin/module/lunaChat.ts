import { world, registerCommand } from "../../../backend";
import { RomajiKanjiConverter } from "../../../module/jpch";
import { Player } from "../../../module/player";
import { registerPlugin } from "../plugin";
import JsonDB from "../../../module/DataBase";


interface ChatMessage {
    sender: string;
    message: string;
    timestamp: number;
    translated: boolean;
    originalMessage: string;
}

interface ChatSettings {
    japaneseConversionEnabled: boolean;
    autoTranslationEnabled: boolean;
}

class LunaChat {
    private chatHistory: ChatMessage[] = [];
    private maxHistoryLength: number = 20;
    private converter: RomajiKanjiConverter;
    private db: JsonDB;
    private settingsPath: string;

    constructor(converter: RomajiKanjiConverter, db: JsonDB) {
        this.converter = converter;
        this.db = db;
        this.settingsPath = "lunaChatSettings"; // キーをシンプルに
        this.initializeDatabase();
        this.registerChatListener();
    }

    private async initializeDatabase() {
        try {
        } catch (error) {
            console.error("Failed to initialize LunaChat database:", error);
        }
    }

    private async getPlayerSettings(playerName: string): Promise<ChatSettings> {
        try {
            const path = `${this.settingsPath}.${playerName}`; // ドット区切りでキーを作成
            if (!(await this.db.has(path))) {
                const defaultSettings: ChatSettings = { japaneseConversionEnabled: false, autoTranslationEnabled: false };
                await this.db.set(path, defaultSettings);
                return defaultSettings;
            }
            return await this.db.get(path) as ChatSettings; // 型アサーション
        } catch (error) {
            console.error(`Failed to get settings for ${playerName}:`, error);
            return { japaneseConversionEnabled: false, autoTranslationEnabled: false };
        }
    }

    private async setPlayerSettings(playerName: string, settings: ChatSettings) {
        try {
            const path = `${this.settingsPath}.${playerName}`; // ドット区切り
            await this.db.set(path, settings);
        } catch (error) {
            console.error(`Failed to set settings for ${playerName}:`, error);
        }
    }

    private registerChatListener() {
        world.on('playerChat', async (sender: string, message: string, type: string) => {
            if (type !== 'chat' && type !== 'scoreboard') return;
            const player = await world.getEntityByName(sender);
            if (!player) return;

            if (message.startsWith('-')) return;

            const settings = await this.getPlayerSettings(player.name);

            if (settings.japaneseConversionEnabled && this.shouldTranslate(message)) {
                const convertedMessage = await this.converter.convert(message);
                this.addMessageToHistory(player.name, convertedMessage, true, message);
                this.broadcastMessage(player.name, convertedMessage, message, convertedMessage);

                if (settings.autoTranslationEnabled) {
                    settings.autoTranslationEnabled = false;
                    await this.setPlayerSettings(player.name, settings);
                    player.sendMessage('§a自動翻訳は無効になりました。§r');
                }

            } else if (settings.autoTranslationEnabled) {
                const detectedLanguage = await this.detectLanguage(message);
                let translatedMessage = message;

                if (detectedLanguage === "en") {
                    translatedMessage = await this.translateToJapanese(message);
                } else if (detectedLanguage === "ja") {
                    translatedMessage = await this.translateToEnglish(message);
                } else {
                    this.addMessageToHistory(player.name, message, false, message);
                    this.broadcastMessage(player.name, message);
                    return;
                }

                this.addMessageToHistory(player.name, translatedMessage, true, message);
                this.broadcastMessage(player.name, translatedMessage, message, translatedMessage);

                if (settings.japaneseConversionEnabled) {
                    settings.japaneseConversionEnabled = false;
                    await this.setPlayerSettings(player.name, settings);
                    player.sendMessage('§aローマ字 -> 日本語変換は無効になりました。§r');
                }

            } else {
                this.addMessageToHistory(player.name, message, false, message);
                if (this.shouldTranslate(message) === false) this.broadcastMessage(player.name, message);
            }
        });
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
        if (/[ぁ-んァ-ン]/.test(text)) {
            return "ja";
        }
        return "en";
    }
    public async toggleJapaneseConversion(playerName: string, enabled: boolean) {
        const settings = await this.getPlayerSettings(playerName);
        settings.japaneseConversionEnabled = enabled;
        await this.setPlayerSettings(playerName, settings);
    }

    public async toggleAutoTranslation(playerName: string, enabled: boolean) {
        const settings = await this.getPlayerSettings(playerName);
        settings.autoTranslationEnabled = enabled;
        await this.setPlayerSettings(playerName, settings);
    }

    public async getJapaneseConversionSetting(playerName: string): Promise<boolean> {
        const settings = await this.getPlayerSettings(playerName);
        return settings.japaneseConversionEnabled;
    }

    public async getAutoTranslationSetting(playerName: string): Promise<boolean> {
        const settings = await this.getPlayerSettings(playerName);
        return settings.autoTranslationEnabled;
    }
}


registerPlugin(
    'lunaChat',
    {},
    true,
    async () => {
        const db = new JsonDB("lunaChatDB"); // データベースのインスタンスを作成
        const converter = await RomajiKanjiConverter.create();
        const lunaChat = new LunaChat(converter, db); // データベースを渡す


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
                        await lunaChat.toggleJapaneseConversion(player.name, enabled === 'true');
                        player.sendMessage(`§aローマ字 -> 日本語変換を ${enabled === 'true' ? '有効' : '無効'} にしました。§r`);
                        break;
                    }
                    case 'translate': {
                        const enabled = args[1];
                        if (enabled !== 'true' && enabled !== 'false') {
                            player.sendMessage('§c使用法: /lunachat translate <true|false>§r');
                            return;
                        }
                        await lunaChat.toggleAutoTranslation(player.name, enabled === 'true');
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