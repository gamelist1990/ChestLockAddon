import { world, Player, system } from "@minecraft/server";
import { Handler } from "../../../module/Handler";
import { resolvePlayerName } from "../utils/playerUtils";


export function registerScoreCommand(handler: Handler, moduleName: string) {
    handler.registerCommand('score', {
        moduleName: moduleName,
        description: `指定したスコアボードの値を 'ws_<スコアボード名>' にコピーします。特殊なプレースホルダーも置換します。`,
        usage: `score=<コピー元スコアボード名>\n  [allPlayer], [uptime], [ver], [time], [tag=<タグ名>], [score=<スコアボード名>], [score=<スコアボード名>,<プレイヤー名>], [scoreN=<スコアボード名>], [scoreN=<スコアボード名>, <プレイヤー名>]が使用可能`,
        execute: (message, event) => {
            try {
                const scoreboardName = message.split('=')[1];
                const originalScoreboard = world.scoreboard.getObjective(scoreboardName);

                if (!originalScoreboard) {
                    const errorMessage = `スコアボード "${scoreboardName}"が見つかりませんでした。`;
                    console.error(errorMessage);
                    if (event.sourceEntity instanceof Player) {
                        const player = event.sourceEntity;
                        system.run(() => player.sendMessage(errorMessage));
                    }
                    return;
                }

                const displayScoreboardName = `ws_${originalScoreboard.id}`;
                let displayScoreboard = world.scoreboard.getObjective(displayScoreboardName);
                if (!displayScoreboard) {
                    displayScoreboard = world.scoreboard.addObjective(
                        displayScoreboardName,
                        originalScoreboard.displayName,
                    );
                }

                // displayScoreboard の参加者を一旦すべて削除
                for (const participant of displayScoreboard.getParticipants()) {
                    displayScoreboard.removeParticipant(participant);
                }

                for (const participant of originalScoreboard.getParticipants()) {
                    const score = originalScoreboard.getScore(participant);
                    if (score !== undefined) {
                        // プレースホルダーを解決してスコアを設定
                        const resolvedName = resolvePlayerName(participant.displayName);
                        displayScoreboard.setScore(resolvedName, score);
                    }
                }
            } catch (error) {
                const errorMessage = `スコアボード更新処理中にエラーが発生しました: ${error}`;
                console.error(errorMessage);
                if (event.sourceEntity instanceof Player) {
                    const player = event.sourceEntity;
                    system.run(() => player.sendMessage(errorMessage));
                }
            }
        },
    });
}