import { Player, ScoreboardObjective, system, world, ScriptEventCommandMessageAfterEvent } from '@minecraft/server';
import { ActionFormData } from '@minecraft/server-ui';
import { RankSystem } from './rankSystem';



// Rank マッチングシステム 兼 通常マッチングシステム 

export interface MatchingOptions {
    maxPlayersPerMatch: number;
    matchingInterval: number;
    rankSystem?: RankSystem;
    rankRange?: number;
    allowCrossRankMatching?: boolean;
    minPlayersToStart: number;
    countdownDuration: number;
    rankMatchSettings?: RankMatchSettings;
}

interface RankGroup {
    name: string;
    startRank: string;
    endRank: string;
}

interface RankMatchSettings {
    enabled: boolean;
    rankGroups: RankGroup[];
}

interface Match {
    id: string;
    players: Player[];
    rank?: string;
    startedAt: number;
    countdownStartedAt?: number;
}

export class MatchingSystem {
    private title: string;
    private matchingOptions: MatchingOptions;
    private waitingPlayers: Player[] = [];
    private matches: { [matchId: string]: Match } = {};
    private lastMatchAttempt: number = 0;
    private matchDataObjective: ScoreboardObjective;

    constructor(title: string, options: MatchingOptions) {
        this.title = title;
        this.matchingOptions = options;
        if (this.matchingOptions.minPlayersToStart > this.matchingOptions.maxPlayersPerMatch) {
            throw new Error("minPlayersToStart cannot be greater than maxPlayersPerMatch");
        }

        this.matchDataObjective = world.scoreboard.getObjective('ch:MatchData') ?? world.scoreboard.addObjective('ch:MatchData', 'Match Data');
        this.matchDataObjective.setScore('isStartMatch', 0);
        this.matchingOptions.rankMatchSettings = options.rankMatchSettings ?? {
            enabled: false,
            rankGroups: [],
        };

        system.runInterval(() => {
            this.matchPlayers();
        }, this.matchingOptions.matchingInterval);
    }

    joinMatchmaking(player: Player) {
        if (this.isPlayerInMatch(player)) {
            player.sendMessage(`§c! すでにマッチに参加しています。`);
            return;
        }

        if (this.isPlayerWaiting(player)) {
            player.sendMessage(`§c! すでにマッチング待機中です。`);
            return;
        }

        this.waitingPlayers.push(player);
        this.updatePlayerMatchData(player, 1);
        player.sendMessage(`§a${this.title} のマッチング待機に追加されました。`);
        this.broadcastWaitingStatus();
        this.showWaitingStatus(player);
    }

    leaveMatchmaking(player: Player) {
        const index = this.waitingPlayers.indexOf(player);
        if (index > -1) {
            this.waitingPlayers.splice(index, 1);
            this.updatePlayerMatchData(player, 0);
            player.sendMessage(`§a${this.title} のマッチング待機から削除されました。`);
            this.broadcastWaitingStatus();
        } else {
            player.sendMessage(`§c! マッチング待機中ではありません。`);
        }
    }

    isPlayerWaiting(player: Player): boolean {
        return this.waitingPlayers.includes(player);
    }

    isPlayerInMatch(player: Player): boolean {
        return Object.values(this.matches).some(match => match.players.includes(player));
    }

    private matchPlayers() {
        const currentTime = system.currentTick;
        if (currentTime - this.lastMatchAttempt < this.matchingOptions.matchingInterval) {
            return;
        }
        this.lastMatchAttempt = currentTime;

        if (this.matchingOptions.rankSystem && this.matchingOptions.rankMatchSettings?.enabled) {
            this.matchPlayersByRank();
        } else {
            this.matchPlayersRandomly();
        }

        this.checkCountdown();
    }

