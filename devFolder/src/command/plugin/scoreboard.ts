import { ScoreboardIdentity, system, world } from "@minecraft/server";
import { isPlayer } from "../../Modules/Handler";

system.afterEvents.scriptEventReceive.subscribe((event) => {
    const { message, id } = event;
    if (id === "ch:score") {
        try {
            const scoreboardName = message.split("=")[1];
            const originalScoreboard = world.scoreboard.getObjective(scoreboardName);

            if (!originalScoreboard) {
                console.error(`スコアボード "${scoreboardName}"が見つかりませんでした。`);
                return;
            }

            // 表示用のスコアボードを取得 (存在しない場合は新規作成)
            const displayScoreboardName = `ch_${originalScoreboard.id}`;
            let displayScoreboard = world.scoreboard.getObjective(displayScoreboardName);
            if (!displayScoreboard) {
                displayScoreboard = world.scoreboard.addObjective(
                    displayScoreboardName,
                    originalScoreboard.displayName,
                );
            }

            // scoreData にスコア、プレイヤー名、スコアボード名を関連付けて保存
            const scoreData: { [key: string]: { player: ScoreboardIdentity, score: number, scoreboardName: string } } = {};

            for (const participant of originalScoreboard.getParticipants()) {
                const score = originalScoreboard.getScore(participant);
                if (score !== undefined) {
                    scoreData[participant.displayName] = { player: participant, score: score, scoreboardName: scoreboardName };
                    //console.log(`スコアボードクリア: ${participant.displayName} = ${score}`);
                }
            }

         for (const participant of displayScoreboard.getParticipants()) {
                displayScoreboard.removeParticipant(participant);
            }

            for (const [key, { score }] of Object.entries(scoreData)) {
                let playerNameResolved = key;
                const matchTag = key.match(/\[tag=([^\]]+)\]/);
                const matchScore = key.match(/\[score=([^,]+)(?:,True)?\]/);
                const matchPlayer = key.match(/\[allPlayer]/);

                if (matchTag) {
                    const tagName = matchTag[1];
                    const playerCount = world.getPlayers().filter(player => player.hasTag(tagName)).length;
                    playerNameResolved = key.replace(/\[tag=([^\]]+)\]/, playerCount.toString());
                } else if (matchScore) {
                    const scoreTitle = matchScore[1];

                    
                    let highestScorePlayer: ScoreboardIdentity | null = null;
                    let highestScore = -Infinity;

                    const targetScoreboard = world.scoreboard.getObjective(scoreTitle);
                    if (targetScoreboard) {
                        for (const participant of targetScoreboard.getParticipants()) {
                            const scoreValue = targetScoreboard.getScore(participant);
                            if (scoreValue !== undefined && scoreValue > highestScore) {
                                highestScore = scoreValue;
                                highestScorePlayer = participant;
                            }
                        }
                    } else {
                        console.warn(`スコアボード "${scoreTitle}" が見つかりませんでした。`);
                    }

                    if (highestScorePlayer) {
                        if (key.includes(",True")) {
                            const player = isPlayer(highestScorePlayer.displayName);
                            playerNameResolved = player
                                ? key.replace(`[score=${scoreTitle},True]`, highestScorePlayer.displayName)
                                : key.replace(`[score=${scoreTitle},True]`, "オフライン");
                        } else {
                            playerNameResolved = key.replace(`[score=${scoreTitle}]`, highestScore.toString());
                        }
                    } else {
                        console.warn(`スコア ${scoreTitle} に該当するプレイヤーが見つかりませんでした。`);
                    }
                } else if (matchPlayer) {
                    const playerCount = world.getPlayers().length;
                    playerNameResolved = key.replace(`[allPlayer]`, playerCount.toString());
                }

                displayScoreboard.setScore(playerNameResolved, score);
            }



        } catch (error) {
            console.error(`スコアボード更新処理中にエラーが発生しました: ${error}`);
        }
    }
});