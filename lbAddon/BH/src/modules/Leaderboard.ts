import { Dimension, Entity, world } from "@minecraft/server";
import { db_leaderboards } from "../index";

export class Leaderboard {
  objective: string;
  dimension: Dimension;
  entity: Entity | null;
  addLeaderboard: boolean;

  /**
   * Creates a new leaderboard instance
   * @param objective Objective of the leaderboard
   * @param entity Entity representing the leaderboard (must be a floating text entity)
   * @param dimension Dimension of this leaderboard
   * @param addLeaderboard Whether to add "Leaderboard" to the display name
   */
  constructor(objective: string, entity: Entity, dimension: Dimension, addLeaderboard: boolean) {
    this.objective = objective;
    this.dimension = dimension;
    this.entity = entity;
    this.addLeaderboard = addLeaderboard;
    this.create();
    db_leaderboards[this.objective] = this; // db_leaderboards に Leaderboard オブジェクトを保存
  }

  /**
   * Creates a new Leaderboard
   */
  create(): void {
    world.getDimension("overworld").runCommand(`scoreboard objectives add ${this.objective} dummy`);
    if (this.entity) { // Check if the entity is valid
      this.entity.nameTag = "Updating...";
      this.entity.setDynamicProperty("objective", this.objective);
    } else {
      console.warn("Failed to create leaderboard: Entity is null.");
    }
  }

  /**
   * Tries to delete this leaderboard
   * @returns True if successful, false otherwise
   */
  delete(): boolean {
    try {
      if (this.entity) {
        this.entity.triggerEvent("kill");
      }
      return true;
    } catch (error) {
      return false;
    }
  }

  update(): void {
    const playerOfflineName = "commands.scoreboard.players.offlinePlayerName";

    const Objective = world.scoreboard.getObjective(this.objective);
    if (Objective) {
      for (const participant of Objective.getParticipants()) {
        if (participant.type.toString() !== "1") continue;

        try {
          if (!participant.getEntity()) continue;
        } catch (error) {
          continue;
        }

        db_leaderboards.set(participant.id, participant.displayName);
      }

      const Scores = Objective.getScores()
        .filter((v) => v.participant.displayName !== playerOfflineName)
        .map((v) => {
          return {
            player: v.participant.displayName,
            score: v.score,
          };
        })
        .sort((a, b) => b.score - a.score)
        .slice(0, 10)
        .map((v, i) => `§b#${i + 1}§r §g${v.player}§r §e${v.score}§r`);

      const color = `§l§9-§f-§9-§f-§9-§f-§9-§f-§9-§f-§9-§f-§9-§f-§9-§f-§9-§f-§9-§f-§9-§f-§r`;
      if (this.entity) {
        const leaderboardTitle = this.addLeaderboard
          ? `§l§b${Objective.displayName} §gLeaderboard`
          : `§l§b${Objective.displayName}`;

        this.entity.nameTag = `${leaderboardTitle}\n${color}\n${Scores.join("\n")}`;
      }
    }
  }
}