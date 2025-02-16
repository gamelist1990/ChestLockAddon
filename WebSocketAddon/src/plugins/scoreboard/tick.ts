import { system } from '@minecraft/server';

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
        if (!this.isTicking) { // isTicking が false の場合のみ __checkTicks を呼び出す
            this.__checkTicks();
        }

        this.subscriptions[key] = () => {
            callback({
                deltaTime: this.deltaTime,
                currentTick: this.currentTick,
                tps: this.tps,
            });

            if (this.isTicking) {  // isTicking が true の場合のみ再スケジュール
                system.run(this.subscriptions[key]);
            }
        };

        if (this.isTicking) { // isTicking が true の場合のみ初回実行をスケジュール
            system.run(this.subscriptions[key]);
        }
    }

    /**
     * Unsubscribes from the tick event.
     * @param key The key of the subscription to remove.
     */
    unsubscribe(key: string): void {

        if (this.subscriptions[key]) { // unsubscribe しようとしている key が存在する場合のみ
            this.subscriptions[key] = () => { }; // 空の関数に置き換え
            system.run(() => {
                delete this.subscriptions[key];
            });


            if (Object.keys(this.subscriptions).length === 0) {
                this.isTicking = false; // サブスクリプションが0になったら ticking を停止
            }
        }
    }
}

export const tickEvent = new TickEvent();