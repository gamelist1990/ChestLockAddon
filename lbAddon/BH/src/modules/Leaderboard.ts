import {
  system,
  world,
  Dimension,
  Player,
  DimensionLocation,
  Entity} from "@minecraft/server";
import { db_leaderboards } from "../index";

export class Leaderboard {
  private _name: string; // プライベート変数に変更
  title: string;
  entity: Entity | null; // エンティティをオプショナルに変更
  dimension: Dimension;
  lastUpdate: number;
  updateInterval: number;
  maxEntries: number;
  ascending: boolean;
  format: string;
  showDefault: boolean;
  defaultText: string;
  recordOfflinePlayers: boolean;
  objectiveSource: string;
  location: DimensionLocation;
  shouldFilterByWorldPlayers: boolean;

  /**
   * Creates a new leaderboard instance
   * @param name Name of the leaderboard
   * @param location Location of the leaderboard (must be a floating text entity)
   * @param sender player that excute the command
   * @param register Whether to add this to the db_leaderboard right now. default false.
   */
  constructor(
    name: string,
    location: DimensionLocation,
    sender: Player | null,
    register: boolean = false
  ) {
    this._name = name;
    this.title = `§l§b${name}`;
    this.location = location;
    this.dimension = location.dimension;
    this.lastUpdate = 0;
    this.updateInterval = 20 * 5; // 5秒ごとに更新
    this.maxEntries = 10;
    this.ascending = false;
    this.format = "§l§b#§a.{rank} §6{player}§b {score}pt§r";
    this.showDefault = true;
    this.defaultText = "---";
    this.recordOfflinePlayers = true;
    this.objectiveSource = name;
    this.shouldFilterByWorldPlayers = true; // デフォルトでtrueに設定
    //浮遊テキストエンティティをスポーンさせる
    const entity = this.dimension.spawnEntity(
      "mcbehub:floating_text",
      this.location
    );

    if (!entity) {
      sender?.sendMessage("Failed to create leaderboard.");
      this.entity = null;
      return;
    }

    this.entity = entity;
    this.initializeEntity();

    // スコアボードオブジェクトを作成（存在しない場合）
    this.createScoreboardObjective(this.name);
    //オフライン用のスコアボードを作成する。
    this.createScoreboardObjective(`lb_${this.name}`);

    if (register) {
      db_leaderboards[this.name] = this;
    }

    this.update();
  }
  /**
   * エンティティが存在しない場合に、スコアボードオブジェクトを作成します。
   * @param objectiveName 作成するスコアボードオブジェクトの名前
   */
  private createScoreboardObjective(objectiveName: string): void {
    if (!world.scoreboard.getObjective(objectiveName)) {
      world.scoreboard.addObjective(objectiveName, objectiveName);
    }
  }

  /**
   * Initializes the entity with default values and tags.
   */
  private initializeEntity(): void {
    if (!this.entity) return;

    this.entity.nameTag = "Initializing...";
    this.saveDynamicProperties();
  }

  /**
   * Creates a new Leaderboard (Initializes)
   */
  create(): void {
    if (this.entity) {
      this.entity.nameTag = "Updating...";
      this.saveDynamicProperties();
    } else {
      console.warn("Failed to create leaderboard: Entity is null.");
    }
  }

  /**
 * 定期的に update() を呼び出す関数
 */
  scheduleUpdates(): void {
    system.runInterval(() => {
      this.update();
    }, this.updateInterval);
  }

  /**
   * Saves the dynamic properties to the entity's NBT data
   */
  saveDynamicProperties(): void {
    if (!this.entity) return;

    // 古いタグを削除
    if (this.entity.getTags().find((tag) => tag.startsWith("lb_"))) {
      this.entity.removeTag(this.entity.getTags().find((tag) => tag.startsWith("lb_"))!);
    }

    this.entity.setDynamicProperty("name", this.name);
    this.entity.setDynamicProperty("title", this.title);
    this.entity.setDynamicProperty("maxEntries", this.maxEntries);
    this.entity.setDynamicProperty("ascending", this.ascending);
    this.entity.setDynamicProperty("format", this.format);
    this.entity.setDynamicProperty("showDefault", this.showDefault);
    this.entity.setDynamicProperty("defaultText", this.defaultText);
    this.entity.setDynamicProperty("recordOfflinePlayers", this.recordOfflinePlayers);
    this.entity.setDynamicProperty("objectiveSource", this.objectiveSource);
    this.entity.setDynamicProperty("shouldFilterByWorldPlayers", this.shouldFilterByWorldPlayers);
    this.entity.addTag("isLeaderboard");
    this.entity.addTag(`lb_${this.name}`); // リーダーボード名でタグを追加
  }

