import { world, system } from "@minecraft/server";
import "./modules/commands";
import "./modules/Leaderboard";
import { loadLeaderboards } from "./modules/Leaderboard";


export const db_leaderboards: { [objective: string]: any } = {};


let start = false;

/**
 * プレイヤーのレベルを XP スコアボードに同期します。
 */
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

/**
 * スコアボードの初期化処理。
 * 存在しない場合、'xp' スコアボードを作成します。
 */
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

// スコアボードの初期化は一度だけ実行
system.run(() => {
  syncPlayerXP()
  initializeScoreboard();
  loadLeaderboards()
});