    private matchPlayersByRank() {
        const rankSystem = this.matchingOptions.rankSystem;
        if (!rankSystem) return;

        const playersByGroup: { [groupName: string]: Player[] } = {};

        for (const player of this.waitingPlayers) {
            const rankScore = rankSystem.getPlayerRankScore(player);

            let playerGroup: RankGroup | undefined;
            if (this.matchingOptions.rankMatchSettings) {
                for (const group of this.matchingOptions.rankMatchSettings.rankGroups) {
                    const startRankScore = rankSystem.getRankScoreFromName(group.startRank);
                    const endRankScore = rankSystem.getRankScoreFromName(group.endRank);
                    if (rankScore >= startRankScore && rankScore <= endRankScore) {
                        playerGroup = group;
                        break;
                    }
                }
            }

            if (playerGroup) {
                if (!playersByGroup[playerGroup.name]) {
                    playersByGroup[playerGroup.name] = [];
                }
                playersByGroup[playerGroup.name].push(player);
            } else {
                console.warn(`Player ${player.name} does not belong to any rank group.`);
            }
        }

        for (const groupName in playersByGroup) {
            const playersInGroup = playersByGroup[groupName];
            while (playersInGroup.length >= this.matchingOptions.maxPlayersPerMatch) {
                const matchedPlayers = playersInGroup.splice(0, this.matchingOptions.maxPlayersPerMatch);
                this.startMatch(matchedPlayers);
            }
        }

        this.waitingPlayers = Object.values(playersByGroup).flat();
    }


    private matchPlayersRandomly() {
        while (this.waitingPlayers.length >= this.matchingOptions.maxPlayersPerMatch) {
            const matchedPlayers = this.waitingPlayers.splice(
                0,
                this.matchingOptions.maxPlayersPerMatch,
            );
            this.startMatch(matchedPlayers);
        }
    }

    private checkCountdown() {
        for (const matchId in this.matches) {
            const match = this.matches[matchId];
            if (match.players.length >= this.matchingOptions.minPlayersToStart && !match.countdownStartedAt) {
                match.countdownStartedAt = system.currentTick;
                this.matchDataObjective.setScore('isStartMatch', 1);
                for (const player of match.players) {
                    player.sendMessage(`§e>> ${this.title} のマッチ開始まで ${this.matchingOptions.countdownDuration} 秒！`);
                    this.matchDataObjective.setScore(`${player.name}:player`, 0);
                }
            } else if (match.countdownStartedAt) {
                const elapsedTicks = system.currentTick - match.countdownStartedAt;
                const remainingSeconds = Math.ceil((this.matchingOptions.countdownDuration * 20 - elapsedTicks) / 20);

                if (remainingSeconds <= 0) {
                    this.startMatchCommands(matchId);
                    this.endMatch(matchId);
                } else if (remainingSeconds <= 5) {
                    for (const player of match.players) {
                        player.sendMessage(`§e>> ${this.title} のマッチ開始まで ${remainingSeconds} 秒！`);
                    }
                }
            }
        }
    }

    private startMatchCommands(matchId: string) {
        const match = this.matches[matchId];
        if (!match) return;

        // Debug Log

        for (const player of match.players) {
            player.sendMessage("Done Match...")
        }
        console.warn(`[${this.title}] Match ${matchId} started. Executing commands...`);
    }

    private startMatch(players: Player[], rank?: string) {
        const matchId = this.generateMatchId();
        const match: Match = {
            id: matchId,
            players: players,
            rank: rank,
            startedAt: system.currentTick,
            countdownStartedAt: undefined,
        };
        this.matches[matchId] = match;

        for (const player of players) {
            player.sendMessage(`§e>> ${this.title} のマッチングが成立しました！ (マッチID: ${matchId})`);
            player.sendMessage(`§b[参加プレイヤー]: ${players.map((p) => p.name).join(', ')}`);

            this.updatePlayerMatchData(player, 0, matchId);
        }

        this.waitingPlayers = this.waitingPlayers.filter((p) => !players.includes(p));
    }

    endMatch(matchId: string) {
        const match = this.matches[matchId];
        if (match) {
            for (const player of match.players) {
                this.updatePlayerMatchData(player, 0);
                player.sendMessage(`§e>> ${this.title} のマッチ (マッチID: ${matchId}) が終了しました。`);
            }
            delete this.matches[matchId];

            system.runTimeout(() => {
                this.resetMatchData();
            }, 60);
        }
    }

    private resetMatchData() {
        this.matchDataObjective.setScore('isStartMatch', 0);
        for (const participant of this.matchDataObjective.getParticipants()) {
            if (participant.displayName.endsWith(":player")) {
                this.matchDataObjective.removeParticipant(participant);
            }
        }
        console.warn(`[${this.title}] Match data reset.`);
    }

    private generateMatchId(): string {
        return 'match_' + Math.random().toString(36).substr(2, 9);
    }

