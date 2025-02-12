import {
  system,
  world,
  Dimension,
  Player,
  DimensionLocation,
  Entity,
  ScoreboardObjective
} from "@minecraft/server";
import { db_leaderboards } from "../index";

export class Leaderboard {
  private _name: string;
  private _title: string;
  entity: Entity | null;
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

  constructor(
    name: string,
    location: DimensionLocation,
    sender: Player | null,
    register: boolean = false
  ) {
    this._name = name;
    this._title = `§l§b${name}`; // 初期値を設定
    this.location = location;
    this.dimension = location.dimension;
    this.lastUpdate = 0;
    this.updateInterval = 20 * 5;
    this.maxEntries = 10;
    this.ascending = false;
    this.format = "§l§b#§a.{rank} §6{player}§b {score}pt§r";
    this.showDefault = true;
    this.defaultText = "---";
    this.recordOfflinePlayers = true;
    this.objectiveSource = name;
    this.shouldFilterByWorldPlayers = true;
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
    this.createScoreboardObjective(this.name);
    this.createScoreboardObjective(`lb_${this.name}`);

    if (register) {
      db_leaderboards[this.name] = this;
    }

    this.update();
  }

  get title(): string {
    return this._title;
  }

  set title(newTitle: string) {
    this._title = newTitle;
    this.saveDynamicProperties();
    this.update();
  }

  private createScoreboardObjective(objectiveName: string): void {
    if (!world.scoreboard.getObjective(objectiveName)) {
      world.scoreboard.addObjective(objectiveName, objectiveName);
    }
  }

  private initializeEntity(): void {
    if (!this.entity) return;

    this.entity.nameTag = "Initializing...";
    this.saveDynamicProperties();
  }

  create(): void {
    if (this.entity) {
      this.entity.nameTag = "Updating...";
      this.saveDynamicProperties();
    } else {
      console.warn("Failed to create leaderboard: Entity is null.");
    }
  }

  scheduleUpdates(): void {
    system.runInterval(() => {
      this.update();
    }, this.updateInterval);
  }

  saveDynamicProperties(): void {
    if (!this.entity) return;

    if (this.entity.getTags().find((tag) => tag.startsWith("lb_"))) {
      this.entity.removeTag(this.entity.getTags().find((tag) => tag.startsWith("lb_"))!);
    }

    this.entity.setDynamicProperty("name", this.name);
    this.entity.setDynamicProperty("title", this._title);
    this.entity.setDynamicProperty("maxEntries", this.maxEntries);
    this.entity.setDynamicProperty("ascending", this.ascending);
    this.entity.setDynamicProperty("format", this.format);
    this.entity.setDynamicProperty("showDefault", this.showDefault);
    this.entity.setDynamicProperty("defaultText", this.defaultText);
    this.entity.setDynamicProperty("recordOfflinePlayers", this.recordOfflinePlayers);
    this.entity.setDynamicProperty("objectiveSource", this.objectiveSource);
    this.entity.setDynamicProperty("shouldFilterByWorldPlayers", this.shouldFilterByWorldPlayers);
    this.entity.addTag("isLeaderboard");
    this.entity.addTag(`lb_${this.name}`);
  }



  loadDynamicProperties(): void {
    if (!this.entity) return;

    this._name = (this.entity.getDynamicProperty("name") as string) ?? this._name;
    this._title = (this.entity.getDynamicProperty("title") as string) ?? this._title;
    this.maxEntries = (this.entity.getDynamicProperty("maxEntries") as number) ?? this.maxEntries;
    this.ascending = (this.entity.getDynamicProperty("ascending") as boolean) ?? this.ascending;
    this.format = (this.entity.getDynamicProperty("format") as string) ?? this.format;
    this.showDefault = (this.entity.getDynamicProperty("showDefault") as boolean) ?? this.showDefault;
    this.defaultText = (this.entity.getDynamicProperty("defaultText") as string) ?? this.defaultText;
    this.recordOfflinePlayers = (this.entity.getDynamicProperty("recordOfflinePlayers") as boolean) ?? this.recordOfflinePlayers;
    this.objectiveSource = (this.entity.getDynamicProperty("objectiveSource") as string) ?? this.objectiveSource;
    this.shouldFilterByWorldPlayers = (this.entity.getDynamicProperty("shouldFilterByWorldPlayers") as boolean) ?? this.shouldFilterByWorldPlayers;
  }

