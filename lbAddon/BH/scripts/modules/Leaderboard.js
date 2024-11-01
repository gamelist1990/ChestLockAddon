import { world } from "@minecraft/server";
import { db_leaderboards } from "../index";
export class Leaderboard {
    objective;
    dimension;
    entity;
    addLeaderboard;
    /**
     * Creates a new leaderboard instance
     * @param objective Objective of the leaderboard
     * @param entity Entity representing the leaderboard (must be a floating text entity)
     * @param dimension Dimension of this leaderboard
     * @param addLeaderboard Whether to add "Leaderboard" to the display name
     */
    constructor(objective, entity, dimension, addLeaderboard) {
        this.objective = objective;
        this.dimension = dimension;
        this.entity = entity;
        this.addLeaderboard = addLeaderboard;
        this.create();
        db_leaderboards[this.objective] = this; // db_leaderboards に Leaderboard オブジェクトを保存
        this.saveDynamicProperties();
    }
    /**
     * Creates a new Leaderboard
     */
    create() {
        world.getDimension("overworld").runCommand(`scoreboard objectives add ${this.objective} dummy`);
        if (this.entity) { // Check if the entity is valid
            this.entity.nameTag = "Updating...";
            this.entity.setDynamicProperty("objective", this.objective);
            this.entity.setDynamicProperty("addLeaderboard", this.addLeaderboard.toString()); // ダイナミックプロパティに追加
            this.saveDynamicProperties(); // ダイナミックプロパティを保存
        }
        else {
            console.warn("Failed to create leaderboard: Entity is null.");
        }
    }
    /**
     * Saves the dynamic properties to the entity's NBT data
     */
    saveDynamicProperties() {
        if (this.entity !== null) {
            this.entity.setDynamicProperty("objective", this.objective);
            this.entity.setDynamicProperty("addLeaderboard", this.addLeaderboard.toString());
            this.entity.addTag("isLeaderboard"); // リーダーボードエンティティであることを示すタグ
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
export function loadLeaderboards() {
    for (const entity of world.getDimension("overworld").getEntities()) {
        if (entity.hasTag("isLeaderboard")) {
            const objective = entity.getDynamicProperty("objective") || "";
            const addLeaderboard = entity.getDynamicProperty("addLeaderboard") === "true";
            new Leaderboard(objective, entity, world.getDimension("overworld"), addLeaderboard);
        }
    }
}
