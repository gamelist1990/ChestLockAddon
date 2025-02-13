// Database.ts (修正版 - getEntityKey 削除)
import { world, ScoreboardObjective, Player } from "@minecraft/server";

export class Database {
    private objective: ScoreboardObjective;
    private readonly objectiveName: string;

    constructor(objectiveName: string = "ws_Data") {
        this.objectiveName = objectiveName;
        this.objective = world.scoreboard.getObjective(this.objectiveName) || world.scoreboard.addObjective(this.objectiveName, this.objectiveName);
    }

    async set(key: string | Player, value: number): Promise<void> { // Player 型を追加
        if (typeof value !== 'number') {
            console.warn(`Database.set: Invalid value type.  Expected a number, got: ${typeof value}`);
            return;
        }

        try {
            if (key instanceof Player) {
                this.objective.setScore(key, value);
            } else {
                this.objective.setScore(key, value);
            }
        } catch (error) {
            console.error("Failed to set data:", error);
            throw error;
        }
    }

    async get(key: string | Player): Promise<number | undefined> { // Player 型を追加
        try {
            if (key instanceof Player) {
                // Player オブジェクトの場合は、直接 getScore を使う。
                return this.objective.getScore(key);
            } else {
                // 文字列の場合は、従来通り。
                const score = this.objective.getScore(key);
                if (score === undefined) {
                    return undefined
                }
                return score
            }
        } catch (error) {
            if (error instanceof ReferenceError) { // ScoreboardParticipant が見つからない場合
                return undefined;
            }
            console.error("Failed to get data:", error);
            throw error;
        }
    }


    async delete(key: string | Player): Promise<void> {  // Player 型を追加
        try {
            if (key instanceof Player) {
                this.objective.removeParticipant(key);
            } else {
                this.objective.removeParticipant(key);
            }
        } catch (error) {
            console.error("Failed to get data:", error);
        }

    }

    async getAllKeys(): Promise<string[]> {
        try {
            return this.objective.getParticipants().map(participant => participant.displayName);
        } catch (error) {
            console.error("Failed to get all keys:", error);
            throw error;
        }
    }

    async clear(): Promise<void> {
        const keys = await this.getAllKeys();
        for (const key of keys) {
            await this.delete(key);
        }
    }

    static create(objectiveName: string): Database {
        if (!objectiveName.startsWith("ws_")) {
            console.warn("Objective name should start with 'ws_'.");
        }
        return new Database(objectiveName);
    }
}