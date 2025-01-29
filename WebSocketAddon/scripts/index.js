import { world } from '@minecraft/server';
import { tickEvent } from "./tick"




let tps = 20;

world.beforeEvents.chatSend.subscribe((event) => {
    const { message, sender } = event;
    updateTpsScoreboard(tps);

    console.log(`[chatSend] ${sender.name}: ${message}`);

    if (sender.hasTag("fix_a") && message.startsWith("#")) {
        console.log("fix_Com");
        event.cancel = true;
        system.run(() => {
            sender.runCommand(`tellraw @a {"rawtext":[{"text":"<${sender.name}> ${message}"}]}`);
        });
    }

    if (message.startsWith("#")) return;
    if (sender.hasTag("bypass_chatSend")) return;
});

// スコアボードを更新するための関数
function updateTpsScoreboard(data) {
    try {
        let objective = world.scoreboard.getObjective('TPSData');
        if (objective) {
            objective.setScore("tps", data);
        }
    } catch (error) {
        console.warn("Error updating TPS scoreboard:", error);
    }
}


if (tickEvent) {
    tickEvent.subscribe("tick", (data) => {
        tps = data.tps;
    });
}

system.runInterval(() => {
    updateTpsScoreboard(tps);
}, 20 * 3)



console.log("WebSocket Addon Loaded");
