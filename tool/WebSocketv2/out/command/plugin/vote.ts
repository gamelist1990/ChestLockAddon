import { Player, world, registerCommand, prefix } from "../../backend";
import JsonDB from "../../module/DataBase";

interface VoteOption {
    id: number;
    text: string;
    count: number;
}

interface VoteData {
    name: string;
    title: string;
    options: VoteOption[];
    endTime: number;
    voters: { [playerName: string]: number };
    isActive: boolean;
}

class VoteManager {
    private db: JsonDB;
    private filePath: string = 'votes.json';
    private timerIds: { [voteName: string]: NodeJS.Timer } = {}; // タイマーIDを保存

    constructor() {
        this.db = new JsonDB(this.filePath);
        this.initializeTimers(); // 既存の投票のタイマーを初期化
    }

    // サーバー起動時に既存の投票のタイマーをセット
    private async initializeTimers() {
        const allVotes = await this.getAllVotes();
        for (const voteName in allVotes) {
            const vote = allVotes[voteName];
            if (vote.isActive && vote.endTime > Date.now()) {
                this.setTimer(voteName, vote.endTime - Date.now());
            }
        }
    }

    private setTimer(voteName: string, delay: number) {
        // 既存のタイマーがあればクリア
        if (this.timerIds[voteName]) {
            clearTimeout(this.timerIds[voteName]);
        }

        this.timerIds[voteName] = setTimeout(async () => {
            const vote = await this.getVote(voteName);
            if (vote && vote.isActive) {
                // 投票終了処理
                vote.isActive = false;
                await this.db.set(voteName, vote);
                const resultMessage = await this.getVoteResults(voteName);

                // 全プレイヤーに結果を通知
                world.getPlayers().then(players => {
                    players.forEach(p => {
                        p.sendMessage(`§6[投票終了]§r §b${vote.title}§r の投票が終了しました！`);
                        p.sendMessage(resultMessage);
                    });
                });

            }
            delete this.timerIds[voteName]; // タイマーIDを削除
        }, delay);
    }

    async createVote(name: string, title: string, optionsText: string, durationMs: number): Promise<string> {
        const votes = await this.db.getAll() as { [name: string]: VoteData };
        if (votes[name]) {
            return `§c投票名 '${name}' は既に使用されています。§r`;
        }

        const options = optionsText.split(',').map((text, index) => ({
            id: index + 1,
            text: text.trim(),
            count: 0,
        }));

        if (options.length < 2) {
            return "§c選択肢は少なくとも2つ必要です。§r";
        }
        if (options.some(option => option.text === "")) {
            return "§c空の選択肢は許可されていません。§r"
        }

        const endTime = Date.now() + durationMs;

        const newVote: VoteData = {
            name,
            title,
            options,
            endTime,
            voters: {},
            isActive: false,
        };

        await this.db.set(name, newVote);
        return `§a投票 '${name}' を作成しました。§r`;
    }

    async startVote(name: string, player: Player): Promise<string> {
        const votes = await this.db.getAll() as { [name: string]: VoteData };
        if (!votes[name]) {
            return `§c投票 '${name}' は存在しません。§r`;
        }
        if (votes[name].isActive) {
            return `§c投票 '${name}' は既に開始されています。§r`;
        }

        votes[name].isActive = true;
        await this.db.set(name, votes[name]);

        // タイマーをセット
        this.setTimer(name, votes[name].endTime - Date.now());

        const optionsText = votes[name].options.map(opt => `§3#${opt.id}§r: §b${opt.text}§r`).join(', ');
        world.getPlayers().then(players => {
            players.forEach(async p => {
                p.sendMessage(`§6[投票開始]§r §b${votes[name].title}§r (${optionsText})`);
                p.sendMessage(`投票するにはチャットで番号(例: §3#1§r)を入力してください。 制限時間: §e${await this.formatTimeRemaining(name)}§r`);
            });
        });

        return `§a投票 '${name}' を開始しました。§r`;
    }


