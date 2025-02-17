// Database.ts (最終版)
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
        try {
            this.objective = world.scoreboard.getObjective(this.objectiveName) || world.scoreboard.addObjective(this.objectiveName, this.objectiveName);
            this.loadParticipantsBackup();
        }
        catch (error) {
            console.error("initializeObjective Error:", error);
            throw error; // 重要な初期化エラーなので、上に投げる
        }
    }
    private setupObjectiveDeletionListener() {
        system.runInterval(() => {
            if (!world.scoreboard.getObjective(this.objectiveName) && !this.isRecreating) {
                console.warn(`Scoreboard "${this.objectiveName}" was deleted. Recreating...`);
                this.isRecreating = true;
                this.recreateObjective();
                this.isRecreating = false;
            }
        }, 100);
    }

    private recreateObjective() {
        try {
            this.objective = world.scoreboard.addObjective(this.objectiveName, this.objectiveName);
            console.log(`Recreated scoreboard "${this.objectiveName}" and restored participants.`);
        }
        catch (error) {
            console.error("recreateObjective error", error);
        }
    }


    private loadParticipantsBackup() {
        this.participantsBackup.clear(); // Clear existing backup
        const participants = this.objective.getParticipants();
        for (const participant of participants) {
            this.participantsBackup.add(participant.displayName);
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
            console.error(`Failed to set data for key "${keyString}":`, error); // より詳細なエラーメッセージ
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

            console.error("Failed to get data:", error);
            throw error;//objectiveがないなど、根本的な問題
        }
    }

    async has(key: string | Player): Promise<boolean> {
        const keyString = key instanceof Player ? key.name : key;
        try {
            // スコアの取得を試みる。例外が発生しなければ存在するとみなす
            this.objective.getScore(keyString);
            return true;
        } catch (error) {
            //console.error("has method error", error)
            return false; // スコアボードまたはキーが存在しない
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