import { world, system } from "@minecraft/server";
import "./modules/commands";
import { Leaderboard } from "./modules/Leaderboard";


export const db_leaderboards = {};
function updateLeaderboard(entity) {
    const objective = entity.getDynamicProperty("objective");
    if (!objective)
        return; // objective が設定されていないエンティティはスキップ
    const leaderboard = new Leaderboard(objective, entity, entity.dimension); 
    leaderboard.update();
}
system.runInterval(() => {
    const query = { type: "mcbehub:floating_text" }; 
    for (const entity of world.getDimension("overworld").getEntities(query)) {
        updateLeaderboard(entity);
    }
}, 20 * 5);
