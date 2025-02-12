import { world, system } from "@minecraft/server";
import "./modules/commands";
import "./modules/Leaderboard";
export const db_leaderboards = {};
let start = false;
function syncPlayerXP() {
    const xpObjective = world.scoreboard.getObjective("xp");
    if (!xpObjective) {
        return;
    }
    if (start) {
        for (const player of world.getPlayers()) {
            xpObjective.setScore(player.name, player.level);
        }
    }
}
function initializeScoreboard() {
    const scoreboard = world.scoreboard;
    let xpObjective = scoreboard.getObjective("xp");
    if (start) {
        if (!xpObjective) {
            xpObjective = scoreboard.addObjective("xp", "XP Level");
            console.warn("スコアボード 'xp' を作成しました。");
        }
    }
}
system.run(() => {
    syncPlayerXP();
    initializeScoreboard();
});