  /**
   * Loads the dynamic properties from the entity's NBT data
   */
  loadDynamicProperties(): void {
    if (!this.entity) return;

    this._name = (this.entity.getDynamicProperty("name") as string) ?? this._name;
    this.title = (this.entity.getDynamicProperty("title") as string) ?? this.title;
    this.maxEntries = (this.entity.getDynamicProperty("maxEntries") as number) ?? this.maxEntries;
    this.ascending = (this.entity.getDynamicProperty("ascending") as boolean) ?? this.ascending;
    this.format = (this.entity.getDynamicProperty("format") as string) ?? this.format;
    this.showDefault = (this.entity.getDynamicProperty("showDefault") as boolean) ?? this.showDefault;
    this.defaultText = (this.entity.getDynamicProperty("defaultText") as string) ?? this.defaultText;
    this.recordOfflinePlayers = (this.entity.getDynamicProperty("recordOfflinePlayers") as boolean) ?? this.recordOfflinePlayers;
    this.objectiveSource = (this.entity.getDynamicProperty("objectiveSource") as string) ?? this.objectiveSource;
    this.shouldFilterByWorldPlayers = (this.entity.getDynamicProperty("shouldFilterByWorldPlayers") as boolean) ?? this.shouldFilterByWorldPlayers;
  }

  /**
   * Tries to delete this leaderboard
   * @returns True if successful, false otherwise
   */
  delete(): boolean {
    try {
      if (this.entity) {
        this.entity.remove(); // エンティティを削除
      }

      const lbObjective = world.scoreboard.getObjective(`lb_${this.name}`);
      if (lbObjective) {
        world.scoreboard.removeObjective(lbObjective);
      }

      return true;
    } catch (error) {
      console.error(error);
      return false;
    }
  }

  // name プロパティの getter と setter
  get name(): string {
    return this._name;
  }

  set name(newName: string) {
    if (this._name !== newName) {
      const oldName = this._name;
      this._name = newName;
      this.title = `§l§b${newName}`;
      this.objectiveSource = newName;
      this.createScoreboardObjective(newName);
      this.createScoreboardObjective(`lb_${newName}`);
      this.saveDynamicProperties();
      this.update();

      // 古い名前のスコアボードを削除
      const oldLbObjective = world.scoreboard.getObjective(`lb_${oldName}`);
      if (oldLbObjective) {
        world.scoreboard.removeObjective(oldLbObjective);
      }
    }
  }

  /**
   * リーダーボードを更新します。
   */
  update(): void {
    this.lastUpdate = system.currentTick;
    if (!this.entity || !this.entity.isValid()) {
      return;
    }

    const sourceObjective = world.scoreboard.getObjective(this.objectiveSource);
    const lbObjective = world.scoreboard.getObjective(`lb_${this.objectiveSource}`);

    if (!sourceObjective) return;

    // recordOfflinePlayers が true の場合、lbObjective に sourceObjective の内容をコピー
    if (this.recordOfflinePlayers) {
      if (!lbObjective) {
        this.createScoreboardObjective(`lb_${this.objectiveSource}`);
      }

      this.copyScores(sourceObjective, lbObjective);
    } else if (lbObjective) {
      // recordOfflinePlayers が false で lbObjective が存在する場合は削除
      world.scoreboard.removeObjective(lbObjective);
    }

    // 表示用のスコアを取得
    const scoresToDisplay = this.getScoresToDisplay(this.recordOfflinePlayers ? lbObjective : sourceObjective);

    // スコアでソート
    const sortedScores = scoresToDisplay
      .sort((a, b) => (this.ascending ? a.score - b.score : b.score - a.score))
      .slice(0, this.maxEntries);

    // エンティティの nameTag を更新
    if (this.entity) {
      this.updateEntityNameTag(sortedScores);
    }
  }

  /**
   * スコアをコピーするヘルパー関数
   * @param source ソースのスコアボード
   * @param destination コピー先のスコアボード
   */
  private copyScores(source: any, destination: any): void {
    const offlinePlayerNames = "commands.scoreboard.players.offlinePlayerName";

    source.getScores()
      .filter(score => {
        const participant = score.participant;

        // オフラインプレイヤーを除外
        let shouldInclude = !offlinePlayerNames.includes(participant.displayName);

        // ワールド内のプレイヤーで絞り込む
        if (this.shouldFilterByWorldPlayers) {
          shouldInclude = shouldInclude && world.getAllPlayers().some(player => player.name === participant.displayName);
        }

        return shouldInclude;
      })
      .forEach(score => {
        const participant = score.participant;
        destination?.setScore(`${participant.displayName}`, score.score);
      });
  }

  /**
   * 表示用のスコアを取得するヘルパー関数
   * @param objective スコアを取得するスコアボード
   * @returns 表示用のスコアの配列
   */
  private getScoresToDisplay(objective: any): { playerName: string; score: number; }[] {
    if (!objective) return [];

    return objective.getScores()
      .filter(score => {
        const participant = score.participant;
        const isOfflinePlayer = participant.type === 3; // 3 は偽のプレイヤー (オフラインプレイヤー) を表す

        // オフラインプレイヤーを除外
        let shouldInclude = !isOfflinePlayer;

        // ワールド内のプレイヤーで絞り込む
        if (this.shouldFilterByWorldPlayers) {
          shouldInclude = shouldInclude && world.getAllPlayers().some(player => player.name === participant.displayName);
        }

        return shouldInclude;
      })
      .map(score => ({
        playerName: score.participant.displayName,
        score: score.score,
      }));
  }

