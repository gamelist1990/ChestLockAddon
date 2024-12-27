import { Player, ScoreboardIdentity, ScoreboardIdentityType, ScriptEventCommandMessageAfterEvent, world } from "@minecraft/server";


export class RankSystem {
    public title: string;
    public scoreboardName: string;
    public rankTiers: string[];
    public rankThresholds: { [key: string]: number };

    /**
     * 新しいランクシステムを作成します。
     * @param {string} title - ランクシステムのタイトル
     * @param {string} scoreboardName - スコアボード名
     * @param {string[]} rankTiers - ランク名の配列
     * @param {number[]} rankThresholds - 各ランクの閾値の配列 (rankTiersと同じ長さである必要があります)
     */
    constructor(title: string, scoreboardName: string, rankTiers: string[], rankThresholds: number[]) {
        this.title = title;
        this.scoreboardName = scoreboardName;
        this.rankTiers = rankTiers;
        this.rankThresholds = {};

        if (rankTiers.length !== rankThresholds.length) {
            throw new Error("rankTiersとrankThresholdsの長さが一致しません。");
        }

        for (let i = 0; i < rankTiers.length; i++) {
            this.rankThresholds[rankTiers[i]] = rankThresholds[i];
        }

        // スコアボードが存在しない場合は作成する
        let objective = world.scoreboard.getObjective(this.scoreboardName);
        if (!objective) {
            objective = world.scoreboard.addObjective(this.scoreboardName, this.title);
            console.warn(`スコアボード '${this.scoreboardName}' が作成されました。`);
        }
    }

    /**
     * ランクスコアからランク名を取得します。
     * @param {number} rankScore - ランクスコア
     * @returns {string} ランク名
     */
    getRankNameFromScore(rankScore: number): string {
        for (let i = this.rankTiers.length - 1; i >= 0; i--) {
            const rank = this.rankTiers[i];
            if (rankScore >= this.rankThresholds[rank]) {
                return rank;
            }
        }
        return this.rankTiers[0]; // 最小スコア未満の場合は最低ランク
    }

    /**
     * ランク名からランクスコアを取得します。(各ランクの最低スコアを返す)
     * @param {string} rankName - ランク名
     * @returns {number} ランクスコア
     */
    getRankScoreFromName(rankName: string): number {
        return this.rankThresholds[rankName] ?? 0;
    }

    /**
     * プレイヤーのランクスコアを取得します。
     * @param {Player | string | ScoreboardIdentity} player - プレイヤーオブジェクト、プレイヤー名、またはスコアボードID
     * @returns {number} ランクスコア
     */
    getPlayerRankScore(player: Player | string | ScoreboardIdentity): number {
        const objective = world.scoreboard.getObjective(this.scoreboardName);
        if (!objective) return 0;

        if (typeof player === "string") {
            const score = objective.getScore(player)
            return score !== undefined ? score : 0;

        } else if (player instanceof Player) {
            const score = objective.getScore(player)
            return score !== undefined ? score : 0;
        } else {
            const score = objective.getScore(player)
            return score !== undefined ? score : 0;
        }
    }

    /**
     * プレイヤーのランクを更新します。
     * @param {Player | string | ScoreboardIdentity} player - プレイヤーオブジェクト、プレイヤー名、またはスコアボードID
     * @param {number} newRankScore - 新しいランクスコア
     */
    updatePlayerRank(player: Player | string | ScoreboardIdentity, newRankScore: number) {
        const objective = world.scoreboard.getObjective(this.scoreboardName);
        const oldRankScore = this.getPlayerRankScore(player);
        const oldRankName = this.getRankNameFromScore(oldRankScore);
        const newRankName = this.getRankNameFromScore(newRankScore);

        // スコアがランクの閾値を下回らないようにする
        const minScore = this.getRankScoreFromName(newRankName);
        newRankScore = Math.max(minScore, newRankScore);

        if (player instanceof Player) {
            if (newRankName) {
                // プレイヤーがオンラインの場合は、タグを更新
                // 以前のランクタグを削除
                player.getTags().filter(tag => tag.startsWith(`${this.scoreboardName}:`)).forEach(tag => player.removeTag(tag));
                // 新しいランクタグを追加
                player.addTag(`${this.scoreboardName}:${newRankName}`);
            }

            if (objective) {
                objective.setScore(player, newRankScore);
            }
            if (oldRankName !== newRankName) {
                player.sendMessage(`${this.title}のランクが ${oldRankName} から ${newRankName} に変更されました！`);
            }
        } else {
            if (objective) {
                objective.setScore(player, newRankScore);
            }
            // オフラインプレイヤーのタグ更新は、オンラインになった時に処理
        }
    }

