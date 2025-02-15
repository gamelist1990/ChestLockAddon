// Database.ts (再生成機能付き - スコアはバックアップしない)
import { world, ScoreboardObjective, Player, system } from "@minecraft/server";

export class Database {
    private objective!: ScoreboardObjective; // 初期化子を削除
    private readonly objectiveName: string;
    private participantsBackup: Set<string> = new Set();
    private isRecreating = false;

    constructor(objectiveName: string = "ws_Data") {
        this.objectiveName = objectiveName;
        this.initializeObjective(); // コンストラクタで初期化
        this.setupObjectiveDeletionListener();
    }

    private initializeObjective() {
        this.objective = world.scoreboard.getObjective(this.objectiveName) || world.scoreboard.addObjective(this.objectiveName, this.objectiveName);
        this.loadParticipantsBackup();
    }

    private setupObjectiveDeletionListener() {
        system.runInterval(() => {
            if (!world.scoreboard.getObjective(this.objectiveName) && !this.isRecreating) {
                console.warn(`Scoreboard "${this.objectiveName}" was deleted. Recreating...`);
                this.isRecreating = true;
                this.recreateObjective();
                this.isRecreating = false;
            }
        }, 20);
    }

    private recreateObjective() {
        this.objective = world.scoreboard.addObjective(this.objectiveName, this.objectiveName);
        this.restoreParticipants();
        console.log(`Recreated scoreboard "${this.objectiveName}" and restored participants.`);
    }

    private loadParticipantsBackup() {
        this.participantsBackup.clear(); // Clear existing backup
        const participants = this.objective.getParticipants();
        for (const participant of participants) {
            this.participantsBackup.add(participant.displayName);
        }
    }

    private restoreParticipants() {
        // 参加者のみを復元。スコアは復元しない。
        for (const participantName of this.participantsBackup) {
            // スコアは設定しない
            try {
                this.objective.getScore(participantName)

            }
            catch (e) {
                console.error("restoreParticipants error", e)
            }
        }
    }

    async set(key: string | Player, value: number): Promise<void> {
        if (typeof value !== 'number') {
            console.warn(`Database.set: Invalid value type. Expected a number, got: ${typeof value}`);
            return;
        }
        const keyString = key instanceof Player ? key.name : key;

        try {
            if (key instanceof Player) {
                this.objective.setScore(key, value);
            } else {
                this.objective.setScore(keyString, value);
            }
            this.participantsBackup.add(keyString); // 参加者リストに追加/更新
        } catch (error) {
            console.error("Failed to set data:", error);
            throw error;
        }
    }

    async get(key: string | Player): Promise<number | undefined> {
        const keyString = key instanceof Player ? key.name : key;
        try {
            if (key instanceof Player)
                return this.objective.getScore(key);

            else {
                return this.objective.getScore(keyString);
            }

        } catch (error) {
            if (error instanceof ReferenceError) {
                return undefined;
            }
            console.error("Failed to get data:", error);
            throw error;
        }
    }


    async delete(key: string | Player): Promise<void> {
        const keyString = key instanceof Player ? key.name : key;
        try {

            if (key instanceof Player) {
                this.objective.removeParticipant(key);
            }
            else {
                this.objective.removeParticipant(keyString);
            }
            this.participantsBackup.delete(keyString); // 参加者リストから削除
        } catch (error) {
            console.error("Failed to delete data:", error);
        }
    }

    async getAllKeys(): Promise<string[]> {
        try {
            return Array.from(this.participantsBackup); // バックアップから取得
        } catch (error) {
            console.error("Failed to get all keys:", error);
            throw error;
        }
    }


    async clear(): Promise<void> {
        const keys = await this.getAllKeys(); // バックアップからキーを取得
        for (const key of keys) {
            await this.delete(key); // バックアップされたキーを使用して削除
        }
        this.participantsBackup.clear(); // バックアップをクリア
    }


    static create(objectiveName: string): Database {
        if (!objectiveName.startsWith("ws_")) {
            console.warn("Objective name should start with 'ws_'.");
        }
        return new Database(objectiveName);
    }
}