    private async formatTimeRemaining(name: string): Promise<string> {
        const vote = await this.db.get(name) as VoteData | undefined;
        if (!vote) return "§c不明§r";
        const timeLeft = vote.endTime - Date.now();
        if (timeLeft <= 0) return "§e終了§r";

        const seconds = Math.floor(timeLeft / 1000);
        const minutes = Math.floor(seconds / 60);
        const remainingSeconds = seconds % 60;
        return `§e${minutes}分 ${remainingSeconds}秒§r`;
    }

    async stopVote(name: string, player: Player): Promise<string> {
        const votes = await this.db.getAll() as { [name: string]: VoteData };
        if (!votes[name]) {
            return `§c投票 '${name}'は存在しません§r`
        }
        if (!votes[name].isActive) {
            return `§c投票 '${name}'は開始していません§r`
        }
        votes[name].isActive = false;
        await this.db.set(name, votes[name]);

        // タイマーをクリア
        if (this.timerIds[name]) {
            clearTimeout(this.timerIds[name]);
            delete this.timerIds[name];
        }

        const resultMessage = await this.getVoteResults(name); // 結果を取得

        world.getPlayers().then(players => {
            players.forEach(p => {
                p.sendMessage(`§6[投票終了]§r §b${votes[name].title}§r の投票が手動で終了されました。`);
                p.sendMessage(resultMessage); // 結果を表示
            });
        });
        return `§a投票 '${name}'を終了しました§r`;

    }

    async removeVote(name: string): Promise<string> {
        if (!(await this.db.has(name))) {
            return `§c投票 '${name}' は存在しません。§r`;
        }

        await this.db.delete(name);

        // タイマーもクリア
        if (this.timerIds[name]) {
            clearTimeout(this.timerIds[name]);
            delete this.timerIds[name];
        }

        return `§a投票 '${name}' を削除しました。§r`;
    }

    async getVote(name: string): Promise<VoteData | undefined> {
        return await this.db.get(name) as VoteData | undefined;
    }

    async getAllVotes(): Promise<{ [name: string]: VoteData }> {
        return await this.db.getAll() as { [name: string]: VoteData };
    }


    async recordVote(playerName: string, voteName: string, optionId: number): Promise<string> {
        const vote = await this.db.get(voteName) as VoteData | undefined;

        if (!vote) {
            return "§cその投票は存在しません。§r";
        }
        if (!vote.isActive) {
            return "§cその投票は現在受け付けていません。§r";
        }
        if (vote.voters[playerName]) {
            return "§cあなたは既に投票済みです。§r";
        }
        if (Date.now() > vote.endTime) {
            return "§c投票は締め切られました。§r";
        }

        const option = vote.options.find(o => o.id === optionId);
        if (!option) {
            return "§c無効な選択肢です。§r";
        }

        vote.voters[playerName] = optionId;
        option.count++;
        await this.db.set(voteName, vote);
        return `§a投票を受け付けました: §b${option.text}§r`;
    }

    async getVoteResults(voteName: string): Promise<string> {
        const vote = await this.db.get(voteName) as VoteData | undefined;
        if (!vote) {
            return "§cその投票は存在しません。§r";
        }

        let resultMessage = `§6[投票結果]§r §b${vote.title}§r\n`;
        for (const option of vote.options) {
            resultMessage += `  §3#${option.id}§r §b${option.text}§r: §e${option.count} 票§r\n`;
        }

        resultMessage += "§6[投票者一覧]§r\n";
        for (const voter in vote.voters) {
            const optionId = vote.voters[voter];
            const optionText = vote.options.find(o => o.id === optionId)?.text;
            resultMessage += `  §b${voter}§r: §3${optionText}§r\n`;
        }

        return resultMessage;
    }
}
const voteManager = new VoteManager();

