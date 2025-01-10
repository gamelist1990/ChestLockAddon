import { WebSocketServer, WebSocket } from 'ws';
import { createServer, IncomingMessage, ServerResponse } from 'http';

// プレイヤー情報を表すインターフェース
interface Player {
    name: string;
    uuid: string;
    sendMessage: (message: string) => void;
    runCommand: (command: string) => Promise<any>;
    hasTag: (tag: string) => Promise<boolean>; // 追加
    getTags: () => Promise<string[]>; // 追加
}

// ワールド情報を表すインターフェース
interface World {
    name: string;
    sendMessage: (message: string) => void;
}

// コマンドの検証関数
type CommandVerifier = (player: Player) => boolean;

// コマンドの実行関数
type CommandExecutor = (player: Player, args: string[]) => void;

interface CommandOptions {
    name: string;
    description: string;
    parent?: string | boolean;
    maxArgs?: number;
    minArgs?: number;
    require?: CommandVerifier;
    executor: CommandExecutor;
}

interface Command extends CommandOptions {
    subcommands: Record<string, Command>;
}

class WsServer {
    private port: number;
    private wss: WebSocketServer;
    private clients: Map<string, WebSocket>;
    private commands: Record<string, Command>;
    private serverStatus: any;
    private minecraftClient: WebSocket | null;
    private playersInfo: { name: string; uuid: string }[] = [];
    private commandPrefix: string;

