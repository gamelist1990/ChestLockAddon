import { system, world } from '@minecraft/server';


class TickEvent {
    subscriptions = {};
    lastTickDate;
    deltaTime = 0;
    currentTick = 0;
    tickCheck;
    avgDeltaTime = [];
    tps = 20;
    isTicking = false;
    __checkTicks() {
        if (this.isTicking)
            return;
        this.isTicking = true;
        this.tickCheck = () => {
            const lastTickDate = this.lastTickDate ?? Date.now();
            this.currentTick++;
            this.deltaTime = Date.now() - lastTickDate;
            this.avgDeltaTime.push(this.deltaTime);
            if (this.avgDeltaTime.length > 100) {
                this.avgDeltaTime.shift();
            }
            this.tps = Math.round((1 / (this.avgDeltaTime.reduce((t, c) => t + c) / this.avgDeltaTime.length / 1000)) * 10) / 10;
            this.lastTickDate = Date.now();
            if (Object.keys(this.subscriptions).length > 0 && this.isTicking && this.tickCheck) {
                system.run(this.tickCheck);
            }
            else {
                this.isTicking = false;
                this.tickCheck = undefined;
                this.lastTickDate = undefined;
            }
        };
        system.run(this.tickCheck);
    }
    subscribe(key, callback) {
        if (!this.isTicking) {
            this.__checkTicks();
        }
        this.subscriptions[key] = () => {
            callback({
                deltaTime: this.deltaTime,
                currentTick: this.currentTick,
                tps: this.tps,
            });
            if (this.isTicking) {
                system.run(this.subscriptions[key]);
            }
        };
        if (this.isTicking) {
            system.run(this.subscriptions[key]);
        }
    }
    unsubscribe(key) {
        if (this.subscriptions[key]) {
            this.subscriptions[key] = () => { };
            system.run(() => {
                delete this.subscriptions[key];
            });
            if (Object.keys(this.subscriptions).length === 0) {
                this.isTicking = false;
            }
        }
    }
}
export const tickEvent = new TickEvent();


let tps = 20;
updateTpsScoreboard(tps);


console.log("WebSocket Addon Loaded");


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
    console.log("updateTps")
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
