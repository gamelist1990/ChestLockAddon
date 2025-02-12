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
    private logging: boolean; // ロギングを有効にするかどうかのフラグ

    constructor(logging: boolean = false) { // logging フラグを受け取る
        this.db = new JsonDB(this.db_name);
        this.logging = logging; // logging フラグをセット
        this.initializeVotes(); // サーバー起動時に投票を読み込み、タイマーを初期化
    }

    // サーバー起動時に投票データを読み込み、タイマーをセット
    private async initializeVotes() {
        const allVotes = await this.getAllVotes();
        for (const voteName in allVotes) {
            const vote = allVotes[voteName];
            // 投票が有効、かつ終了時刻が設定されていて、まだ未来の場合
            if (vote.isActive && vote.endTime && vote.endTime > Date.now()) {
                this.setTimer(voteName, vote.endTime - Date.now());
            } else if (vote.isActive) {
                // 有効なのに終了時刻がおかしい場合は、無効化
                vote.isActive = false;
                vote.endTime = null; // 終了時刻をリセット
                await this.db.set(voteName, vote);
            }
        }
        if (this.logging) { // logging が有効な場合のみログ出力
            console.log('[VoteManager] 投票データを読み込み、タイマーを初期化しました。');
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
                vote.endTime = null; // 終了時刻をリセット
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

        // 10秒前通知のタイマー設定 (vote が存在し、isActive が true の場合のみ)
        if (delay > 10000) { // 残り時間が10秒以上ある場合のみ設定
            setTimeout(async () => {
                const vote = await this.getVote(voteName);
                if (vote && vote.isActive) { // タイマー発火時に再度チェック
                    world.getPlayers().then(players => {
                        players.forEach(p => {
                            p.sendMessage(`§6[投票]§r §b${vote.title}§r の投票終了まで残り §e10秒§r です！`);
                        });
                    });
                }
            }, delay - 10000); // 終了10秒前に設定
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
            duration: durationMs, // 投票期間を保存
            endTime: null,       // 開始前はnull
            voters: {},
            isActive: false,
        };

        await this.db.set(name, newVote);
        return `§a投票 '${name}' を作成しました。§r`;
    }

    async startVote(name: string, player: Player): Promise<string> {
        const vote = await this.getVote(name);
        if (!vote) {
            return `§c投票 '${name}' は存在しません。§r`;
        }
        if (vote.isActive) {
            return `§c投票 '${name}' は既に開始されています。§r`;
        }

        // --- 他の投票がアクティブでないか確認 ---
        const allVotes = await this.getAllVotes();
        for (const voteName in allVotes) {
            if (allVotes[voteName].isActive) {
                return `§c他の投票 '${voteName}' が既に開始されているため、開始できません。§r`;
            }
        }
        // -------------------------------------


        // --- 過去の投票記録を消去 ---
        // const allVotes = await this.getAllVotes();  // 上で取得しているので削除
        for (const voteName in allVotes) {
            if (voteName !== name && !allVotes[voteName].isActive) {
                await this.db.delete(voteName);
                // タイマーもクリア
                if (this.timerIds[voteName]) {
                    clearTimeout(this.timerIds[voteName]);
                    delete this.timerIds[voteName];
                }
            }
        }
        // --------------------------

        // 投票開始時にリセット (以前の投票結果をクリア)
        vote.voters = {};
        vote.options.forEach(option => {
            option.text = option.text;  // textは保持
        });


        // 投票開始時に終了時刻を計算
        vote.endTime = Date.now() + vote.duration;
        vote.isActive = true;
        await this.db.set(name, vote);

        // タイマーをセット
        this.setTimer(name, vote.duration);

        // 投票開始メッセージと選択肢リストを分けて送信
        world.getPlayers().then(players => {
            players.forEach(async p => {
                p.sendMessage(`§6[投票開始]§r §b${vote.title}§r`);
                p.sendMessage(`投票するにはチャットで番号(例: §a@1§r)を入力してください。 制限時間: §e${await this.formatTimeRemaining(name)}§r`);
                p.sendMessage("§6[選択肢]§r");
                vote.options.forEach(opt => {
                    p.sendMessage(`  §a§l@${opt.id}§r §f${opt.text}§r`);
                });
            });
        });

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
        // vote.voters = {};  // voters はリセットしない (結果表示に必要)
        await this.db.set(name, vote);

        // タイマーをクリア
        if (this.timerIds[name]) {
            clearTimeout(this.timerIds[name]);
            delete this.timerIds[name];
        }

        const resultMessage = await this.getVoteResults(name);

        world.getPlayers().then(players => {
            players.forEach(p => {
                p.sendMessage(`§6[投票終了]§r §b${vote.title}§r の投票が手動で終了されました。`);
                p.sendMessage(resultMessage);
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

        vote.voters[playerName] = optionId; // 投票者の選択を記録

        await this.db.set(voteName, vote); //変更を保存
        return `§a投票を受け付けました: §b${option.text}§r`;
    }

    async getVoteResults(voteName: string): Promise<string> {
        const vote = await this.db.get(voteName);
        if (!vote) {
            return "§cその投票は存在しません。§r";
        }

        let resultMessage = `§6[投票結果]§r §b${vote.title}§r\n`;

        // 各選択肢の票数を計算
        for (const option of vote.options) {
            let count = 0;
            for (const voter in vote.voters) {
                if (vote.voters[voter] === option.id) {
                    count++;
                }
            }
            resultMessage += `  §a§l@${option.id}§r §f${option.text}§r: §e${count} 票§r\n`;
        }


        resultMessage += "§6[投票者一覧]§r\n";
        for (const voter in vote.voters) {
            const optionId = vote.voters[voter];
            const optionText = vote.options.find(o => o.id === optionId)?.text;
            resultMessage += `  §b${voter}§r: §3${optionText ?? '不明な選択肢'}§r\n`; // optionText が undefined の場合の対応
        }


        return resultMessage;
    }

    async updateVote(name: string, key: 'title' | 'options' | 'time', value: any): Promise<string> {
        const vote = await this.getVote(name);
        if (!vote) {
            return `§c投票 '${name}' は存在しません。§r`;
        }

        switch (key) {
            case 'title':
                if (typeof value !== 'string') {
                    return '§cタイトルは文字列である必要があります。§r';
                }
                vote.title = value;
                break;
            case 'options':
                if (typeof value !== 'string') {
                    return '§cオプションは文字列である必要があります。§r'
                }
                const newOptions = value.split(',').map((text, index) => ({
                    id: index + 1,
                    text: text.trim(),
                }));
                if (newOptions.length < 2) {
                    return '§c選択肢は少なくとも2つ必要です§r'
                }
                if (newOptions.some(option => option.text === "")) {
                    return "§c空の選択肢は許可されていません§r";
                }

                vote.options = newOptions;
                break;

            case 'time':
                let newDuration;
                try {
                    newDuration = eval(value);  // eval を使用
                    if (typeof newDuration !== 'number') {
                        throw new Error('期間は数値、または有効な計算式である必要があります。');
                    }
                    if (newDuration <= 0) {
                        throw new Error('期間は正の数である必要があります')
                    }
                } catch (error) {
                    return `§c期間の指定が不正です： ${error.message} 例：1000 * 60（60秒）§r`;
                }
                vote.duration = newDuration;

                break;
            default:
                return `§c無効なキー: ${key}§r`;
        }

        await this.db.set(name, vote);
        return `§a投票 '${name}' の ${key} を更新しました。§r`;
    }
}



registerPlugin(
    'vote',
    {},
    true,
    async () => {
        const voteManager = new VoteManager(true);

        // コマンド登録
        registerCommand({
            name: 'vote',
            description: '投票システム',
            maxArgs: Infinity,
            minArgs: 1,
            config: { enabled: true, adminOnly: false, requireTag: [] },
            usage: `<create|config|start|remove|stop|result|list> ...`,
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
                    case 'config': {
                        const name = args[1];
                        const action = args[2];

                        if (!name || !action) {
                            player.sendMessage(`§c引数が不足しています。 使用法: ${prefix}vote config <名前> <一覧|保存|update>§r`);
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
                                player.sendMessage(`§a選択肢:§r`);
                                vote.options.forEach(opt => {
                                    player.sendMessage(`  §a§l@${opt.id}§r §f${opt.text}§r`);
                                });
                                player.sendMessage(`§a期間:§r §e${vote.duration} ミリ秒§r`);
                                break;
                            case 'save':
                                player.sendMessage(`§a投票 '${name}' の設定を保存しました（JsonDB制御)§r`);
                                break;

                            case 'update':
                                const key = args[3] as 'title' | 'options' | 'time';
                                const value = args.slice(4).join(' ');  // 可変長の引数に対応

                                if (!key || !value) {
                                    player.sendMessage(`§c引数が不足しています。使用法: ${prefix}vote config <名前> update <title|options|time> <新しい値>§r`);
                                    return;
                                }

                                const updateResult = await voteManager.updateVote(name, key, value);
                                player.sendMessage(updateResult)
                                break;
                            default:
                                player.sendMessage(`§c不明なアクション: ${action}§r`);
                        }

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

        // チャットイベントリスナー
        world.on('playerChat', async (sender: string, message: string, type: string) => {
            const player = await world.getEntityByName(sender);
            if (player && type === 'chat') {
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