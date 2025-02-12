import { system, world } from "@minecraft/server";
import { db_leaderboards } from "../index";
export class Leaderboard {
    _name;
    title;
    entity;
    dimension;
    lastUpdate;
    updateInterval;
    maxEntries;
    ascending;
    format;
    showDefault;
    defaultText;
    recordOfflinePlayers;
    objectiveSource;
    location;
    shouldFilterByWorldPlayers;
    constructor(name, location, sender, register = false) {
        this._name = name;
        this.title = `§l§b${name}`;
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
        const entity = this.dimension.spawnEntity("mcbehub:floating_text", this.location);
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
    createScoreboardObjective(objectiveName) {
        if (!world.scoreboard.getObjective(objectiveName)) {
            world.scoreboard.addObjective(objectiveName, objectiveName);
        }
    }
    initializeEntity() {
        if (!this.entity)
            return;
        this.entity.nameTag = "Initializing...";
        this.saveDynamicProperties();
    }
    create() {
        if (this.entity) {
            this.entity.nameTag = "Updating...";
            this.saveDynamicProperties();
        }
        else {
            console.warn("Failed to create leaderboard: Entity is null.");
        }
    }
    scheduleUpdates() {
        system.runInterval(() => {
            this.update();
        }, this.updateInterval);
    }
    saveDynamicProperties() {
        if (!this.entity)
            return;
        if (this.entity.getTags().find((tag) => tag.startsWith("lb_"))) {
            this.entity.removeTag(this.entity.getTags().find((tag) => tag.startsWith("lb_")));
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
        this.entity.addTag(`lb_${this.name}`);
    }
    loadDynamicProperties() {
        if (!this.entity)
            return;
        this._name = this.entity.getDynamicProperty("name") ?? this._name;
        this.title = this.entity.getDynamicProperty("title") ?? this.title;
        this.maxEntries = this.entity.getDynamicProperty("maxEntries") ?? this.maxEntries;
        this.ascending = this.entity.getDynamicProperty("ascending") ?? this.ascending;
        this.format = this.entity.getDynamicProperty("format") ?? this.format;
        this.showDefault = this.entity.getDynamicProperty("showDefault") ?? this.showDefault;
        this.defaultText = this.entity.getDynamicProperty("defaultText") ?? this.defaultText;
        this.recordOfflinePlayers = this.entity.getDynamicProperty("recordOfflinePlayers") ?? this.recordOfflinePlayers;
        this.objectiveSource = this.entity.getDynamicProperty("objectiveSource") ?? this.objectiveSource;
        this.shouldFilterByWorldPlayers = this.entity.getDynamicProperty("shouldFilterByWorldPlayers") ?? this.shouldFilterByWorldPlayers;
    }
    delete() {
        try {
            if (this.entity) {
                this.entity.remove();
            }
            const lbObjective = world.scoreboard.getObjective(`lb_${this.name}`);
            if (lbObjective) {
                world.scoreboard.removeObjective(lbObjective);
            }
            return true;
        }
        catch (error) {
            console.error(error);
            return false;
        }
    }
    get name() {
        return this._name;
    }
    set name(newName) {
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
    update() {
        this.lastUpdate = system.currentTick;
        if (!this.entity || !this.entity.isValid()) {
            return;
        }
        const sourceObjective = world.scoreboard.getObjective(this.objectiveSource);
        const lbObjective = world.scoreboard.getObjective(`lb_${this.objectiveSource}`);
        if (!sourceObjective)
            return;
        if (this.recordOfflinePlayers) {
            if (!lbObjective) {
                this.createScoreboardObjective(`lb_${this.objectiveSource}`);
            }
            this.copyScores(sourceObjective, lbObjective);
        }
        else if (lbObjective) {
            world.scoreboard.removeObjective(lbObjective);
        }
        const scoresToDisplay = this.getScoresToDisplay(this.recordOfflinePlayers ? lbObjective : sourceObjective);
        const sortedScores = scoresToDisplay
            .sort((a, b) => (this.ascending ? a.score - b.score : b.score - a.score))
            .slice(0, this.maxEntries);
        if (this.entity) {
            this.updateEntityNameTag(sortedScores);
        }
    }
    copyScores(source, destination) {
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
            destination?.setScore(`${participant.displayName}`, score.score);
        });
    }
    getScoresToDisplay(objective) {
        if (!objective)
            return [];
        return objective.getScores()
            .filter(score => {
            const participant = score.participant;
            const isOfflinePlayer = participant.type === 3;
            let shouldInclude = !isOfflinePlayer;
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
    updateEntityNameTag(sortedScores) {
        const leaderboardTitle = this.title;
        const formattedScores = sortedScores.map((v, i) => {
            const replaceIfPlaceholder = (format, playerName) => {
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
                        }
                        else {
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
        this.entity.nameTag =
            formattedScores.length > 0
                ? `${leaderboardTitle}\n${color}\n${formattedScores.join("\n")}`
                : this.showDefault
                    ? `${leaderboardTitle}\n${color}\n${this.defaultText}`
                    : "";
    }
    static createEmpty() {
        return Object.create(Leaderboard.prototype);
    }
    static fromEntity(entity) {
        const name = entity.getDynamicProperty("name");
        if (!name) {
            console.warn(`Failed to restore leaderboard from entity: Entity does not have a name property. Entity ID: ${entity.id}`);
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
const checkedLeaderboards = {};
export function loadLeaderboards() {
    system.runTimeout(() => {
        const leaderboardEntities = world
            .getDimension("overworld")
            .getEntities({ type: "mcbehub:floating_text", tags: ["isLeaderboard"] })
            .concat(world
            .getDimension("nether")
            .getEntities({ type: "mcbehub:floating_text", tags: ["isLeaderboard"] }), world
            .getDimension("the end")
            .getEntities({ type: "mcbehub:floating_text", tags: ["isLeaderboard"] }));
        const loadedLeaderboardNames = [];
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
            loadedLeaderboardNames.push(leaderboard.name);
        }
        console.log(`Loaded ${loadedLeaderboardNames.length} leaderboards.`);
    }, 40);
}
system.runTimeout(() => {
    loadLeaderboards();
}, 40);
