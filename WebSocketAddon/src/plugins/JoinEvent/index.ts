import {
    world,
    system,
    PlayerJoinAfterEvent,
} from '@minecraft/server';
import { Module, moduleManager } from '../../module/module';

class PlayerJoinLeaveModule implements Module {
    name = 'PlayerJoinLeave_Manager';
    enabledByDefault = true;
    docs = `プレイヤーの参加/退出を記録します。\n`;


    constructor() {
    }


    onEnable(): void {
        this.registerEventListeners();
    }
    onInitialize(): void {
        this.registerEventListeners();

    }

    onDisable(): void {
        this.unregisterEventListeners();
    }

    private registerEventListeners(): void {
        world.afterEvents.playerJoin.subscribe(this.handlePlayerJoin);
    }


    private unregisterEventListeners(): void {
        world.afterEvents.playerJoin.unsubscribe(this.handlePlayerJoin);
    }

    /**
     * プレイヤーが参加したときの処理
     */
    private handlePlayerJoin = (event: PlayerJoinAfterEvent) => {
        const { playerName } = event;
        for (const player of world.getAllPlayers()) {
            if (player.name === playerName) {
                player.addTag('w:join');
            }
        }

        system.runTimeout(() => {
            for (const player of world.getAllPlayers()) {
                if (player.name === playerName) {
                    player.removeTag('w:join');
                }
            }
        }, 20);
    };
}


const playerJoinLeaveModule = new PlayerJoinLeaveModule();
moduleManager.registerModule(playerJoinLeaveModule);