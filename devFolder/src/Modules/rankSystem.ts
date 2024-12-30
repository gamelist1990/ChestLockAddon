import {
    Entity,
    EntityRaycastHit,
    Player,
    ScoreboardIdentity,
    ScoreboardIdentityType,
    ScriptEventCommandMessageAfterEvent,
    system,
    world,
} from '@minecraft/server';
import { ActionFormData, ModalFormData } from '@minecraft/server-ui';

interface Participant {
    name: string;
    score: number;
    scoreboardIdentity?: ScoreboardIdentity;
}

export class RankSystem {
    public title: string;
    public scoreboardName: string;
    public rankTiers: string[];
    public rankThresholds: { [key: string]: number };
    private lastKnownScores: { [participant: string]: number };

    /**
     * 指定された参加者の最後の既知のスコアを取得します。
     * @param {string} participant - 参加者の名前（または displayName）
     * @returns {number | undefined} 最後の既知のスコア。参加者が存在しない場合は undefined。
     */
    public getLastKnownScore(participant: string): number | undefined {
        return this.lastKnownScores[participant];
    }

    /**
     * 指定された参加者の最後の既知のスコアを更新します。
     * @param {string} participant - 参加者の名前（または displayName）
     * @param {number} score - 新しいスコア
     */
    public updateLastKnownScore(participant: string, score: number): void {
        this.lastKnownScores[participant] = score;
    }