    public async showWaitingStatus(player: Player) {
        const waitingPlayersNames = this.waitingPlayers.map((p) => p.name).join(", ");
        const bodyMessage = waitingPlayersNames
            ? `現在の待機人数: ${this.waitingPlayers.length}人\n待機中のプレイヤー: ${waitingPlayersNames}`
            : `現在の待機人数: ${this.waitingPlayers.length}人`;

        const form = new ActionFormData()
            .title(`${this.title} の待機状況`)
            .body(bodyMessage)
            .button('待機を解除');

        //@ts-ignore
        const response = await form.show(player);
        if (response.canceled) {
            if (this.isPlayerWaiting(player)) {
                this.leaveMatchmaking(player);
            }
        } else {
            this.leaveMatchmaking(player);
        }
    }

    private updatePlayerMatchData(player: Player, waitingStatus: number, matchId?: string) {
        const playerName = player.name;

        this.matchDataObjective.setScore(`${playerName}:waiting`, waitingStatus);

        if (matchId) {
            this.matchDataObjective.setScore(`${playerName}:matchId`, parseInt(matchId.replace(/\D/g, ''), 10));
        } else {
            this.matchDataObjective.removeParticipant(`${playerName}:matchId`);
        }
    }

    forceEndMatch(matchId: string, executor?: Player) {
        if (this.matches[matchId]) {
            this.endMatch(matchId);
            if (executor) {
                executor.sendMessage(`§aマッチ (ID: ${matchId}) を強制終了しました。`);
            }
        } else {
            if (executor) {
                executor.sendMessage(`§cマッチ (ID: ${matchId}) が見つかりません。`);
            }
        }
    }

    getPlayerMatchInfo(player: Player): Match | undefined {
        return Object.values(this.matches).find(match => match.players.includes(player));
    }

    private broadcastWaitingStatus() {
        const waitingCount = this.waitingPlayers.length;
        const maxPlayers = this.matchingOptions.maxPlayersPerMatch;
        const message = `[${this.title}] ${waitingCount}/${maxPlayers}`;

        for (const player of world.getAllPlayers()) {
            player.onScreenDisplay.setActionBar(message);
        }
    }