    /**
     * プレイヤーをランクシステムに参加させます。
     * @param {Player} player - 参加するプレイヤー
     */
    addPlayerToRank(player: Player) {
        const currentScore = this.getPlayerRankScore(player);
        if (currentScore === 0) {
            this.updatePlayerRank(player, 0);
            player.sendMessage(`${this.title}に参加しました！`);
        } else {
            player.sendMessage(`既に${this.title}に参加しています。`);
        }
    }

    /**
     * プレイヤーのランクをリセットします。
     * @param {Player | string | ScoreboardIdentity} player - リセットするプレイヤーオブジェクト、プレイヤー名、またはスコアボードID
     */
    resetPlayerRank(player: Player | string | ScoreboardIdentity) {
        this.updatePlayerRank(player, 0);
    }

    /**
     * 全てのプレイヤーのランクをリセットします。
     */
    resetAllPlayersRank() {
        const objective = world.scoreboard.getObjective(this.scoreboardName);
        if (!objective) {
            console.error(`Objective ${this.scoreboardName} is undefined.`);
            return;
        }
        for (const participant of objective.getParticipants()) {
            this.resetPlayerRank(participant);
        }
        console.warn(`${this.title}の全てのプレイヤーのランクをリセットしました。`);
    }
}

// 登録済みのランクシステムのインスタンスを保持する配列
const registeredRanks: RankSystem[] = [];

/**
 * 新しいランクシステムを登録します。
 * @param {RankSystem} rankSystem - 登録するランクシステム
 */
export function registerRank(rankSystem: RankSystem) {
    registeredRanks.push(rankSystem);
    console.warn(`新しいランクシステム '${rankSystem.title}' が登録されました。`);

    // スコアボードが既に存在するかどうかを確認
    const objective = world.scoreboard.getObjective(rankSystem.scoreboardName);
    if (objective) {
        console.warn(`スコアボード '${rankSystem.scoreboardName}' は既に存在しています。`);

        // 既存のスコアを持つプレイヤーにランクを割り当てる
        for (const participant of objective.getParticipants()) {
            const score = objective.getScore(participant);
            if (score !== undefined) {
                rankSystem.updatePlayerRank(participant, score);
                // プレイヤーがオンラインの場合は、メッセージを表示
                if (participant.type === ScoreboardIdentityType.Player) {
                    const player = world.getAllPlayers().find(p => p.name === participant.displayName);
                    if (player) {
                        const rankName = rankSystem.getRankNameFromScore(score);
                        player.sendMessage(`${rankSystem.title} に参加しました。現在のランク: ${rankName}`);
                    }
                }
            }
        }
    } else {
        console.warn(`スコアボード '${rankSystem.scoreboardName}' は新しく作成されました。`);
    }
}

/**
 * ランクシステムへのコマンドを処理します。
 * @param {any} event - スクリプトイベント
 */