    /**
     * 新しいランクシステムを作成します。
     * @param {string} title - ランクシステムのタイトル
     * @param {string} scoreboardName - スコアボード名
     * @param {string[]} rankTiers - ランク名の配列
     * @param {number[]} rankThresholds - 各ランクの閾値の配列 (rankTiersと同じ長さである必要があります)
     */
    constructor(
        title: string,
        scoreboardName: string,
        rankTiers: string[],
        rankThresholds: number[],
    ) {
        this.title = title;
        this.scoreboardName = scoreboardName;
        this.rankTiers = rankTiers;
        this.rankThresholds = {};
        this.lastKnownScores = {};

        if (rankTiers.length !== rankThresholds.length) {
            throw new Error('rankTiersとrankThresholdsの長さが一致しません。');
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
     * @param {Player | string | ScoreboardIdentity | Participant} player - プレイヤーオブジェクト、プレイヤー名、スコアボードID、または参加者オブジェクト
     * @returns {number} ランクスコア
     */
    getPlayerRankScore(player: Player | string | ScoreboardIdentity | Participant): number {
        const objective = world.scoreboard.getObjective(this.scoreboardName);
        if (!objective) return 0;

        if (typeof player === "string") {
            // 文字列でプレイヤーを扱う場合
            console.warn("文字列でスコアを扱うことは非推奨です");

            let targetScore: number | undefined;
            for (const p of world.getAllPlayers()) {
                if (p.name === player) {
                    if (!p.scoreboardIdentity) {
                    } else if (objective.hasParticipant(p.scoreboardIdentity)) { // プレイヤーがスコアボードに存在するか確認
                        targetScore = objective.getScore(p.scoreboardIdentity);
                        break;
                    }
                }
            }
            return targetScore ?? 0; // スコアが取得できない、またはプレイヤーがスコアボードに存在しない場合は 0 を返す

        } else if (player instanceof Player) {
            // Player オブジェクトを直接扱う場合

            if (!player.scoreboardIdentity) {
                return 0;
            }
            // プレイヤーがスコアボードに存在するか確認
            if (objective.hasParticipant(player.scoreboardIdentity)) {
                return objective.getScore(player.scoreboardIdentity) ?? 0;
            } else {
                return 0;
            }

        } else if ("scoreboardIdentity" in player && player.scoreboardIdentity) {
            // ScoreboardIdentity を直接扱う場合
            // プレイヤーがスコアボードに存在するか確認
            if (objective.hasParticipant(player.scoreboardIdentity)) {
                const score = objective.getScore(player.scoreboardIdentity);
                return score !== undefined ? score : 0;
            } else {
                return 0;
            }

        } else if ("id" in player) {
            // "id" プロパティを持つオブジェクト(Participant) を扱う場合
            if (objective.hasParticipant(player)) {
                const score = objective.getScore(player);
                return score !== undefined ? score : 0;
            } else {
                return 0;
            }
        } else { // Participant型の場合(到達しないはず)
            return 0;
        }
    }

    /**
     * プレイヤーのランクを更新します。
     * @param {Player | string | ScoreboardIdentity} player - プレイヤーオブジェクト、プレイヤー名、またはスコアボードID
     * @param {number} newRankScore - 新しいランクスコア
     * @param {boolean} isFromRunInterval - system.runIntervalから呼ばれたかどうか
     */
    updatePlayerRank(
        player: Player | string | ScoreboardIdentity,
        newRankScore: number,
        isFromRunInterval: boolean = false,
    ) {
        const objective = world.scoreboard.getObjective(this.scoreboardName);
        const oldRankScore = this.getPlayerRankScore(player);
        const oldRankName = this.getRankNameFromScore(oldRankScore);
        const newRankName = this.getRankNameFromScore(newRankScore);

        // スコアがランクの閾値を下回らないようにする
        const minScore = this.getRankScoreFromName(newRankName);
        newRankScore = Math.max(minScore, newRankScore);

        // スコアボードの参加者の表示名を取得
        let participantName: string;
        if (player instanceof Player) {
            participantName = player.name;
        } else if (typeof player === 'string') {
            participantName = player;
        } else {
            participantName = player.displayName;
        }

        if (player instanceof Player) {
            // プレイヤーがオンラインの場合は、タグを更新
            this.updatePlayerRankTag(player, newRankName);

            if (objective) {
                objective.setScore(player, newRankScore);
            }
            if (oldRankName !== newRankName) {
                player.sendMessage(
                    `${this.title}のランクが ${oldRankName} から ${newRankName} に変更されました！`,
                );
            }
        } else {
            if (objective) {
                objective.setScore(player, newRankScore);
            }
            // オフラインプレイヤーのタグ更新は、オンラインになった時に処理
        }
        // 最後の既知のスコアを更新
        if (!isFromRunInterval) {
            this.updateLastKnownScore(participantName, newRankScore);
        }
    }

    /**
     * プレイヤーのランクタグを更新します。
     * @param {Player} player - プレイヤーオブジェクト
     * @param {string} newRankName - 新しいランク名
     */
    updatePlayerRankTag(player: Player, newRankName: string) {
        // 以前のランクタグを削除
        player
            .getTags()
            .filter((tag) => tag.startsWith(`${this.scoreboardName}:`))
            .forEach((tag) => player.removeTag(tag));
        // 新しいランクタグを追加
        player.addTag(`${this.scoreboardName}:${newRankName}`);
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

    /**
     * プレイヤーの順位を取得します。
     * @param {Player} player - 順位を取得するプレイヤー
     * @returns {number} プレイヤーの順位
     */
    getRanking(player: Player | ScoreboardIdentity): number {
        const objective = world.scoreboard.getObjective(this.scoreboardName);
        if (!objective) return 0;

        // 全ての参加者のスコアを取得し、降順にソート
        const scores = objective
            .getParticipants()
            .map((participant) => ({
                participant,
                score: objective.getScore(participant) || 0,
            }))
            .sort((a, b) => b.score - a.score);

        // プレイヤーの順位を見つける
        const playerName = player instanceof Player ? player.name : player.displayName;
        const playerRank = scores.findIndex((s) => s.participant.displayName === playerName) + 1;

        return playerRank;
    }

    /**
     * 上位 {count} 人のランキングを取得
     * @param {number} count 上位何人まで表示するか
     * @returns 上位 {count} 人のスコアボード情報。参加者名とスコアのオブジェクトの配列
     */
    getTopRanking(count: number): Participant[] {
        const objective = world.scoreboard.getObjective(this.scoreboardName);
        if (!objective) return [];
        return objective
            .getParticipants()
            .map((participant) => ({
                name: participant.displayName, // participantName から name に変更
                score: objective.getScore(participant) || 0,
                scoreboardIdentity: participant,
            }))
            .sort((a, b) => b.score - a.score)
            .slice(0, count);
    }

    /**
     * スコアボードに登録されている全ての参加者のリストを取得
     * @returns スコアボードに登録されている全ての参加者
     */
    getAllParticipants(): Participant[] {
        const objective = world.scoreboard.getObjective(this.scoreboardName);
        if (!objective) return [];
        return objective.getParticipants().map((participant) => ({
            name: participant.displayName, // participantName から name に変更
            score: objective.getScore(participant) || 0,
            scoreboardIdentity: participant,
        }));
    }

    /**
     * 登録されているすべてのランク名を取得します。
     * ランク名が登録されている順番で返します
     * @returns {string[]} ランク名の配列
     */
    getAllRankNames(): string[] {
        // スコアの昇順でランク名をソートして返す
        return Object.keys(this.rankThresholds).sort(
            (a, b) => this.rankThresholds[a] - this.rankThresholds[b],
        );
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
        //  console.warn(`スコアボード '${rankSystem.scoreboardName}' は既に存在しています。`);

        // 既存のスコアを持つプレイヤーにランクを割り当てる
        for (const participant of objective.getParticipants()) {
            const score = objective.getScore(participant);
            if (score !== undefined) {
                rankSystem.updatePlayerRank(participant, score);
                // プレイヤーがオンラインの場合は、メッセージを表示
                if (participant.type === ScoreboardIdentityType.Player) {
                    const player = world.getAllPlayers().find((p) => p.name === participant.displayName);
                    if (player) {
                        const rankName = rankSystem.getRankNameFromScore(score);
                        player.sendMessage(`${rankSystem.title} に参加しました。現在のランク: ${rankName}`);
                    }
                }
            }
        }
    } else {
        // console.warn(`スコアボード '${rankSystem.scoreboardName}' は新しく作成されました。`);
    }
}

/**
 * ランクシステムのUIを表示する関数
 * @param {Player} player - UIを表示するプレイヤー
 * @param {RankSystem} rankSystem - 対象のランクシステム
 */
async function showRankListUI(player: Player, rankSystem: RankSystem) {
    const form = new ActionFormData();
    form.title(rankSystem.title);
    form.body('ランクシステムの情報\nメインメニュー');
    form.button('ランク帯にいるプレイヤーを表示', 'textures/ui/FriendsDiversity');
    form.button('プレイヤーを検索', 'textures/ui/magnifying_glass');
    form.button(
        `トップランキング\nあなた現在の順位: ${rankSystem.getRanking(player)}位`,
        'textures/ui/icon_star',
    );

    // OPタグを持っているか確認
    if (player.hasTag('op')) {
        // 他のプレイヤーのランク変更ボタンを追加
        form.button('プレイヤーのランクを変更', 'textures/ui/refresh');
    }

    //@ts-ignore
    const response = await form.show(player);
    if (response.canceled) return;

    if (response.selection === 0) {
        await showRankTiersUI(player, rankSystem);
    } else if (response.selection === 1) {
        await showSearchPlayerUI(player, rankSystem);
    } else if (response.selection === 2) {
        await showTopRankingUI(player, rankSystem);
    } else if (player.hasTag('op') && response.selection === 3) {
        // OPタグを持っている場合のみ他のプレイヤーのランク変更
        await showChangeRankUI(player, rankSystem);
    }
}

// トップランキングを表示する関数
async function showTopRankingUI(player: Player, rankSystem: RankSystem) {
    const limit = 10;
    const onlineOnly = true;
    let topRanking = rankSystem.getTopRanking(limit);
    if (onlineOnly) {
        topRanking = topRanking.filter((entry) =>
            world.getAllPlayers().some((p) => p.name === entry.name),
        );
    }

    if (topRanking.length === 0) {
        if (onlineOnly) {
            player.sendMessage(`§c! ${rankSystem.title} に参加しているオンラインプレイヤーはいません`);
        } else {
            player.sendMessage(`§c! ${rankSystem.title} にはまだ参加者がいません。`);
        }
        return;
    }

    const form = new ActionFormData();
    form.title(`${rankSystem.title} のトップランキング`);
    form.body(`上位${limit}位 ${onlineOnly ? '(オンラインのみ)' : ''}`);

    const woolColors = [
        "white", "orange", "magenta", "light_blue",
        "yellow", "lime", "pink", "gray",
        "silver", "cyan" // Minecraftの羊毛の色IDリスト(10位まで)
    ];

    topRanking.forEach((entry, index) => {
        const rankColor = index === 0 ? '§6' : index === 1 ? '§7' : index === 2 ? '§e' : '§f';
        // 上位10位までは羊毛のアイコンを使用、それ以降はデフォルトのアイコン
        const iconPath = index < woolColors.length
            ? `textures/blocks/wool_colored_${woolColors[index]}`
            : 'textures/ui/FriendsDiversity';
        form.button(
            `${rankColor}${index + 1}位: ${entry.name}§r\nスコア: §e${entry.score}`,
            iconPath
        );
    });

    form.button('戻る', 'textures/ui/back_button_hover');
    //@ts-ignore

    const response = await form.show(player);
    if (response.canceled || response.selection === topRanking.length) {
        showRankListUI(player, rankSystem);
        return;
    }

    const selectedEntry =
        response.selection !== undefined ? topRanking[response.selection] : undefined;
    if (selectedEntry) {
        // selectedEntryを使用して直接ScoreboardIdentityを取得し、それをgetRankingに渡す
        const objective = world.scoreboard.getObjective(rankSystem.scoreboardName);
        const selectedParticipant = objective?.getParticipants().find(participant => participant.displayName === selectedEntry.name);

        if (selectedParticipant) {
            // 選択したプレイヤーのスコアとランクを取得する
            const selectedScore = rankSystem.getPlayerRankScore(selectedParticipant);
            const selectedRank = rankSystem.getRankNameFromScore(selectedScore);

            player.sendMessage(`§e§l== ${selectedEntry.name} のランク情報 ==\n§r§6${rankSystem.title}ランク: §a${selectedRank}\n§6現在のランクポイント: §a${selectedScore}\n§6順位: §a${rankSystem.getRanking(selectedParticipant)}位\n§r`);
            // プレイヤーの詳細情報UIを表示
            await showPlayerInfoUI(player, rankSystem, selectedParticipant);
        }
    }
}

// 他のプレイヤーのランクを変更するためのUIを表示する関数
async function showChangeRankUI(player: Player, rankSystem: RankSystem) {
    const form = new ActionFormData();
    form.title('プレイヤーのランク変更');
    form.body('ランクを変更したいプレイヤーを選択してください');
    form.button('ランクを上げる', 'textures/gui/controls/up.png');
    form.button('ランクを下げる', 'textures/gui/controls/down.png');
    form.button('戻る', 'textures/ui/back_button_hover');
    //@ts-ignore
    const response = await form.show(player);
    if (response.canceled) return;

    if (response.selection === 0) {
        await showIncreaseRankFormUI(player, rankSystem);
    } else if (response.selection === 1) {
        await showDecreaseRankFormUI(player, rankSystem);
    } else if (response.selection === 2) {
        showRankListUI(player, rankSystem);
    }
}

// ランクを上げるためのプレイヤー選択フォームを表示する関数
async function showIncreaseRankFormUI(player: Player, rankSystem: RankSystem) {
    const onlinePlayers = world.getAllPlayers();
    const form = new ModalFormData();
    form.title('ランクを上げる');
    form.dropdown(
        'プレイヤーを選択',
        onlinePlayers.map((p) => p.name),
    );
    form.slider('ランク数', 1, rankSystem.rankTiers.length - 1, 1, 1);

    //@ts-ignore
    const response = await form.show(player);
    if (response.canceled) return;

    if (!response.formValues || typeof response.formValues[0] !== 'number') return;
    const selectedPlayerName = onlinePlayers[response.formValues[0]]?.name;
    if (!selectedPlayerName) return;
    const selectedPlayer = world.getAllPlayers().find((p) => p.name === selectedPlayerName);
    const rankIncrease = response.formValues[1] as number;

    if (selectedPlayer) {
        const currentScore = rankSystem.getPlayerRankScore(selectedPlayer);
        const currentRankIndex = rankSystem.rankTiers.findIndex(
            (rank) => rankSystem.getRankNameFromScore(currentScore) === rank,
        );

        if (currentRankIndex + rankIncrease < rankSystem.rankTiers.length) {
            const targetRank = rankSystem.rankTiers[currentRankIndex + rankIncrease];
            rankSystem.updatePlayerRank(selectedPlayer, rankSystem.getRankScoreFromName(targetRank));
        } else {
            player.sendMessage(`§c! これ以上ランクを上げることはできません。`);
        }
    } else {
        player.sendMessage(`§c! プレイヤー ${selectedPlayerName} が見つかりません。`);
    }
}

// ランクを下げるためのプレイヤー選択フォームを表示する関数
async function showDecreaseRankFormUI(player: Player, rankSystem: RankSystem) {
    const onlinePlayers = world.getAllPlayers();
    const form = new ModalFormData();
    form.title('ランクを下げる');
    form.dropdown(
        'プレイヤーを選択',
        onlinePlayers.map((p) => p.name),
    );
    form.slider('ランク数', 1, rankSystem.rankTiers.length - 1, 1, 1);

    //@ts-ignore
    const response = await form.show(player);
    if (response.canceled) return;

    if (!response.formValues || typeof response.formValues[0] !== 'number') return;
    const selectedPlayerName = onlinePlayers[response.formValues[0]]?.name;
    if (!selectedPlayerName) return;
    const selectedPlayer = world.getAllPlayers().find((p) => p.name === selectedPlayerName);
    const rankDecrease = response.formValues[1] as number;

    if (selectedPlayer) {
        const currentScore = rankSystem.getPlayerRankScore(selectedPlayer);
        const currentRankIndex = rankSystem.rankTiers.findIndex(
            (rank) => rankSystem.getRankNameFromScore(currentScore) === rank,
        );

        if (currentRankIndex - rankDecrease >= 0) {
            const targetRank = rankSystem.rankTiers[currentRankIndex - rankDecrease];
            rankSystem.updatePlayerRank(selectedPlayer, rankSystem.getRankScoreFromName(targetRank));
        } else {
            player.sendMessage(`§c! これ以上ランクを下げることはできません。`);
        }
    } else {
        player.sendMessage(`§c! プレイヤー ${selectedPlayerName} が見つかりません。`);
    }
}

/**
 * ランク帯にいるプレイヤーを表示するUI
 * @param {Player} player - UIを表示するプレイヤー
 * @param {RankSystem} rankSystem - 対象のランクシステム
 */
async function showRankTiersUI(player: Player, rankSystem: RankSystem) {
    const form = new ActionFormData();
    form.title(`${rankSystem.title} のランク`);

    // 戻るボタンを追加
    form.button('戻る', 'textures/ui/back_button_hover');

    // 各ランクのボタンを追加
    rankSystem.rankTiers.forEach((rankTier) => {
        if (!rankTier) return;
        const sameRankPlayers = rankSystem.getAllParticipants().filter((participant) => {
            if (!participant.scoreboardIdentity) return false;
            const participantRankName = rankSystem.getRankNameFromScore(
                rankSystem.getPlayerRankScore(participant.scoreboardIdentity),
            );
            return participantRankName === rankTier;
        });
        const count = sameRankPlayers.length;
        form.button(`${rankTier} (${count}人)`, 'textures/ui/FriendsDiversity');
    });
    //@ts-ignore

    const response = await form.show(player);
    if (response.canceled || response.selection === undefined) return;

    if (response.selection === 0) {
        // 戻るボタンの処理
        showRankListUI(player, rankSystem);
        return;
    }

    const selectedRank = rankSystem.rankTiers[response.selection - 1]; // 戻るボタンの分を引く

    // 選択されたランク帯のプレイヤーを直接表示
    const sameRankPlayers = rankSystem.getAllParticipants().filter((participant) => {
        if (!participant.scoreboardIdentity) return false;
        const participantRankName = rankSystem.getRankNameFromScore(
            rankSystem.getPlayerRankScore(participant.scoreboardIdentity),
        );
        return participantRankName === selectedRank;
    });

    if (sameRankPlayers.length === 0) {
        player.sendMessage(`§c現在、${selectedRank} ランクのプレイヤーはいません。`);
        return;
    }

    sameRankPlayers.sort((a, b) => {
        if (!a.scoreboardIdentity || !b.scoreboardIdentity) return 0;
        return (
            rankSystem.getPlayerRankScore(b.scoreboardIdentity) -
            rankSystem.getPlayerRankScore(a.scoreboardIdentity)
        );
    });

    const form2 = new ActionFormData();
    form2.title(`${selectedRank} ランクのプレイヤー`);

    // 戻るボタンを追加
    form2.button('戻る', 'textures/ui/back_button_hover');

    // 各プレイヤーのボタンを追加 (ボタンは最大24個、かつスクロール対応)
    sameRankPlayers.slice(0, 24).forEach((participant) => {
        if (!participant.scoreboardIdentity) return;
        const displayName =
            participant.name === 'commands.scoreboard.players.offlinePlayerName'
                ? 'オフラインユーザー'
                : participant.name;
        const score = rankSystem.getPlayerRankScore(participant.scoreboardIdentity);
        form2.button(`${displayName}\nスコア: ${score}`, 'textures/ui/FriendsDiversity');
    });

    // 人数が多くて表示しきれない場合
    if (sameRankPlayers.length > 24) {
        player.sendMessage(`§c! 表示できるプレイヤー数の上限を超えました (上位24人のみ表示)`);
    }

    //@ts-ignore
    const response2 = await form2.show(player);
    if (response2.canceled) {
        showRankTiersUI(player, rankSystem);
        return;
    }

    if (response2.selection === 0) {
        // 戻るボタンの処理
        showRankTiersUI(player, rankSystem);
        return;
    }

    const selectedParticipant = response2.selection !== undefined ? sameRankPlayers[response2.selection - 1]?.scoreboardIdentity : undefined;
    if (selectedParticipant) {
        const displayName = selectedParticipant.displayName;
        const playerRank = rankSystem.getRanking(selectedParticipant);

        // 選択したプレイヤーのスコアとランクを取得する
        const selectedScore = rankSystem.getPlayerRankScore(selectedParticipant);
        const selectedRank = rankSystem.getRankNameFromScore(selectedScore);

        player.sendMessage(
            `§e§l== ${displayName} のランク情報 ==\n§r§6${rankSystem.title}ランク: §a${selectedRank}\n§6現在のランクポイント: §a${selectedScore}\n§6順位: §a${playerRank}位\n§r`,
        );

        // プレイヤーの詳細情報UIを表示
        await showPlayerInfoUI(player, rankSystem, selectedParticipant);
    }
}

/**
 * プレイヤーの詳細情報を表示するUI
 * @param {Player} player - UIを表示するプレイヤー
 * @param {RankSystem} rankSystem - 対象のランクシステム
 * @param {ScoreboardIdentity} participant - 対象のプレイヤー
 */
async function showPlayerInfoUI(
    player: Player,
    rankSystem: RankSystem,
    participant: ScoreboardIdentity,
) {
    const form = new ActionFormData();
    const displayName =
        participant.displayName === 'commands.scoreboard.players.offlinePlayerName'
            ? 'オフラインユーザー'
            : participant.displayName;
    const score = rankSystem.getPlayerRankScore(participant);
    const rank = rankSystem.getRankNameFromScore(score);

    form.title(`${displayName} の詳細情報`);
    form.body(`ランク: ${rank}\nスコア: ${score}\n順位: ${rankSystem.getRanking(participant)}位`);
    form.button('戻る', 'textures/ui/back_button_hover');
    //@ts-ignore

    const response = await form.show(player);
    if (response.canceled) return;

    if (response.selection === 0) {
        return; 
    }
}

/**
 * プレイヤーを検索するUI (推測機能付き、スコア指定検索追加)
 * @param {Player} player - UIを表示するプレイヤー
 * @param {RankSystem} rankSystem - 対象のランクシステム
 */
async function showSearchPlayerUI(player: Player, rankSystem: RankSystem) {
    const form = new ModalFormData();
    form.title(`${rankSystem.title} のプレイヤー検索`);
    form.textField('プレイヤー名を入力', 'プレイヤー名');
    form.textField('最低スコア (オプション)', '半角数字で入力');
    form.textField('最高スコア (オプション)', '半角数字で入力');

    //@ts-ignore
    const response = await form.show(player);
    if (response.canceled) {
        showRankListUI(player, rankSystem); // キャンセルされたら前の画面に戻る
        return;
    }

    const playerName = (response.formValues as string[])?.[0] ?? '';
    const minScore = parseInt((response.formValues as string[])?.[1]);
    const maxScore = parseInt((response.formValues as string[])?.[2]);

    // スコア範囲が指定されている場合、スコアでフィルタリング
    const objective = world.scoreboard.getObjective(rankSystem.scoreboardName);
    let filteredParticipants = objective?.getParticipants().filter((p) => {
        const score = rankSystem.getPlayerRankScore(p);
        return (isNaN(minScore) || score >= minScore) && (isNaN(maxScore) || score <= maxScore);
    });

    // プレイヤー名で検索 (部分一致)
    let foundParticipant = filteredParticipants?.find((p) =>
        p.displayName.toLowerCase().includes(playerName.toLowerCase()),
    );

    // 完全一致するプレイヤーが見つからなかった場合、推測を試みる
    if (!foundParticipant) {
        const suggestions = getPlayerNameSuggestions(playerName, rankSystem, 3, filteredParticipants); // 上位3件の推測を取得

        if (suggestions.length > 0) {
            const suggestionForm = new ActionFormData();
            suggestionForm.title(`${rankSystem.title} のプレイヤー検索`);
            suggestionForm.body(`もしかして: ${suggestions.join(', ')}?`);
            suggestions.forEach((suggestion) => {
                suggestionForm.button(suggestion);
            });
            suggestionForm.button('戻る', 'textures/ui/back_button_hover');
            //@ts-ignore
            const suggestionResponse = await suggestionForm.show(player);
            if (suggestionResponse.canceled) return;

            if (suggestionResponse.selection === suggestions.length) {
                // 戻るボタンの処理
                showSearchPlayerUI(player, rankSystem);
                return;
            }

            const selectedSuggestion = suggestions[suggestionResponse.selection as number];
            if (selectedSuggestion) {
                foundParticipant = objective
                    ?.getParticipants()
                    .find((p) => p.displayName === selectedSuggestion);
            }
        }
    }

    // 最終的にプレイヤーが見つかったかどうかを判定
    if (foundParticipant) {
        const displayName =
            foundParticipant.displayName === 'commands.scoreboard.players.offlinePlayerName'
                ? 'オフラインユーザー'
                : foundParticipant.displayName;
        const score = rankSystem.getPlayerRankScore(foundParticipant);
        const rank = rankSystem.getRankNameFromScore(score);
        const playerRank = rankSystem.getRanking(foundParticipant);

        player.sendMessage(
            `§e§l== ${displayName} のランク情報 ==\n§r§6${rankSystem.title}ランク: §a${rank}\n§6現在のランクポイント: §a${score}\n§6順位: §a${playerRank}位\n§r`,
        );
        // プレイヤーの詳細情報UIを表示
        await showPlayerInfoUI(player, rankSystem, foundParticipant);
    } else {
        player.sendMessage(
            `§c! ${playerName} は ${rankSystem.title} に参加していないか、指定されたスコア範囲にいません。`,
        );
    }
}

/**
 * プレイヤー名の推測を取得する関数 (レーベンシュタイン距離の手動計算版、検索対象オプション追加)
 * @param {string} inputName - 入力されたプレイヤー名
 * @param {RankSystem} rankSystem - 対象のランクシステム
 * @param {number} limit - 取得する推測の数
 * @param {ScoreboardIdentity[]} participants - 検索対象のプレイヤーリスト (オプション)
 * @returns {string[]} 推測されたプレイヤー名の配列
 */
function getPlayerNameSuggestions(
    inputName: string,
    rankSystem: RankSystem,
    limit: number,
    participants?: ScoreboardIdentity[],
): string[] {
    const objective = world.scoreboard.getObjective(rankSystem.scoreboardName);
    if (!objective) return [];

    // 検索対象が指定されていない場合は、すべての参加者を対象にする
    if (!participants) {
        participants = objective.getParticipants();
    }

    const distances = participants.map((p) => ({
        name: p.displayName,
        distance: calculateLevenshteinDistance(inputName.toLowerCase(), p.displayName.toLowerCase()),
    }));

    distances.sort((a, b) => a.distance - b.distance);

    return distances.slice(0, limit).map((d) => d.name);
}

/**
 * 二つの文字列間のレーベンシュタイン距離を計算する関数 (手動実装)
 * @param {string} str1 - 一つ目の文字列
 * @param {string} str2 - 二つ目の文字列
 * @returns {number} レーベンシュタイン距離
 */
function calculateLevenshteinDistance(str1: string, str2: string): number {
    const m = str1.length;
    const n = str2.length;

    // 二次元配列を初期化 (m+1 x n+1)
    const dp: number[][] = [];
    for (let i = 0; i <= m; i++) {
        dp[i] = [i];
    }
    for (let j = 0; j <= n; j++) {
        dp[0][j] = j;
    }

    // 動的計画法でレーベンシュタイン距離を計算
    for (let i = 1; i <= m; i++) {
        for (let j = 1; j <= n; j++) {
            if (str1[i - 1] === str2[j - 1]) {
                dp[i][j] = dp[i - 1][j - 1];
            } else {
                dp[i][j] = Math.min(
                    dp[i - 1][j] + 1, // 削除
                    dp[i][j - 1] + 1, // 挿入
                    dp[i - 1][j - 1] + 1, // 置換
                );
            }
        }
    }

    return dp[m][n];
}

/**
 * ランクシステムへのコマンドを処理します。
 * @param {any} event - スクリプトイベント
 */
export function handleRankCommand(event: ScriptEventCommandMessageAfterEvent) {
    const args = event.message.replace(/^\/(ch:rank|ch:registerRank)\s+/, '').split(/\s+/);
    const command = event.id;
    const initiator = event.sourceEntity as Player;

    if (command === 'ch:registerRank') {
        // registerRankコマンドの処理
        if (args.length < 4) {
            initiator.sendMessage(
                '使用方法: registerRank <タイトル> <スコアボード名> <ランク名1,ランク名2,...> <閾値1,閾値2,...>',
            );
            return;
        }

        const title = args[0];
        const scoreboardName = args[1];
        const rankTiers = args[2].split(',');
        const rankThresholds = args[3].split(',').map(Number);

        try {
            const newRank = new RankSystem(title, scoreboardName, rankTiers, rankThresholds);
            registerRank(newRank);
            initiator.sendMessage(`新しいランクシステム '${title}' を登録しました。`);
        } catch (error) {
            const errorMessage = (error as Error).message;
            initiator.sendMessage(`エラー: ${errorMessage}`);
        }
    } else if (command === 'ch:rank') {
        // ch:rankコマンドの処理
        if (args.length < 2) {
            initiator.sendMessage('使用方法: ch:rank <システム名> <join|reset|add|remove|list>');
            return;
        }

        const rankSystemName = args[0];
        const rankSystem = registeredRanks.find((rank) => rank.scoreboardName === rankSystemName);

        if (!rankSystem) {
            initiator.sendMessage(`ランクシステム '${rankSystemName}' は見つかりません。`);
            return;
        }

        // コマンド処理
        if (args[1] === 'join' && initiator) {
            rankSystem.addPlayerToRank(initiator);
        } else if (args[1] === 'reset') {
            if (args.length < 3) {
                initiator.sendMessage(`使用方法: /ch:rank ${rankSystemName} reset <プレイヤー名> or <all>`);
                return;
            }
            if (args[2] === 'all') {
                rankSystem.resetAllPlayersRank();
            } else {
                const targetPlayerName = args[2];
                const targetPlayer = world.getAllPlayers().find((p) => p.name === targetPlayerName);

                // セレクターの処理を追加
                const targetParticipants: (Player | string | ScoreboardIdentity)[] = [];
                if (targetPlayerName.startsWith('@')) {
                    const matchingPlayers = world.getPlayers({ name: targetPlayerName });
                    if (matchingPlayers.length > 0) {
                        targetParticipants.push(...matchingPlayers);
                    } else {
                        // セレクターに一致するプレイヤーがいない場合、スコアボードIDとして扱う
                        const objective = world.scoreboard.getObjective(rankSystem.scoreboardName);
                        const participant = objective
                            ?.getParticipants()
                            .find((p) => p.displayName === targetPlayerName);
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
                        const participant = objective
                            ?.getParticipants()
                            .find((p) => p.displayName === targetPlayerName);
                        if (participant) {
                            targetParticipants.push(participant);
                        } else {
                            targetParticipants.push(targetPlayerName);
                        }
                    }
                }

                if (targetParticipants.length === 0) {
                    initiator.sendMessage(
                        `プレイヤーまたはスコアボードID '${targetPlayerName}' が見つかりません。`,
                    );
                    return;
                }

                for (const targetParticipant of targetParticipants) {
                    rankSystem.resetPlayerRank(targetParticipant);
                }
            }
        } else if (args[1] === 'add' || args[1] === 'remove') {
            if (args.length < 4) {
                initiator.sendMessage(`使用方法: ch:rank ${rankSystemName} ${args[1]} <プレイヤー名> <値>`);
                return;
            }

            const targetPlayerName = args[2];
            const targetPlayer = world.getAllPlayers().find((p) => p.name === targetPlayerName);

            // セレクターの処理を追加
            const targetParticipants: (Player | string | ScoreboardIdentity)[] = [];
            if (targetPlayerName.startsWith('@')) {
                const matchingPlayers = world.getPlayers({ name: targetPlayerName });
                if (matchingPlayers.length > 0) {
                    targetParticipants.push(...matchingPlayers);
                } else {
                    // セレクターに一致するプレイヤーがいない場合、スコアボードIDとして扱う
                    const objective = world.scoreboard.getObjective(rankSystem.scoreboardName);
                    const participant = objective
                        ?.getParticipants()
                        .find((p) => p.displayName === targetPlayerName);
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
                    const participant = objective
                        ?.getParticipants()
                        .find((p) => p.displayName === targetPlayerName);
                    if (participant) {
                        targetParticipants.push(participant);
                    } else {
                        targetParticipants.push(targetPlayerName);
                    }
                }
            }

            if (targetParticipants.length === 0) {
                initiator.sendMessage(
                    `プレイヤーまたはスコアボードID '${targetPlayerName}' が見つかりません。`,
                );
                return;
            }

            const scoreChange = parseInt(args[3]);
            if (isNaN(scoreChange)) {
                initiator.sendMessage('値は数値を指定してください。');
                return;
            }

            for (const targetParticipant of targetParticipants) {
                const currentScore = rankSystem.getPlayerRankScore(targetParticipant);
                let newScore = args[1] === 'add' ? currentScore + scoreChange : currentScore - scoreChange;
                rankSystem.updatePlayerRank(targetParticipant, newScore);
            }
        } else if (args[1] === 'list') {
            if (!initiator) return;
            // 引数が "ui" の場合、UIを表示
            if (args[2] === 'ui') {
                showRankListUI(initiator, rankSystem);
                return;
            }
            const rankScore = rankSystem.getPlayerRankScore(initiator);
            const currentRank = rankSystem.getRankNameFromScore(rankScore);
            const playerRank = rankSystem.getRanking(initiator);
            initiator.sendMessage(
                `§e§l== あなたのランク情報 ==\n§r§6${rankSystem.title}ランク: §a${currentRank}\n§6現在のランクポイント: §a${rankScore}\n§6順位: §a${playerRank}位\n§r`,
            );

            if (args[2] === 'rank') {
                // 表示するランキングの件数を取得 (デフォルトは10)
                const limit = parseInt(args[3]) || 10;
                // オンラインプレイヤーのみを表示するかどうか (デフォルトはfalse)
                const onlineOnly = args[4] === 'true';

                // 上位 limit 人のランキングを表示
                let topRanking = rankSystem.getTopRanking(limit);

                // オンラインプレイヤーのみを表示する場合、フィルタリング処理を追加
                if (onlineOnly) {
                    topRanking = topRanking.filter(
                        (entry) => entry.name !== 'commands.scoreboard.players.offlinePlayerName',
                    );
                }

                if (topRanking.length === 0) {
                    if (onlineOnly) {
                        initiator.sendMessage(
                            `§c${rankSystem.title} に参加しているオンラインプレイヤーはいません`,
                        );
                    } else {
                        initiator.sendMessage(`§c${rankSystem.title} にはまだ参加者がいません。`);
                    }
                    return;
                }

                // リストの先頭にシステム名と件数を追加 (オンラインのみかどうかも表示)
                const rankTitle = `§b§l[${rankSystem.title} ランキング Top ${limit}${onlineOnly ? ' (オンラインのみ)' : ''}]`;

                // ランキングリストをメッセージに追加 (装飾と名前の置換を施す)
                const rankingMessages = [
                    rankTitle,
                    ...topRanking.map((entry, index) => {
                        const rankColor =
                            index === 0
                                ? '§6§l' // 1位は金色
                                : index === 1
                                    ? '§7§l' // 2位は銀色
                                    : index === 2
                                        ? '§e' // 3位は銅色
                                        : '§f'; // それ以外は白色

                        // 名前の置換処理
                        const displayName =
                            entry.name === 'commands.scoreboard.players.offlinePlayerName'
                                ? 'オフラインユーザー'
                                : entry.name;

                        return `§b${index + 1}位: ${rankColor}${displayName} §r§7- §e${entry.score}`;
                    }),
                ];

                // 一度に送信できるメッセージ数に分割
                for (let i = 0; i < rankingMessages.length; i += 9) {
                    const chunk = rankingMessages.slice(i, i + 9).join('\n');
                    initiator.sendMessage(chunk);
                }
            } else if (args[2] === 'check') {
                // プレイヤーの現在のランクを取得
                const playerRankName = rankSystem.getRankNameFromScore(
                    rankSystem.getPlayerRankScore(initiator),
                );

                // 同じランクのプレイヤーを取得
                const sameRankPlayers = rankSystem.getAllParticipants().filter((participant) => {
                    // 修正: participant.scoreboardIdentity が undefined の場合は false を返す
                    if (!participant.scoreboardIdentity) return false;
                    const participantRankName = rankSystem.getRankNameFromScore(
                        rankSystem.getPlayerRankScore(participant.scoreboardIdentity),
                    );
                    return participantRankName === playerRankName;
                });

                // 同じランクのプレイヤーがいない場合
                if (sameRankPlayers.length === 0) {
                    initiator.sendMessage(`§c現在、${playerRankName} ランクのプレイヤーはいません。`);
                    return;
                }

                // 同じランクのプレイヤーをランクスコアでソート
                sameRankPlayers.sort((a, b) => {
                    // 修正: undefined チェックを追加
                    if (!a.scoreboardIdentity || !b.scoreboardIdentity) return 0;
                    return (
                        rankSystem.getPlayerRankScore(b.scoreboardIdentity) -
                        rankSystem.getPlayerRankScore(a.scoreboardIdentity)
                    );
                });

                // 表示する件数を取得 (デフォルトは sameRankPlayers.length、つまり全員)
                const limit = parseInt(args[3]) || sameRankPlayers.length;

                // メッセージを作成
                const rankCheckMessages = [
                    `§b§l[${rankSystem.title} ${playerRankName} ランクのプレイヤー一覧 (上位 ${limit}人)]`,
                    ...sameRankPlayers.slice(0, limit).map((entry, index) => {
                        // 修正: undefined チェックを追加
                        if (!entry.scoreboardIdentity) return '';
                        const displayName =
                            entry.name === 'commands.scoreboard.players.offlinePlayerName'
                                ? 'オフラインユーザー'
                                : entry.name;
                        const isInitiator = entry.name === initiator.name;
                        return `${isInitiator ? '>>' : ''}§b${index + 1}位: §f${displayName} §r§7- §e${rankSystem.getPlayerRankScore(entry.scoreboardIdentity)}`;
                    }),
                ];

                // 一度に送信できるメッセージ数に分割
                for (let i = 0; i < rankCheckMessages.length; i += 9) {
                    const chunk = rankCheckMessages.slice(i, i + 9).join('\n');
                    initiator.sendMessage(chunk);
                }
            } else if (args[2] === 'all') {
                // 全てのランク名を取得
                const allRankNames = rankSystem.getAllRankNames();

                // プレイヤーの現在のランク名を取得
                const playerRankName = rankSystem.getRankNameFromScore(
                    rankSystem.getPlayerRankScore(initiator),
                );

                // ランクの表示順序を決定 (デフォルトは昇順)
                const sortOrder = args[3] === 'true' ? 'desc' : 'asc';

                // メッセージを作成
                const rankAllMessages = [
                    `§b§l[${rankSystem.title} 全ランク一覧 (${sortOrder === 'asc' ? '昇順' : '降順'})]`,
                    ...(sortOrder === 'asc' ? allRankNames : allRankNames.slice().reverse()).map(
                        (rankName) => {
                            // 昇順か降順かに応じて allRankNames をソート
                            const isPlayerRank = rankName === playerRankName;
                            // ランク内の人数を取得
                            const count = rankSystem.getAllParticipants().filter((participant) => {
                                if (!participant.scoreboardIdentity) return false;
                                return (
                                    rankSystem.getRankNameFromScore(
                                        rankSystem.getPlayerRankScore(participant.scoreboardIdentity),
                                    ) === rankName
                                );
                            }).length;
                            return `${isPlayerRank ? '>>' : ''}§b${rankName} §r§7(${count}人)`;
                        },
                    ),
                ];

                // メッセージを送信
                initiator.sendMessage(rankAllMessages.join('\n'));
            } else if (args[2] === 'show') {
                // プレイヤーが見ているエンティティを取得
                const viewDirectionEntities = initiator.getEntitiesFromViewDirection();

                // 見ている先にエンティティがいない場合、またはプレイヤーではない場合
                if (
                    !viewDirectionEntities ||
                    viewDirectionEntities.length === 0 ||
                    !viewDirectionEntities[0].entity
                ) {
                    initiator.sendMessage(`§c見ている先にプレイヤーがいません。`);
                    return;
                }

                const targetEntityRaycastHit: EntityRaycastHit = viewDirectionEntities[0];

                const targetEntity: Entity = targetEntityRaycastHit.entity;
                //もしターゲットしているのがプレイヤーじゃなかった場合
                if (targetEntity.typeId !== 'minecraft:player') {
                    initiator.sendMessage(`§c見ている先にプレイヤーがいません。`);
                    return;
                }
                // ターゲットがプレイヤーでない場合はエラーを返す(型を絞る)
                if (!(targetEntity instanceof Player)) {
                    throw new Error('Invalid target type.');
                }

                // ターゲットプレイヤーの情報を取得
                const targetScore = rankSystem.getPlayerRankScore(targetEntity);
                const targetRank = rankSystem.getRankNameFromScore(targetScore);
                const targetPlayerRank = rankSystem.getRanking(targetEntity);

                // メッセージを作成
                const rankShowMessage = `§e§l== ${targetEntity.name} のランク情報 ==\n§r§6${rankSystem.title}ランク: §a${targetRank}\n§6現在のランクポイント: §a${targetScore}\n§6順位: §a${targetPlayerRank}位\n§r`;

                // メッセージを送信
                initiator.sendMessage(rankShowMessage);
            }

            // 全参加者数表示 (装飾)
            const participantsCount = rankSystem.getAllParticipants().length;
            initiator.sendMessage(`§9現在の参加者数: §a${participantsCount}人§r`);
        }
    }
}

// タグとスコアの監視とランクの更新
system.runInterval(() => {
    for (const rankSystem of registeredRanks) {
        const objective = world.scoreboard.getObjective(rankSystem.scoreboardName);
        if (objective) {
            // スコアの変更をチェック
            for (const participant of objective.getParticipants()) {
                const currentScore = objective.getScore(participant);

                if (currentScore !== undefined) {
                    const participantName = participant.displayName;
                    const lastKnownScore = rankSystem.getLastKnownScore(participantName);

                    if (currentScore !== lastKnownScore) {
                        // system.runIntervalから呼ばれたことを明示
                        rankSystem.updatePlayerRank(participant, currentScore, true);
                        rankSystem.updateLastKnownScore(participantName, currentScore);
                    }
                }
            }

            // プレイヤーのタグをチェックして修正
            for (const player of world.getAllPlayers()) {
                const playerScore = rankSystem.getPlayerRankScore(player);
                const correctRankName = rankSystem.getRankNameFromScore(playerScore);
                const oldRankName =
                    player
                        .getTags()
                        .find((tag) => tag.startsWith(`${rankSystem.scoreboardName}:`))
                        ?.split(':')[1] || '不明';

                // 正しいランクのタグを持っているか確認
                const hasCorrectRankTag = player
                    .getTags()
                    .some((tag) => tag === `${rankSystem.scoreboardName}:${correctRankName}`);

                if (!hasCorrectRankTag) {
                    // 間違ったタグを削除
                    player
                        .getTags()
                        .filter((tag) => tag.startsWith(`${rankSystem.scoreboardName}:`))
                        .forEach((tag) => player.removeTag(tag));
                    // 正しいタグを追加
                    player.addTag(`${rankSystem.scoreboardName}:${correctRankName}`);
                    player.sendMessage(
                        `${rankSystem.title}のランクが ${oldRankName} から ${correctRankName} に変更されました！`,
                    );
                }
            }
        }
    }
}, 20);

world.afterEvents.playerSpawn.subscribe((event) => {
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
                    player
                        .getTags()
                        .filter((tag) => tag.startsWith(`${rankSystem.scoreboardName}:`))
                        .forEach((tag) => player.removeTag(tag));
                    // 新しいランクタグを追加
                    player.addTag(`${rankSystem.scoreboardName}:${rankName}`);
                }
            }
        }
    }
});