  delete(): boolean {
    try {
      if (this.entity) {
        this.entity.remove();
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

      const oldLbObjective = world.scoreboard.getObjective(`lb_${oldName}`);
      if (oldLbObjective) {
        world.scoreboard.removeObjective(oldLbObjective);
      }
    }
  }


  update(): void {
    this.lastUpdate = system.currentTick;
    if (!this.entity) {
      return;
    }

    const sourceObjective = world.scoreboard.getObjective(this.objectiveSource);
    const lbObjective = world.scoreboard.getObjective(`lb_${this.objectiveSource}`);

    if (!sourceObjective) return;

    if (this.recordOfflinePlayers) {
      if (!lbObjective) {
        this.createScoreboardObjective(`lb_${this.objectiveSource}`);
      }
      if (lbObjective) {
        this.copyScores(sourceObjective, lbObjective);
      }

    } else if (lbObjective) {
      world.scoreboard.removeObjective(lbObjective);
    }
    const scoresToDisplay = this.getScoresToDisplay(
      this.recordOfflinePlayers && lbObjective ? lbObjective : sourceObjective!
    );

    const sortedScores = scoresToDisplay
      .sort((a, b) => (this.ascending ? a.score - b.score : b.score - a.score))
      .slice(0, this.maxEntries);

    if (this.entity) {
      this.updateEntityNameTag(sortedScores);
    }
  }



  private copyScores(source: ScoreboardObjective, destination: ScoreboardObjective): void {
    const offlinePlayerNames = "commands.scoreboard.players.offlinePlayerName";

    source.getScores()
      .filter(score => {
        const participant = score.participant;

        let shouldInclude = !offlinePlayerNames.includes(participant.displayName);

        if (this.shouldFilterByWorldPlayers) {
          shouldInclude = shouldInclude && world.getAllPlayers().some(player => player.name === participant.displayName);
        }

        return shouldInclude;
      })
      .forEach(score => {
        const participant = score.participant;
        destination.setScore(participant.displayName, score.score);
      });
  }


  private getScoresToDisplay(objective: ScoreboardObjective): { playerName: string; score: number; }[] {
    if (!objective) return [];
    const offlinePlayerNames = "commands.scoreboard.players.offlinePlayerName";

    return objective.getScores()
      .filter(score => {
        const participant = score.participant;
        let shouldInclude = !offlinePlayerNames.includes(participant.displayName);
        if (this.shouldFilterByWorldPlayers) {
          shouldInclude = shouldInclude && world.getAllPlayers().some(player => player.name === participant.displayName);
        }
        return shouldInclude
      })
      .map(score => ({
        playerName: score.participant.displayName,
        score: score.score,
      }));
  }



  private updateEntityNameTag(sortedScores: { playerName: string; score: number; }[]): void {
    const leaderboardTitle = this._title.replace(/\{br\}/g, "\n");

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

    const currentShowDefault = this.entity?.getDynamicProperty("showDefault") as boolean ?? this.showDefault;

    // デフォルトの区切り線を削除。条件によって表示を制御する
    const color = ""; // 区切り線を空にする

    this.entity!.nameTag =
      formattedScores.length > 0
        ? `${leaderboardTitle}\n${color}\n${formattedScores.join("\n")}`
        : currentShowDefault
          ? `${leaderboardTitle}\n${this.defaultText}` //区切り線を除外
          : "";
  }

  static createEmpty(): Leaderboard {
    return Object.create(Leaderboard.prototype);
  }

  static fromEntity(entity: Entity): Leaderboard | null {
    const name = entity.getDynamicProperty("name") as string;
    if (!name) {
      console.warn(
        `Failed to restore leaderboard from entity: Entity does not have a name property. Entity ID: ${entity.id}`
      );
      return null;
    }
    const leaderboard = Leaderboard.createEmpty();
    leaderboard._name = name;
    leaderboard.entity = entity;
    leaderboard.dimension = entity.dimension;
    leaderboard.location = { dimension: entity.dimension, ...entity.location };
    leaderboard.loadDynamicProperties();

    return leaderboard;
  }
}
const checkedLeaderboards: { [entityUUID: string]: Leaderboard } = {};

export function loadLeaderboards(): void {
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
      const leaderboard = Leaderboard.fromEntity(entity);
      if (!leaderboard) {
        continue;
      }

      if (loadedLeaderboardNames.includes(leaderboard.name)) {
        continue;
      }

      db_leaderboards[leaderboard.name] = leaderboard;
      leaderboard.update();
      leaderboard.scheduleUpdates();

      checkedLeaderboards[entity.id] = leaderboard;
      loadedLeaderboardNames.push(leaderboard.name)
    }
    console.log(`Loaded ${loadedLeaderboardNames.length} leaderboards.`);
  }, 40);
}