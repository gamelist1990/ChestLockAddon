import {
    world,
    system,
    PlayerJoinAfterEvent,
} from '@minecraft/server';
import { Module, moduleManager } from '../../module/module';

class PlayerJoinLeaveModule implements Module {
    name = 'JoinEvent';
    enabledByDefault = true;
    docs = `プレイヤーがワールドに参加時に発火\n
**機能**\n
§r- 参加時のタグ:\n
  §r  - §9w:join§r: 参加タグ\n
  §r  - §9w:join_cancel§r: 参加拒否タグ\n
§r- タグは自動削除(デフォルト20tick後)。`;


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
            if (player.hasTag(`w:join_cancel`)) {
                player.runCommand(`kick ${playerName} §l§f[§cError§f]§r\n\n§c§6サーバーにより参加が拒否されました。`);
            }
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