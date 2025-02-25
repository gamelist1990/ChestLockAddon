// src/utils/scoreboardUtils.ts
import { ScoreboardObjective, ScoreboardIdentity } from '@minecraft/server';

export function resetScoreboard(
    objective: ScoreboardObjective,
    sendMessage: (message: string) => void,
): void {
    for (const participant of objective.getParticipants()) {
        try {
            objective.removeParticipant(participant);
        } catch (error) {
            console.error(
                `Error removing participant ${getParticipantDisplayName(participant)} from ${objective.displayName}: ${error}`,
            );
            sendMessage(
                `Error removing participant ${getParticipantDisplayName(participant)} from ${objective.displayName}`,
            );
        }
    }
}

// ScoreboardIdentity から表示名を取得するヘルパー関数
function getParticipantDisplayName(participant: ScoreboardIdentity): string {
    return participant.displayName;
}