    constructor(port: number, commandPrefix: string = '#') {
        this.port = port;
        this.clients = new Map<string, WebSocket>();
        this.commands = {};
        this.serverStatus = {
            uptime: "0日 0時間 0分 0秒",
            playerCount: 0,
            cpuUsage: "0.00",
            memoryUsage: 0,
            usedMemoryMB: 0,
            loadStatus: "低 (0.00)",
            wsPing: 999,
            isWorldLoaded: false,
        };
        this.minecraftClient = null;
        this.commandPrefix = commandPrefix;

        const httpServer = createServer((req: IncomingMessage, res: ServerResponse) => {
            if (req.url === '/api/get-wss-url') {
                // /api/get-wss-url へのリクエストを処理
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ wssUrl: `ws://localhost:${this.port}/minecraft` }));
            } else {
                res.writeHead(200, { 'Content-Type': 'text/plain' });
                res.end('WebSocket server is running');
            }

        });

        this.wss = new WebSocketServer({ server: httpServer });

        this.wss.on('connection', this.handleConnection.bind(this));

        httpServer.listen(this.port, () => {
            console.log(`WebSocket server started on ws://localhost:${this.port}`);
        });
    }

    private handleConnection(ws: WebSocket, req: IncomingMessage) {
        // URLから接続の種類を判断
        if (req.url === '/minecraft') {
            this.handleMinecraftConnection(ws);
        } else {
            this.handleClientConnection(ws, this.generateClientId());
        }
    }

    private handleClientConnection(ws: WebSocket, clientId: string) {
        this.clients.set(clientId, ws);
        console.log(`Client connected: ${clientId}`);

        ws.send(JSON.stringify({ event: 'initialStatus', data: this.serverStatus }));

        ws.on('message', (data: any) => {
            console.log(`Received message from client ${clientId}: ${data}`);
            try {
                const message = JSON.parse(data);
                if (message.command) {
                    // クライアント用の Player オブジェクト作成時に UUID を取得
                    const playerInfo = this.playersInfo.find(p => p.name === clientId);
                    const player: Player = {
                        name: clientId,
                        uuid: playerInfo ? playerInfo.uuid : 'unknown',
                        sendMessage: (msg: string) => ws.send(JSON.stringify({ event: 'message', message: msg })),
                        runCommand: (command: string) => {
                            return new Promise((resolve) => {
                                const commandId = Math.random().toString(36).substring(2, 15);
                                const listener = (data: any) => {
                                    try {
                                        const message = JSON.parse(data);
                                        if (message.event === 'commandResult' && message.data.commandId === commandId) {
                                            this.minecraftClient?.off('message', listener);
                                            resolve(message.data.result);
                                        }
                                    } catch (error) {
                                        console.error('Error processing command result:', error);
                                    }
                                };
                                this.minecraftClient?.on('message', listener);
                                this.sendToMinecraft({ command: command, commandId: commandId });
                            });
                        },
                        // hasTag と getTags を追加
                        hasTag: async (tag: string) => {
                            const result = await player.runCommand(`/tag ${player.name} list`);
                            if (result && result.statusMessage) {
                                const regex = new RegExp(`§a${tag}§r`);
                                return regex.test(result.statusMessage);
                            }
                            return false;
                        },
                        getTags: async () => {
                            const result = await player.runCommand(`/tag ${player.name} list`);
                            if (result && result.statusMessage) {
                                const tagRegex = /§a([\w\d]+)§r/g;
                                const tags: string[] = [];
                                let match;
                                while ((match = tagRegex.exec(result.statusMessage)) !== null) {
                                    tags.push(match[1]);
                                }
                                return tags;
                            }
                            return [];
                        }
                    };

                    // クライアントからのコマンドは、そのまま処理する（プレフィックスを付けない）
                    this.handleCommand(player, message.command, message.args || []);
                }
            } catch (error) {
                console.error('Error processing message from client:', error);
            }
        });

        ws.on('close', () => {
            this.clients.delete(clientId);
            console.log(`Client disconnected: ${clientId}`);
        });

        ws.on('error', (error: any) => {
            console.error(`WebSocket error for client ${clientId}:`, error);
        });
    }

    private handleMinecraftConnection(ws: WebSocket) {
        console.log('Minecraft server connected.');
        this.minecraftClient = ws;
        ws.on('message', (data: any) => {
            try {
                const message = JSON.parse(data);
                this.handleMinecraftServerData(message.event, message.data);
            } catch (error) {
                console.error('Error processing message from Minecraft server:', error);
            }
        });

        ws.on('close', () => {
            console.log('Minecraft server disconnected.');
            this.minecraftClient = null;
        });

        ws.on('error', (error: any) => {
            console.error('Error with Minecraft server connection:', error);
        });
    }

    private generateClientId(): string {
        return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
    }

    public registerCommand(options: CommandOptions) {
        const command: Command = {
            ...options,
            subcommands: {},
        };

        // プレフィックスを付けずにコマンド名を登録（playerChat から呼ばれるため）
        const fullName = options.name;

        if (options.parent) {
            // 親コマンド名にもプレフィックスを付けない
            const parentName = typeof options.parent === 'string'
                ? options.parent
                : fullName.split(' ')[0];

            let parentCommand = this.commands[parentName];
            if (!parentCommand) {
                console.error(`Parent command not found: ${parentName}`);
                return;
            }
            parentCommand.subcommands[fullName.split(' ').slice(1).join(' ')] = command;
        } else {
            this.commands[fullName] = command;
        }
    }

    // プレイヤーを偽装する関数 (UUID も偽装)
    private createPseudoPlayer(playerName: string): Player {
        const playerInfo = this.playersInfo.find(p => p.name === playerName);
        return {
            name: playerName,
            uuid: playerInfo ? playerInfo.uuid : 'unknown',
            sendMessage: (message: string) => {
                this.sendToMinecraft({ command: 'sendMessage', message: `${message}`, playerName });
            },
            runCommand: async (command: string) => {
                return await this.executeMinecraftCommand(command);
            },
            // hasTag と getTags を追加 (PseudoPlayer)
            hasTag: async (tag: string) => {
                const result = await this.executeMinecraftCommand(`/tag ${playerName} list`);
                if (result && result.statusMessage) {
                    const regex = new RegExp(`§a${tag}§r`);
                    return regex.test(result.statusMessage);
                }
                return false;
            },
            getTags: async () => {
                const result = await this.executeMinecraftCommand(`/tag ${playerName} list`);
                if (result && result.statusMessage) {
                    const tagRegex = /§a([\w\d]+)§r/g;
                    const tags: string[] = [];
                    let match;
                    while ((match = tagRegex.exec(result.statusMessage)) !== null) {
                        tags.push(match[1]);
                    }
                    return tags;
                }
                return [];
            }
        };
    }

    // ワールドオブジェクトを作成する関数
    public createWorld(worldName: string): World {
        return {
            name: worldName,
            sendMessage: (message: string) => {
                this.sendToMinecraft({ command: 'sendWorldMessage', worldName, message });
            },
        };
    }

    // コマンドを実行する関数を非同期に変更
    private async executeMinecraftCommand(command: string): Promise<any> {
        return new Promise((resolve) => {
            const commandId = Math.random().toString(36).substring(2, 15);

            const listener = (data: any) => {
                try {
                    const message = JSON.parse(data);
                    if (message.event === 'commandResult' && message.data.commandId === commandId) {
                        this.minecraftClient?.off('message', listener);
                        resolve(message.data.result);
                    }
                } catch (error) {
                    console.error('Error processing command result:', error);
                    resolve(null);
                }
            };

            this.minecraftClient?.on('message', listener);
            this.sendToMinecraft({ command: command, commandId: commandId });
        });
    }

    //playerがコマンド実行したことにする関数 MinecraftサーバーにsendMessage経由でメッセージを送信
    public async onPlayerChat(sender: string, message: string) {
        if (message.startsWith(this.commandPrefix)) {
            // メッセージがコマンドプレフィックスで始まる場合、コマンドとして処理
            const commandParts = message.substring(this.commandPrefix.length).split(' ');
            const commandName = commandParts[0];
            const args = commandParts.slice(1);

            // コマンド実行者を偽装
            const player = this.createPseudoPlayer(sender);

            // コマンドの存在確認と実行
            let command = this.commands[commandName];
            if (command) {
                let currentPartIndex = 1;
                while (command.subcommands && commandParts[currentPartIndex]) {
                    const subcommand = command.subcommands[commandParts[currentPartIndex]];
                    if (subcommand) {
                        command = subcommand;
                        currentPartIndex++;
                    } else {
                        break;
                    }
                }

                if (command.require && !command.require(player)) {
                    player.sendMessage('You do not have permission to use this command.');
                    return;
                }

                if (command.minArgs !== undefined && args.length < command.minArgs) {
                    player.sendMessage(`Not enough arguments. Usage: ${this.commandPrefix}${command.name} ...`);
                    return;
                }

                if (command.maxArgs !== undefined && args.length > command.maxArgs) {
                    player.sendMessage(`Too many arguments. Usage: ${this.commandPrefix}${command.name} ...`);
                    return;
                }
                // コマンド実行
                command.executor(player, args);
            } else {
                // コマンドが存在しない場合、エラーメッセージを表示
                player.sendMessage(`Unknown command: ${this.commandPrefix}${commandName}`);
            }
        } else {
            // 通常のチャットメッセージを処理
            this.broadcastToClients({ event: 'playerChat', data: { sender, message } });
        }
    }

    private handleCommand(player: Player, commandName: string, args: string[]) {
        const commandParts = commandName.split(' ');
        let command = this.commands[commandParts[0]];

        if (command) {
            let currentPartIndex = 1;
            while (command.subcommands && commandParts[currentPartIndex]) {
                const subcommand = command.subcommands[commandParts[currentPartIndex]];
                if (subcommand) {
                    command = subcommand;
                    currentPartIndex++;
                } else {
                    break;
                }
            }

            if (command.require && !command.require(player)) {
                player.sendMessage('You do not have permission to use this command.');
                return;
            }

            if (command.minArgs !== undefined && args.length < command.minArgs) {
                player.sendMessage(`Not enough arguments. Usage: /${command.name} ...`);
                return;
            }

            if (command.maxArgs !== undefined && args.length > command.maxArgs) {
                player.sendMessage(`Too many arguments. Usage: /${command.name} ...`);
                return;
            }

            command.executor(player, args);
        } else {
            player.sendMessage(`Unknown command: ${commandName}`);
        }
    }

    // 全プレイヤー情報を要求する関数
    public requestAllPlayersInfo() {
        if (this.minecraftClient && this.minecraftClient.readyState === WebSocket.OPEN) {
            this.minecraftClient.send(JSON.stringify({ event: 'getAllPlayersInfo' }));
        } else {
            console.error('Minecraft server is not connected.');
        }
    }

    // Minecraftサーバーからのデータハンドラ (イベントに応じた処理)
    private handleMinecraftServerData(event: string, data: any) {
        switch (event) {
            case 'serverStatus':
                this.serverStatus = data;
                this.broadcastToClients({ event: 'serverStatusUpdate', data: this.serverStatus });
                break;
            case 'worldAdd':
                this.serverStatus.isWorldLoaded = true;
                this.broadcastToClients({ event: 'worldAdd', data });
                break;
            case 'worldRemove':
                this.serverStatus.isWorldLoaded = false;
                this.broadcastToClients({ event: 'worldRemove', data });
                break;
            case 'playerJoin':
                if (data.uuid) {
                    this.broadcastToClients({ event: 'playerJoin', data: { player: data.player, uuid: data.uuid } });
                    this.playersInfo.push({ name: data.player, uuid: data.uuid }); // playersInfoに追加
                } else {
                    this.broadcastToClients({ event: 'playerJoin', data: { player: data.player, uuid: "unknown" } });
                }
                break;
            case 'playerLeave':
                if (data.uuid) {
                    this.broadcastToClients({ event: 'playerLeave', data: { player: data.player, uuid: data.uuid } });
                    this.playersInfo = this.playersInfo.filter(p => p.uuid !== data.uuid); // playersInfoから削除
                } else {
                    this.broadcastToClients({ event: 'playerLeave', data: { player: data.player, uuid: "unknown" } });
                }
                break;
            case 'playerChat':
                // プレイヤーチャットを処理
                const { sender, message } = data;
                if (sender !== 'External') {
                    this.onPlayerChat(sender, message); // 内部でコマンド判定を行う
                }
                break;
            case 'serverShutdown':
                this.broadcastToClients({ event: 'serverShutdown', data });
                break;
            case 'commandResult':
                this.broadcastToClients({ event: 'commandResult', data });
                break;
            case 'allPlayersInfoResponse':
                this.playersInfo = data; // playersInfoを更新
                this.broadcastToClients({ event: 'allPlayersInfo', data: this.playersInfo });
                break;
            default:
                console.warn('Unknown event received:', event);
        }
    }

    public broadcastToClients(data: any) {
        const message = JSON.stringify(data);
        for (const client of this.clients.values()) {
            if (client.readyState === WebSocket.OPEN) {
                client.send(message);
            }
        }
    }

    public sendToMinecraft(data: any) {
        if (this.minecraftClient && this.minecraftClient.readyState === WebSocket.OPEN) {
            this.minecraftClient.send(JSON.stringify(data));
        } else {
            console.error('Minecraft server is not connected.');
        }
    }

    // (例) 定期的に全プレイヤー情報を更新する
    public startPlayersInfoUpdate(interval: number = 5000) {
        setInterval(() => {
            this.requestAllPlayersInfo();
        }, interval);
    }
}

