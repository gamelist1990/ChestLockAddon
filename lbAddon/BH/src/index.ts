import { Entity, world,system } from "@minecraft/server";
import "./modules/commands";

export const db_leaderboards: { [objective: string]: any } = {};


function updateLeaderboard(entity: Entity) {
  const objective = entity.getDynamicProperty("objective") as string;
  if (!objective) return; 

  const leaderboard = db_leaderboards[objective];

  if (leaderboard) {
    leaderboard.update();
  }
}

system.runInterval(() => {
  const query = { type: "mcbehub:floating_text" }; 

  for (const entity of world.getDimension("overworld").getEntities(query)) {
    updateLeaderboard(entity);
  }
}, 20 * 5); 