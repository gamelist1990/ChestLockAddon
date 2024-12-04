import { Entity, world, system, } from "@minecraft/server";
import "./modules/commands";
import { loadLeaderboards } from "./modules/Leaderboard";

export const db_leaderboards: { [objective: string]: any } = {};


function updateLeaderboard(entity: Entity) {
  const objective = entity.getDynamicProperty("objective") as string;
  if (!objective) return;

  const leaderboard = db_leaderboards[objective];

  if (leaderboard) {
    system.runTimeout(() => {
      leaderboard.update();
    }, 1)
  }
}


let scoreboard: any;
let xpObjective: any;

// スコアボード "xp" を作成 (まだ存在しない場合)
system.runTimeout(() => {
  scoreboard = world.scoreboard;
  xpObjective = scoreboard.getObjective("xp");
})


if (!xpObjective) {
  xpObjective = scoreboard.addObjective("xp", "XP Level");
  if (!xpObjective) {
    console.error("スコアボード 'xp' を作成できませんでした。");
  }
}

system.runInterval(() => {
  const query = { type: "mcbehub:floating_text" };

  for (const entity of world.getDimension("overworld").getEntities(query)) {
    updateLeaderboard(entity);
  }



  // 全てのプレイヤーに対してループ
  for (const player of world.getPlayers()) {
    if (!xpObjective) {
      return;
    }
    // プレイヤーのレベルを取得
    const level = player.level;
    // スコアボード "xp" にプレイヤーのレベルを保存
    xpObjective.setScore(player.name, level);  // xpObjective を使用 
  }
  system.runTimeout(() => {
    loadLeaderboards();

  })
}, 20 * 5);