// 使用例
const wsserver = new WsServer(3000);
wsserver.startPlayersInfoUpdate();

const myWorld = wsserver.createWorld('world');

// 仮の検証関数
const verifier: CommandVerifier = (player: Player) => {
    // ここに検証ロジックを実装 (例: プレイヤーが管理者かどうか)
    console.log("verifier:", player);
    return true; // 仮に常にtrueを返す
};



// コマンド登録の例（プレフィックスなしで登録）
wsserver.registerCommand({
    name: 'help',
    description: '利用可能なコマンド一覧を表示します。',
    parent: false,
    maxArgs: 0,
    minArgs: 0,
    executor: (player: Player) => {
        // コマンドおよびサブコマンドの表示を修正
        const commandPrefix = wsserver["commandPrefix"];
        const commandList = Object.values(wsserver["commands"])
            .filter((c) => !c.parent)
            .map((c) => {
                const subcommands =
                    Object.keys(c.subcommands).length > 0
                        ? `\n  サブコマンド: ${Object.keys(c.subcommands)
                            .map((sub) => `${commandPrefix}${c.name} ${sub}`)
                            .join(", ")}`
                        : "";
                return `${commandPrefix}${c.name} - ${c.description}${subcommands}`;
            })
            .join("\n");

        player.sendMessage(`利用可能なコマンド:\n${commandList}`);
    },
});

