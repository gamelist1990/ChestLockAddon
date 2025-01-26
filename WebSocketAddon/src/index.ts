import { world, system } from '@minecraft/server';

interface TickEventData {
    deltaTime: number;
    currentTick: number;
    tps: number;
}

/**
 * @author mrpatches123
 * @license MIT
 */

class TickEvent {
    private subscriptions: { [key: string]: () => void } = {};
    private lastTickDate?: number;
    private deltaTime: number = 0;
    private currentTick: number = 0;
    private tickCheck?: () => void;
    private avgDeltaTime: number[] = [];
    private tps: number = 20;
    private isTicking: boolean = false;

    private __checkTicks(): void {
        if (this.isTicking) return;
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
            } else {
                this.isTicking = false;
                this.tickCheck = undefined;
                this.lastTickDate = undefined;
            }
        };

        system.run(this.tickCheck);
    }

    /**
     * Subscribes to the tick event.
     * @param key A unique key for the subscription.
     * @param callback The function to call on each tick.
     */
    subscribe(key: string, callback: (data: TickEventData) => void): void {
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

    /**
     * Unsubscribes from the tick event.
     * @param key The key of the subscription to remove.
     */
    unsubscribe(key: string): void {
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

console.log("WebSocket Addon Loaded");


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