registerCommand({
    name: 'vote',
    description: '投票システム',
    maxArgs: Infinity,
    minArgs: 1,
    config: { enabled: true, adminOnly: false, requireTag: [] },
    usage: `${prefix}vote <create|config|start|remove|stop|result|list> ...`,
    executor: async (player: Player, args: string[]) => {
        const subCommand = args[0];

        switch (subCommand) {
            case 'create': {
                const name = args[1];
                const title = args[2];
                const options = args[3];
                let durationMsStr = args[4];

                if (!name || !title || !options || !durationMsStr) {
                    player.sendMessage(`§c引数が不足しています。使用法: ${prefix}vote create <name> <title> <options> <durationMs>§r`);
                    return;
                }

                // 時間を評価 (evalを使用)
                let durationMs;
                try {
                    durationMs = eval(durationMsStr);
                    if (typeof durationMs !== 'number') {
                        throw new Error("時間は数値または計算式である必要があります。");
                    }
                    if (durationMs <= 0) {
                        throw new Error("時間は正の数")
                    }
                } catch (error) {
                    player.sendMessage(`§c時間の指定が不正です: ${error.message} 例: 1000 * 60 (60秒)§r`);
                    return;
                }

                const result = await voteManager.createVote(name, title, options, durationMs);
                player.sendMessage(result);
                break;
            }
            case 'config': {
                const name = args[1];
                const action = args[2];

                if (!name || !action) {
                    player.sendMessage(`§c引数が不足しています。 使用法: ${prefix}vote config <name> <list|save>§r`);
                    return;
                }

                const vote = await voteManager.getVote(name);
                if (!vote) {
                    player.sendMessage(`§c投票 '${name}' は存在しません。§r`);
                    return;
                }

                switch (action) {
                    case 'list':
                        player.sendMessage(`§6--- 投票 '${name}' の設定 ---§r`);
                        player.sendMessage(`§aタイトル:§r §b${vote.title}§r`);
                        player.sendMessage(`§a選択肢:§r ${vote.options.map(opt => `§3#${opt.id}§r: §b${opt.text}§r`).join(', ')}`);
                        player.sendMessage(`§a終了時間:§r §e${new Date(vote.endTime).toLocaleString()}§r`);
                        break;
                    case 'save':
                        player.sendMessage(`§a投票 '${name}' の設定を保存しました(JsonDB制御)§r`);
                        break;
                    default:
                        player.sendMessage(`§c不明なアクション: ${action}§r`);
                }
                break;
            }
            case 'start': {
                const name = args[1];
                if (!name) {
                    player.sendMessage(`§c引数が不足しています。使用法: ${prefix}vote start <name>§r`);
                    return;
                }
                const result = await voteManager.startVote(name, player);
                player.sendMessage(result);
                break;
            }
            case "stop": {
                const name = args[1];
                if (!name) {
                    player.sendMessage(`§c引数が不足しています。使用法: ${prefix}vote stop <name>§r`);
                    return;
                }
                const result = await voteManager.stopVote(name, player);
                player.sendMessage(result);
                break;

            }
            case 'remove': {
                const name = args[1];
                if (!name) {
                    player.sendMessage(`§c引数が不足しています。使用法: ${prefix}vote remove <name>§r`);
                    return;
                }
                const result = await voteManager.removeVote(name);
                player.sendMessage(result);
                break;
            }
            case "result": {
                const name = args[1];
                if (!name) {
                    player.sendMessage(`§c引数が不足しています。使用法: ${prefix}vote result <name>§r`);
                    return;
                }
                const result = await voteManager.getVoteResults(name);
                player.sendMessage(result);
                break;
            }
            case 'list': {
                const allVotes = await voteManager.getAllVotes();
                if (Object.keys(allVotes).length === 0) {
                    player.sendMessage("§c現在作成されている投票はありません。§r");
                    return;
                }
                player.sendMessage("§6--- 作成された投票一覧 ---§r");
                for (const name in allVotes) {
                    const vote = allVotes[name];
                    player.sendMessage(`- §b${name}§r: §a${vote.title}§r (状態: ${vote.isActive ? "§6開催中§r" : "§e終了§r"})`);
                }
                break;
            }
            default:
                player.sendMessage(`§c不明なサブコマンド: ${subCommand}§r`);
        }
    },
});


world.on(
    'playerChat',
    async (sender: string, message: string, type: string) => {
        const player = await world.getEntityByName(sender);
        if (player && type === 'chat') {
            if (/^#\d+$/.test(message)) {
                const optionId = parseInt(message.substring(1));

                const allVotes = await voteManager.getAllVotes();
                for (const voteName in allVotes) {
                    const vote = allVotes[voteName];
                    if (vote && vote.isActive) {
                        const result = await voteManager.recordVote(player.name, voteName, optionId);
                        player.sendMessage(result);
                        break;
                    }
                }
            }
        }
    },
);