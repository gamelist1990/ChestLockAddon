import { world, registerCommand, prefix } from '../../../backend';
import JsonDB from '../../../module/DataBase';
import { Player } from '../../../module/player';
import { registerPlugin } from '../plugin';

interface VoteOption {
    id: number;
    text: string;
}

interface VoteData {
    name: string;
    title: string;
    options: VoteOption[];
    duration: number; // 投票期間 (ミリ秒)
    endTime: number | null; // 投票終了時刻 (ミリ秒、UNIXタイムスタンプ)。開始前はnull
    voters: { [playerName: string]: number }; // 投票者とその選択肢ID
    isActive: boolean;
}

class VoteManager {
    private db: JsonDB;
    private db_name: string = 'votes';
    private timerIds: { [voteName: string]: NodeJS.Timer } = {};
    private logging: boolean;

    constructor(logging: boolean = false) {
        this.db = new JsonDB(this.db_name);
        this.logging = logging;
        this.initializeVotes();
    }

    private async initializeVotes() {
        const allVotes = await this.getAllVotes();
        for (const voteName in allVotes) {
            const vote = allVotes[voteName];
            if (vote.isActive && vote.endTime && vote.endTime > Date.now()) {
                this.setTimer(voteName, vote.endTime - Date.now());
            } else if (vote.isActive) {
                vote.isActive = false;
                vote.endTime = null;
                await this.db.set(voteName, vote);
            }
        }
    }

    private setTimer(voteName: string, delay: number) {
        if (this.timerIds[voteName]) {
            clearTimeout(this.timerIds[voteName]);
        }

        this.timerIds[voteName] = setTimeout(async () => {
            const vote = await this.getVote(voteName);
            if (vote && vote.isActive) {
                vote.isActive = false;
                vote.endTime = null;
                await this.db.set(voteName, vote);
                await this.sendVoteResults(voteName); // 結果を送信
            }
            delete this.timerIds[voteName];
        }, delay);

        if (delay > 10000) {
            setTimeout(async () => {
                const vote = await this.getVote(voteName);
                if (vote && vote.isActive) {
                    const players = await world.getPlayers();
                    for (const p of players) {
                        p.sendMessage(`§6[投票]§r §b${vote.title}§r の投票終了まで残り §e10秒§r です！`);
                    }
                }
            }, delay - 10000);
        }
    }

    async createVote(name: string, title: string, optionsText: string, durationMs: number): Promise<string> {
        const votes = await this.db.getAll() as { [name: string]: VoteData };
        if (votes[name]) {
            return `§c投票名 '${name}' は既に使用されています。§r`;
        }

        const options = optionsText.split(',').map((text, index) => ({
            id: index + 1,
            text: text.trim(),
        }));

        if (options.length < 2) {
            return "§c選択肢は少なくとも2つ必要です。§r";
        }
        if (options.some(option => option.text === "")) {
            return "§c空の選択肢は許可されていません。§r"
        }

        const newVote: VoteData = {
            name,
            title,
            options,
            duration: durationMs,
            endTime: null,
            voters: {},
            isActive: false,
        };

        await this.db.set(name, newVote);
        return `§a投票 '${name}' を作成し、保存しました。§r`;
    }

    async startVote(name: string, player: Player): Promise<string> {
        const vote = await this.getVote(name);
        if (!vote) {
            return `§c投票 '${name}' は存在しません。§r`;
        }
        if (vote.isActive) {
            return `§c投票 '${name}' は既に開始されています。§r`;
        }

        const allVotes = await this.getAllVotes();
        for (const voteName in allVotes) {
            if (allVotes[voteName].isActive) {
                return `§c他の投票 '${voteName}' が既に開始されているため、開始できません。§r`;
            }
        }

        for (const voteName in allVotes) {
            if (voteName !== name && !allVotes[voteName].isActive) {
                await this.db.delete(voteName);
                if (this.timerIds[voteName]) {
                    clearTimeout(this.timerIds[voteName]);
                    delete this.timerIds[voteName];
                }
            }
        }

        vote.voters = {};
        vote.options.forEach(option => {
            option.text = option.text;
        });

        vote.endTime = Date.now() + vote.duration;
        vote.isActive = true;
        await this.db.set(name, vote);

        this.setTimer(name, vote.duration);

        const players = await world.getPlayers();
        for (const p of players) {
            p.sendMessage(`§6[投票開始]§r §b${vote.title}§r`);
            p.sendMessage(`投票するにはチャットで番号(例: §a@1§r)を入力してください。 制限時間: §e${await this.formatTimeRemaining(name)}§r`);
            p.sendMessage("§6[選択肢]§r");
            for (const opt of vote.options) {
                p.sendMessage(`  §a§l@§f${opt.text}§r`);
            }
        }

        return `§a投票 '${name}' を開始しました。§r`;
    }



    private async formatTimeRemaining(name: string): Promise<string> {
        const vote = await this.getVote(name);
        if (!vote || !vote.endTime) return "§c不明§r";
        const timeLeft = vote.endTime - Date.now();
        if (timeLeft <= 0) return "§e終了§r";

        const seconds = Math.floor(timeLeft / 1000);
        const minutes = Math.floor(seconds / 60);
        const remainingSeconds = seconds % 60;
        return `§e${minutes}分 ${remainingSeconds}秒§r`;
    }