  /**
   * エンティティの nameTag を更新するヘルパー関数
   * @param sortedScores ソートされたスコアの配列
   */
  private updateEntityNameTag(sortedScores: { playerName: string; score: number; }[]): void {
    const leaderboardTitle = this.title;
    const formattedScores = sortedScores.map((v, i) => {
      const replaceIfPlaceholder = (format: string, playerName: string): string => {
        const ifRegex = /\{if=\{([^}]+)\}\}/g;

        return format.replace(ifRegex, (_ifMatch, ifContent) => {
          const conditions = ifContent.split(",");
          let defaultValue = conditions.pop()?.trim() ?? "";

          for (let i = 0; i < conditions.length; i += 2) {
            const tagMatch = conditions[i].trim().match(/tag=([^,]+)/);
            const displayValue = conditions[i + 1]?.trim();

            if (tagMatch && displayValue) {
              const tagName = tagMatch[1];
              const player = world.getAllPlayers().find(p => p.name === playerName);
              if (player && player.hasTag(tagName)) {
                return displayValue;
              }
            } else {
              defaultValue = "{error}";
            }
          }

          return defaultValue;
        });
      };

      let formattedScore = this.format
        .replace("{player}", v.playerName)
        .replace("{score}", v.score.toString())
        .replace("{rank}", (i + 1).toString());

      formattedScore = replaceIfPlaceholder(formattedScore, v.playerName);

      return formattedScore;
    });

    const color = `§l§9-§f-§9-§f-§9-§f-§9-§f-§9-§f-§9-§f-§9-§f-§9-§f-§9-§f-§9-§f-§r`;
    this.entity!.nameTag =
      formattedScores.length > 0
        ? `${leaderboardTitle}\n${color}\n${formattedScores.join("\n")}`
        : this.showDefault
          ? `${leaderboardTitle}\n${color}\n${this.defaultText}`
          : "";
  }

  /**
  * 空のリーダーボードオブジェクトを作成します。
  * @returns 空の Leaderboard オブジェクト
  */
  static createEmpty(): Leaderboard {
    return Object.create(Leaderboard.prototype);
  }



  /**
  * ファクトリメソッド: 既存のエンティティからリーダーボードを復元します。
  * @param entity リーダーボード情報を持つエンティティ
  * @returns 復元された Leaderboard オブジェクト、または null (復元に失敗した場合)
  */
  static fromEntity(entity: Entity): Leaderboard | null {
    const name = entity.getDynamicProperty("name") as string;
    if (!name) {
      console.warn(
        `Failed to restore leaderboard from entity: Entity does not have a name property. Entity ID: ${entity.id}`
      );
      return null;
    }

    // 空のリーダーボードオブジェクトを作成
    const leaderboard = Leaderboard.createEmpty();

    // エンティティからプロパティを復元
    leaderboard._name = name;
    leaderboard.entity = entity;
    leaderboard.dimension = entity.dimension;
    leaderboard.location = { dimension: entity.dimension, ...entity.location };
    leaderboard.loadDynamicProperties();

    return leaderboard;
  }
}

// 既にチェックしたリーダーボードを記録するオブジェクト(エンティティのUUIDをキーとしたオブジェクトに変更)
const checkedLeaderboards: { [entityUUID: string]: Leaderboard } = {};

export function loadLeaderboards(): void {
  // system.runTimeout 内で実行されるように修正
  system.runTimeout(() => {
    const leaderboardEntities = world
      .getDimension("overworld")
      .getEntities({ type: "mcbehub:floating_text", tags: ["isLeaderboard"] })
      .concat(
        world
          .getDimension("nether")
          .getEntities({ type: "mcbehub:floating_text", tags: ["isLeaderboard"] }),
        world
          .getDimension("the end")
          .getEntities({ type: "mcbehub:floating_text", tags: ["isLeaderboard"] })
      );

    const loadedLeaderboardNames: string[] = [];

    for (const entity of leaderboardEntities) {
      // エンティティからリーダーボードを復元
      const leaderboard = Leaderboard.fromEntity(entity);
      if (!leaderboard) {
        continue;
      }

      if (loadedLeaderboardNames.includes(leaderboard.name)) {
        continue; // 既にロードされている場合はスキップ
      }

      // db_leaderboards に登録
      db_leaderboards[leaderboard.name] = leaderboard;

      leaderboard.update();
      leaderboard.scheduleUpdates();

      checkedLeaderboards[entity.id] = leaderboard;
      loadedLeaderboardNames.push(leaderboard.name);
    }

    console.log(`Loaded ${loadedLeaderboardNames.length} leaderboards.`);
  }, 40); // 40 ticks (2秒) 後に実行
}

system.runTimeout(() => {
  loadLeaderboards();
}, 40);