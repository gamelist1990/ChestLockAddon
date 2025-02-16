import { world } from "../../../backend";
import { registerPlugin } from "../plugin";


const MyNewModule = {
    checkScoreboardAndSendMessage: async () => {
        const scoreboard = world.scoreboard;
        const objective = await scoreboard.getObjective('ws_module');

        if (!objective) {
            console.warn("[MyNewModule] Scoreboard 'ws_module' not found.");
            return;
        }
        try {
            const formCreatorScore = await objective.getScore('FormCreator'); // getScore を使用

            if (formCreatorScore === 1) {
                world.sendMessage("[MyNewModule] FormCreator score is 1. Sending message.");
            } else {
                console.log("[MyNewModule] FormCreator score is not 1.");
            }
        } catch (error) {
            console.error("[MyNewModule] Error getting score for FormCreator:", error);
        }
    },
};


// プラグインとして登録 (初期状態は有効)
registerPlugin(
    "MyNewModule",
    {
        onEnable: () => {
            console.log("[MyNewModule] Plugin enabled.");
        },
        onDisable: () => {
            console.log("[MyNewModule] Plugin disabled.");
        }
    },
    true,
    async () => {
    
        await MyNewModule.checkScoreboardAndSendMessage();
    }
);