    handleCommand(event: ScriptEventCommandMessageAfterEvent) {
        const player = event.sourceEntity as Player;

        if (!player) return;

        const args = event.message.split(/\s+/);
        const command = args[0].toLowerCase();

        if (command === 'join') {
            if (args.length < 2) {
                player.sendMessage("使用方法: join <マッチタイプ>");
                return;
            }
            const matchType = args[1].toLowerCase();
            if (matchType === this.title.toLowerCase()) {
                this.joinMatchmaking(player);
            } else {
                player.sendMessage(`不明なマッチタイプ: ${matchType}`);
            }
        } else if (command === 'leave') {
            if (args.length < 2) {
                player.sendMessage("使用方法: leave <マッチタイプ>");
                return;
            }
            const matchType = args[1].toLowerCase();
            if (matchType === this.title.toLowerCase()) {
                this.leaveMatchmaking(player);
            } else {
                player.sendMessage(`不明なマッチタイプ: ${matchType}`);
            }
        } else if (command === 'status') {
            if (args.length < 2) {
                player.sendMessage("使用方法: status <マッチタイプ>");
                return;
            }
            const matchType = args[1].toLowerCase();
            if (matchType === this.title.toLowerCase()) {
                this.showWaitingStatus(player);
            } else {
                player.sendMessage(`不明なマッチタイプ: ${matchType}`);
            }
        } else if (command === 'endmatch') {
            if (args.length < 3) {
                player.sendMessage("使用方法: endmatch <マッチタイプ> <マッチID>");
                return;
            }
            const matchType = args[1].toLowerCase();
            const matchId = args[2];
            if (matchType === this.title.toLowerCase()) {
                this.forceEndMatch(matchId, player);
            } else {
                player.sendMessage(`不明なマッチタイプ: ${matchType}`);
            }
        } else if (command === 'matchinfo') {
            if (args.length < 2) {
                player.sendMessage("使用方法: matchinfo <マッチタイプ>");
                return;
            }
            const matchType = args[1].toLowerCase();
            if (matchType === this.title.toLowerCase()) {
                this.getPlayerMatchInfo(player);
            } else {
                player.sendMessage(`不明なマッチタイプ: ${matchType}`);
            }
        } else if (command === 'rankmatch') {
            if (args.length < 3) {
                player.sendMessage("使用方法: rankmatch <マッチタイプ> <enable|disable|addgroup|removegroup|listgroups|setgroup>");
                return;
            }

            const matchType = args[1].toLowerCase();
            const subcommand = args[2].toLowerCase();

            // rankMatchSettings が存在しない場合はエラー
            if (!this.matchingOptions.rankMatchSettings) {
                player.sendMessage("エラー: ランクマッチ設定が初期化されていません。");
                return;
            }

            if (matchType !== this.title.toLowerCase()) {
                player.sendMessage(`不明なマッチタイプ: ${matchType}`);
                return;
            }

            if (subcommand === 'enable') {
                this.matchingOptions.rankMatchSettings.enabled = true;
                player.sendMessage(`${this.title} のランクマッチを有効にしました。`);
            } else if (subcommand === 'disable') {
                this.matchingOptions.rankMatchSettings.enabled = false;
                player.sendMessage(`${this.title} のランクマッチを無効にしました。`);
            } else if (subcommand === 'addgroup') {
                if (args.length < 6) {
                    player.sendMessage("使用方法: rankmatch <マッチタイプ> addgroup <グループ名> <開始ランク> <終了ランク>");
                    return;
                }

                const groupName = args[3];
                const startRank = args[4];
                const endRank = args[5];


                if (!this.matchingOptions.rankSystem ||
                    !this.matchingOptions.rankSystem.rankTiers.includes(startRank) ||
                    !this.matchingOptions.rankSystem.rankTiers.includes(endRank)) {
                    player.sendMessage(`不明なランク: ${startRank} または ${endRank}`);
                    return;
                }

                if (this.matchingOptions.rankMatchSettings.rankGroups.some(group => group.name === groupName)) {
                    player.sendMessage(`グループ名 '${groupName}' は既に使用されています。`);
                    return;
                }

                this.matchingOptions.rankMatchSettings.rankGroups.push({ name: groupName, startRank, endRank });
                player.sendMessage(`${this.title} にランクグループ '${groupName}' (${startRank} - ${endRank}) を追加しました。`);
            } else if (subcommand === 'removegroup') {
                if (args.length < 4) {
                    player.sendMessage("使用方法: /rankmatch <マッチタイプ> removegroup <グループ名>");
                    return;
                }

                const groupName = args[3];

                const groupIndex = this.matchingOptions.rankMatchSettings.rankGroups.findIndex(group => group.name === groupName);
                if (groupIndex === -1) {
                    player.sendMessage(`グループ名 '${groupName}' が見つかりません。`);
                    return;
                }

                this.matchingOptions.rankMatchSettings.rankGroups.splice(groupIndex, 1);
                player.sendMessage(`${this.title} からランクグループ '${groupName}' を削除しました。`);
            } else if (subcommand === 'listgroups') {
                if (this.matchingOptions.rankMatchSettings.rankGroups.length === 0) {
                    player.sendMessage(`${this.title} にはランクグループが設定されていません。`);
                    return;
                }

                let message = `${this.title} のランクグループ:\n`;
                for (const group of this.matchingOptions.rankMatchSettings.rankGroups) {
                    message += `- ${group.name}: ${group.startRank} - ${group.endRank}\n`;
                }
                player.sendMessage(message);
            } else if (subcommand === 'setgroup') {
                if (args.length < 6) {
                    player.sendMessage("使用方法: /rankmatch <マッチタイプ> setgroup <グループ名> <開始ランク> <終了ランク>");
                    return;
                }

                const groupName = args[3];
                const startRank = args[4];
                const endRank = args[5];

                if (!this.matchingOptions.rankSystem ||
                    !this.matchingOptions.rankSystem.rankTiers.includes(startRank) ||
                    !this.matchingOptions.rankSystem.rankTiers.includes(endRank)) {
                    player.sendMessage(`不明なランク: ${startRank} または ${endRank}`);
                    return;
                }

                const group = this.matchingOptions.rankMatchSettings.rankGroups.find(group => group.name === groupName);
                if (!group) {
                    player.sendMessage(`グループ名 '${groupName}' が見つかりません。`);
                    return;
                }

                group.startRank = startRank;
                group.endRank = endRank;
                player.sendMessage(`${this.title} のランクグループ '${groupName}' を ${startRank} - ${endRank} に設定しました。`);
            } else {
                player.sendMessage("不明なサブコマンドです。");
            }
        }
    }
}