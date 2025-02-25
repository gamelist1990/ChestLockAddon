// src/utils/playerUtils.ts
import { world } from "@minecraft/server";
import { getServerUptime } from "./timeUtils";
import { formatTimestampJST } from "./timeUtils";
import { ver } from "..";

const simpleReplacements: { [key: string]: string | (() => string) } = {
    '[allPlayer]': () => world.getPlayers().length.toString(),
    '[uptime]': () => getServerUptime(), // 秒まで表示
    '[ver]': () => ver,
    '[time]': () => formatTimestampJST(new Date()),
};

export function resolvePlayerName(key: string): string {
    let playerNameResolved = key;

    // simpleReplacements の置換
    for (const [pattern, replacement] of Object.entries(simpleReplacements)) {
        const regex = new RegExp(pattern.replace(/([\[\]])/g, '\\$1'), 'g');
        playerNameResolved = playerNameResolved.replace(
            regex,
            typeof replacement === 'function' ? replacement() : replacement,
        );
    }

    // tag の置換
    playerNameResolved = playerNameResolved.replace(/\[tag=([^\]]+)\]/g, (_, tagName) => {
        const playerCount = world.getPlayers().filter((player) => player.hasTag(tagName)).length;
        return playerCount.toString();
    });

    // score の置換 (既存の処理)
    playerNameResolved = playerNameResolved.replace(
        /\[score=([^,]+)(?:,([^\]]+))?\]/g,
        (_, scoreTitle, playerName) => {
            const targetScoreboard = world.scoreboard.getObjective(scoreTitle);

            if (!targetScoreboard) {
                // console.warn(`スコアボード "${scoreTitle}" が見つかりませんでした。`);
                return '0'; // スコアボードがない場合は0を返す
            }

            if (playerName) {
                // プレイヤー名が指定されている場合
                for (const participant of targetScoreboard.getParticipants()) {
                    if (participant.displayName === playerName) {
                        const playerScore = targetScoreboard.getScore(participant);
                        return playerScore !== undefined ? playerScore.toString() : '0'; // スコアがない場合は0
                    }
                }
                // console.warn(`スコアボード "${scoreTitle}" にプレイヤー "${playerName}" が見つかりませんでした。`);
                return '0'; // プレイヤーが見つからない場合も0
            } else {
                // プレイヤー名が指定されていない場合は最高スコア
                let highestScore = -Infinity;
                for (const participant of targetScoreboard.getParticipants()) {
                    const scoreValue = targetScoreboard.getScore(participant);
                    if (scoreValue !== undefined && scoreValue > highestScore) {
                        highestScore = scoreValue;
                    }
                }
                return highestScore === -Infinity ? '0' : highestScore.toString(); // スコアがない場合は 0
            }
        },
    );

    // scoreN の置換 (新規追加)
    playerNameResolved = playerNameResolved.replace(
        /\[scoreN=([^,]+)(?:,([^\]]+))?\]/g,
        (_, scoreTitle, playerName) => {
            const targetScoreboard = world.scoreboard.getObjective(scoreTitle);

            if (!targetScoreboard) {
                return '0'; // or perhaps return an empty string, or a specific "not found" indicator
            }

            if (playerName) {
                // プレイヤー名が指定されている場合
                for (const participant of targetScoreboard.getParticipants()) {
                    if (participant.displayName === playerName) {
                        return participant.displayName; // 参加者の表示名を返す
                    }
                }
                return '0'; // or perhaps return an empty string
            } else {
                const participants = targetScoreboard.getParticipants();
                let highestScore = -Infinity;
                let highestScoreParticipantName = '0';

                for (const participant of participants) {
                    const scoreValue = targetScoreboard.getScore(participant);
                    if (scoreValue !== undefined && scoreValue > highestScore) {
                        highestScore = scoreValue;
                        highestScoreParticipantName = participant.displayName;
                    }
                }
                return highestScoreParticipantName;
            }
        },
    );

    return playerNameResolved;
}