    async stopVote(name: string, player: Player): Promise<string> {
        const vote = await this.getVote(name);
        if (!vote) {
            return `§c投票 '${name}'は存在しません§r`
        }
        if (!vote.isActive) {
            return `§c投票 '${name}'は開始していません§r`
        }
        vote.isActive = false;
        vote.endTime = null;
        await this.db.set(name, vote);

        if (this.timerIds[name]) {
            clearTimeout(this.timerIds[name]);
            delete this.timerIds[name];
        }

        await this.sendVoteResults(name); // 結果送信

        return `§a投票 '${name}'を終了しました§r`;

    }

    async removeVote(name: string): Promise<string> {
        if (!(await this.db.has(name))) {
            return `§c投票 '${name}' は存在しません。§r`;
        }

        await this.db.delete(name);

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
        const vote = await this.db.get(voteName);

        if (!vote) {
            return "§cその投票は存在しません。§r";
        }
        if (!vote.isActive) {
            return "§cその投票は現在受け付けていません。§r";
        }
        if (vote.voters[playerName]) {
            return "§cあなたは既に投票済みです。§r";
        }
        if (vote.endTime && Date.now() > vote.endTime) {
            return "§c投票は締め切られました。§r";
        }

        const option = vote.options.find(o => o.id === optionId);
        if (!option) {
            return "§c無効な選択肢です。§r";
        }

        vote.voters[playerName] = optionId;
        await this.db.set(voteName, vote);
        return `§a投票を受け付けました: §b${option.text}§r`;
    }


    // 投票結果を分割して送信するメソッド
    async sendVoteResults(voteName: string): Promise<void> {
        const vote = await this.getVote(voteName);
        if (!vote) return;

        const players = await world.getPlayers();
        const baseMessage = `§6[投票結果]§r §b${vote.title}§r`;

        for (const player of players) {
            player.sendMessage(baseMessage);  // タイトルを送信

            // 各選択肢の票数を送信
            for (const option of vote.options) {
                let count = 0;
                for (const voter in vote.voters) {
                    if (vote.voters[voter] === option.id) {
                        count++;
                    }
                }
                player.sendMessage(`  §a§l@§r§f${option.text}§r: §e${count} 票§r`);
            }


            player.sendMessage("§6[投票者一覧]§r");  // 投票者一覧のヘッダ

            // 投票者一覧を送信
            for (const voter in vote.voters) {
                const optionId = vote.voters[voter];
                const optionText = vote.options.find(o => o.id === optionId)?.text;
                player.sendMessage(`  §b${voter}§r: §3${optionText ?? '不明な選択肢'}§r`);
            }
        }
    }

    // 従来の getVoteResults (使われなくなる)
    async getVoteResults(voteName: string): Promise<string> {
        return "このメソッドは使われません"; // または空文字列を返すなど
    }


}


registerPlugin(
    'vote',
    {},
    true,
    async () => {
        const voteManager = new VoteManager(true);

        registerCommand({
            name: 'vote',
            description: '投票システム',
            maxArgs: Infinity,
            minArgs: 1,
            config: { enabled: true, adminOnly: false, requireTag: [] },
            usage: `<create|start|remove|stop|result|list> ...`,
            executor: async (player: Player, args: string[]) => {
                const subCommand = args[0];

                switch (subCommand) {
                    case 'create': {
                        const name = args[1];
                        const title = args[2];
                        const options = args[3];
                        let durationMsStr = args[4];

                        if (!name || !title || !options || !durationMsStr) {
                            player.sendMessage(`§c引数が不足しています。使用法: ${prefix}vote create <名前> <タイトル> <選択肢> <期間>§r`);
                            return;
                        }

                        let durationMs;
                        try {
                            durationMs = eval(durationMsStr);
                            if (typeof durationMs !== 'number') {
                                throw new Error("期間は数値または計算式である必要があります。");
                            }
                            if (durationMs <= 0) {
                                throw new Error("期間は正の数である必要があります。")
                            }
                        } catch (error) {
                            player.sendMessage(`§c期間の指定が不正です: ${error.message} 例: 1000 * 60 (60秒)§r`);
                            return;
                        }

                        const result = await voteManager.createVote(name, title, options, durationMs);
                        player.sendMessage(result);
                        break;
                    }
                    case 'start': {
                        const name = args[1];
                        if (!name) {
                            player.sendMessage(`§c引数が不足しています。使用法: ${prefix}vote start <名前>§r`);
                            return;
                        }
                        const result = await voteManager.startVote(name, player);
                        player.sendMessage(result);
                        break;
                    }
                    case 'stop': {
                        const name = args[1];
                        if (!name) {
                            player.sendMessage(`§c引数が不足しています。使用法: ${prefix}vote stop <名前>§r`);
                            return;
                        }
                        const result = await voteManager.stopVote(name, player)
                        player.sendMessage(result);
                        break;

                    }
                    case 'remove': {
                        const name = args[1];
                        if (!name) {
                            player.sendMessage(`§c引数が不足しています。使用法: ${prefix}vote remove <名前>§r`);
                            return;
                        }
                        const result = await voteManager.removeVote(name);
                        player.sendMessage(result);
                        break;
                    }
                    case 'result': {
                        const name = args[1];
                        if (!name) {
                            player.sendMessage(`§c引数が不足しています。使用法: ${prefix}vote result <名前>§r`);
                            return;
                        }
                        // sendVoteResults を使うように変更
                        await voteManager.sendVoteResults(name);
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

        world.on('playerChat', async (sender: string, message: string, type: string) => {
            const player = await world.getEntityByName(sender);
            if (!player) return;
            if (type === 'chat' || type === "scoreboard") {
                if (/^@\d+$/.test(message)) {
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
        });
    }
);