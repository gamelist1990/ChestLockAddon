import { world } from "@minecraft/server";
import { db_leaderboards } from "../index";
export class Leaderboard {
    objective;
    dimension;
    entity;
    /**
     * Creates a new leaderboard instance
     * @param objective Objective of the leaderboard
     * @param entity Entity representing the leaderboard (must be a floating text entity)
     * @param dimension Dimension of this leaderboard
     */
    constructor(objective, entity, dimension) {
        this.objective = objective;
        this.dimension = dimension;
        this.entity = entity;
        this.create();
        db_leaderboards[this.objective] = this; // db_leaderboards に Leaderboard オブジェクトを保存
    }
    /**
     * Creates a new Leaderboard
     */
    create() {
        world.getDimension("overworld").runCommand(`scoreboard objectives add ${this.objective} dummy`);
        if (this.entity) { 
            this.entity.nameTag = "Updating...";
            this.entity.setDynamicProperty("objective", this.objective);
        }
        else {
            console.warn("Failed to create leaderboard: Entity is null.");
        }
    }
    /**
     * Tries to delete this leaderboard
     * @returns True if successful, false otherwise
     */
    delete() {
        try {
            if (this.entity) {
                this.entity.triggerEvent("kill");
            }
            return true;
        }
        catch (error) {
            return false;
        }
    }
    update() {
        const playerOfflineName = "commands.scoreboard.players.offlinePlayerName";
        const Names = db_leaderboards.Names;
        const Objective = world.scoreboard.getObjective(this.objective);
        if (Objective) {
            for (const participant of Objective.getParticipants()) {
                if (participant.type.toString() !== "1")
                    continue;
                try {
                    if (!participant.getEntity())
                        continue;
                }
                catch (error) {
                    continue;
                }
                if (participant.displayName === playerOfflineName)
                    continue;
                db_leaderboards.set(participant.id, participant.displayName);
            }
            const Scores = Objective.getScores()
                .map((v) => {
                return {
                    player: v.participant.displayName == playerOfflineName ? Names[v.participant.id] : v.participant.displayName,
                    score: v.score,
                };
            })
                .sort((a, b) => b.score - a.score)
                .slice(0, 10)
                .map((v, i) => `§b#${i + 1}§r §g${v.player}§r §e${v.score}§r`); // Removed numFormatter (assuming it's not needed)
            const color = `§l§9-§f-§9-§f-§9-§f-§9-§f-§9-§f-§9-§f-§9-§f-§9-§f-§9-§f-§9-§f-§9-§f-§r`;
            if (this.entity) {
                this.entity.nameTag = `§l§b${Objective.displayName} §gLeaderboard\n${color}\n${Scores.join("\n")}`;
            }
        }
    }
}