wsserver.registerCommand({
    name: 'about',
    description: 'このサーバーに関する情報を表示します。',
    parent: false,
    maxArgs: 0,
    minArgs: 0,
    require: verifier,
    executor: (player: Player) => {
        player.sendMessage('送信側と受信側で処理を分担できる(アルゴリズム実験中です）');
        player.sendMessage(`server: 1.0.0`); // 仮のバージョン番号
    },
});

wsserver.registerCommand({
    name: 'send',
    description: 'Minecraftサーバーにメッセージを送信します。',
    parent: false,
    minArgs: 1,
    executor: (_player: Player, args: string[]) => {
        const message = args.join(' ');
        myWorld.sendMessage(message)
    }
});

wsserver.registerCommand({
    name: 'run',
    description: 'Minecraftサーバーでコマンドを実行します。',
    parent: 'cmd',
    minArgs: 1,
    executor: async (player: Player, args: string[]) => {
        const command = args.join(' ');
        // 非同期関数でコマンドを実行
        const result = await player.runCommand(command);
        player.sendMessage(`Command Result: ${JSON.stringify(result)}`);
    },
});

wsserver.registerCommand({
    name: 'cmd',
    description: 'Minecraftサーバーでコマンドを実行します。',
    parent: false,
    executor: (player: Player) => {
        player.sendMessage(`使用法: ${wsserver["commandPrefix"]}cmd [send | run] <コマンド>`);
    }
});

// hasTag と getTags の使用例 (仮のコマンド)
wsserver.registerCommand({
    name: 'tags',
    description: 'タグ情報を表示します。',
    parent: false,
    maxArgs: 0,
    minArgs: 0,
    executor: async (player: Player) => {
        const hasOpTag = await player.hasTag('op');
        player.sendMessage(`${player.name} has 'op' tag: ${hasOpTag}`);

        const tags = await player.getTags();
        player.sendMessage(`${player.name}'s tags: ${tags.join(', ')}`);
    },
});