export function handleRankCommand(event: ScriptEventCommandMessageAfterEvent) {
    const args = event.message.replace(/^\/(ch:rank|registerRank)\s+/, "").split(/\s+/);
    const command = event.message.split(/\s+/)[0].substring(1);
    const initiator = event.sourceEntity as Player;

    if (command === "registerRank") {
        // registerRankコマンドの処理
        if (args.length < 4) {
            initiator.sendMessage("使用方法: registerRank <タイトル> <スコアボード名> <ランク名1,ランク名2,...> <閾値1,閾値2,...>");
            return;
        }

        const title = args[0];
        const scoreboardName = args[1];
        const rankTiers = args[2].split(",");
        const rankThresholds = args[3].split(",").map(Number);

        try {
            const newRank = new RankSystem(title, scoreboardName, rankTiers, rankThresholds);
            registerRank(newRank);
            initiator.sendMessage(`新しいランクシステム '${title}' を登録しました。`);
        } catch (error) {
            const errorMessage = (error as Error).message;
            initiator.sendMessage(`エラー: ${errorMessage}`);
        }
    } else if (command === "ch:rank") {
        // ch:rankコマンドの処理
        if (args.length < 2) {
            initiator.sendMessage("使用方法: ch:rank <システム名> <join|reset|add|remove>");
            return;
        }

        const rankSystemName = args[0];
        const rankSystem = registeredRanks.find(rank => rank.scoreboardName === rankSystemName);

        if (!rankSystem) {
            initiator.sendMessage(`ランクシステム '${rankSystemName}' は見つかりません。`);
            return;
        }

        // コマンド処理
        if (args[1] === "join" && initiator) {
            rankSystem.addPlayerToRank(initiator);
        } else if (args[1] === "reset") {
            if (args.length < 3) {
                initiator.sendMessage(`使用方法: /ch:rank ${rankSystemName} reset <プレイヤー名> or <all>`);
                return;
            }
            if (args[2] === "all") {
                rankSystem.resetAllPlayersRank();
            } else {
                const targetPlayerName = args[2];
                const targetPlayer = world.getAllPlayers().find(p => p.name === targetPlayerName);

                // セレクターの処理を追加
                const targetParticipants: (Player | string | ScoreboardIdentity)[] = [];
                if (targetPlayerName.startsWith("@")) {
                    const matchingPlayers = world.getPlayers({ name: targetPlayerName });
                    if (matchingPlayers.length > 0) {
                        targetParticipants.push(...matchingPlayers);
                    } else {
                        // セレクターに一致するプレイヤーがいない場合、スコアボードIDとして扱う
                        const objective = world.scoreboard.getObjective(rankSystem.scoreboardName);
                        const participant = objective?.getParticipants().find(p => p.displayName === targetPlayerName);
                        if (participant) {
                            targetParticipants.push(participant);
                        }
                    }
                } else {
                    if (targetPlayer) {
                        targetParticipants.push(targetPlayer);
                    } else {
                        // プレイヤー名に一致するプレイヤーがいない場合、スコアボードIDとして扱う
                        const objective = world.scoreboard.getObjective(rankSystem.scoreboardName);
                        const participant = objective?.getParticipants().find(p => p.displayName === targetPlayerName);
                        if (participant) {
                            targetParticipants.push(participant);
                        } else {
                            targetParticipants.push(targetPlayerName)
                        }
                    }
                }

                if (targetParticipants.length === 0) {
                    initiator.sendMessage(`プレイヤーまたはスコアボードID '${targetPlayerName}' が見つかりません。`);
                    return;
                }

                for (const targetParticipant of targetParticipants) {
                    rankSystem.resetPlayerRank(targetParticipant);
                }
            }
        } else if (args[1] === "add" || args[1] === "remove") {
            if (args.length < 3) {
                initiator.sendMessage(`使用方法: ch:rank ${rankSystemName} ${args[1]} <値>`);
                return;
            }

            const scoreChange = parseInt(args[2]);
            if (isNaN(scoreChange)) {
                initiator.sendMessage("値は数値を指定してください。");
                return;
            }

            const currentScore = rankSystem.getPlayerRankScore(initiator);
            let newScore = args[1] === "add" ? currentScore + scoreChange : currentScore - scoreChange;
            rankSystem.updatePlayerRank(initiator, newScore);
        } else {
            // ランク表示
            const rankScore = rankSystem.getPlayerRankScore(initiator);
            const currentRank = rankSystem.getRankNameFromScore(rankScore);
            initiator.sendMessage(`あなたの${rankSystem.title}ランク: ${currentRank}  現在のランクポイント : ${rankScore}`);
        }
    }
}



world.afterEvents.playerSpawn.subscribe(event => {
    const player = event.player;
    if (event.initialSpawn) {
        // オフラインだったプレイヤーのタグを更新
        for (const rankSystem of registeredRanks) {
            const objective = world.scoreboard.getObjective(rankSystem.scoreboardName);
            if (objective) {
                const rankScore = objective.getScore(player);
                if (rankScore !== undefined) {
                    const rankName = rankSystem.getRankNameFromScore(rankScore);
                    // 以前のランクタグを削除
                    player.getTags().filter(tag => tag.startsWith(`${rankSystem.scoreboardName}:`)).forEach(tag => player.removeTag(tag));
                    // 新しいランクタグを追加
                    player.addTag(`${rankSystem.scoreboardName}:${rankName}`);
                }
            }
        }
    }
});