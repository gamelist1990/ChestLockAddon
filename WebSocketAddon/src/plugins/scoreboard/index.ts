// GameDataModule.ts
import { world, Player, system, Vector3 } from '@minecraft/server';
import { Module, moduleManager } from '../../module/module';
import { Database } from '../../module/DataBase';
import { tickEvent } from './tick';

export const globalPlayerSpeeds: {
  [playerId: string]: {
    speed: number;
    realtimeSpeed: number;
  };
} = {};


class GameDataModule implements Module {
  name = 'scoreboard';
  enabledByDefault = true;
  docs = `使用可能DB:\n
§r- §9ws_db_hp\n
§r- §9ws_db_speed\n
§r- §9ws_db_tps\n
§r- §9ws_db_lag`;

  private healthDb: Database;
  private speedDb: Database;
  private tpsDb: Database;
  private lagDb: Database; // ラグデータ用の Database

  private cachedPlayers: Player[] = [];
  private updateInterval = 20;
  private speedCalcInterval = 20;
  private lastPositionMap = new Map<string, Vector3>();
  private previousPositionMap = new Map<string, Vector3>();
  private mainIntervalId: number | undefined;
  private realtimeSpeedIntervalId: number | undefined;
  private speedCalcIntervalId: number | undefined;


  constructor() {
    this.healthDb = Database.create('ws_db_hp');
    this.speedDb = Database.create('ws_db_speed');
    this.tpsDb = Database.create('ws_db_tps');
    this.lagDb = Database.create('ws_db_lag'); // ラグデータ用の Database を作成
  }

  onEnable(): void {
    this.cachePlayers();
    this.registerEventListeners();
    this.startMonitoring();
    this.subscribeToTickEvent();
  }

  onInitialize(): void {
    this.cachePlayers();
    this.registerEventListeners();
    this.startMonitoring();
    this.subscribeToTickEvent();
  }

  onDisable(): void {
    this.unregisterEventListeners();
    this.stopMonitoring();
    this.unsubscribeFromTickEvent();
  }

  private registerEventListeners(): void {
    world.afterEvents.playerSpawn.subscribe(() => this.cachePlayers());
    world.afterEvents.playerLeave.subscribe(() => this.clearPlayerCache());
  }

  private unregisterEventListeners(): void {
    world.afterEvents.playerSpawn.unsubscribe(() => this.cachePlayers());
    world.afterEvents.playerLeave.unsubscribe(() => this.clearPlayerCache());
  }

  private cachePlayers(): void {
    this.cachedPlayers = Array.from(world.getAllPlayers());
    for (const player of this.cachedPlayers) {
      this.lastPositionMap.set(player.id, player.location);
      this.previousPositionMap.set(player.id, player.location);
    }
  }

  private clearPlayerCache(): void {
    this.cachedPlayers = Array.from(world.getAllPlayers());
    for (const playerId of this.lastPositionMap.keys()) {
      if (!this.cachedPlayers.some((p) => p.id === playerId)) {
        this.lastPositionMap.delete(playerId);
        this.previousPositionMap.delete(playerId);
        delete globalPlayerSpeeds[playerId];
      }
    }
  }
 

  private startMonitoring(): void {
    this.mainIntervalId = system.runInterval(() => {
      this.updateHealthData();
    }, this.updateInterval);

    this.realtimeSpeedIntervalId = system.runInterval(() => {
      this.updateRealtimeSpeedData();
    }, 1);

    this.speedCalcIntervalId = system.runInterval(() => {
      this.updatePositionAndSpeedData();
    }, this.speedCalcInterval);
  }

  private stopMonitoring(): void {
    if (this.mainIntervalId !== undefined) system.clearRun(this.mainIntervalId);
    if (this.realtimeSpeedIntervalId !== undefined) system.clearRun(this.realtimeSpeedIntervalId);
    if (this.speedCalcIntervalId !== undefined) system.clearRun(this.speedCalcIntervalId);

    this.mainIntervalId = undefined;
    this.realtimeSpeedIntervalId = undefined;
    this.speedCalcIntervalId = undefined;

  }

  private updateHealthData(): void {
    for (const player of this.cachedPlayers) {
      if (!player) continue;

      try {
        const healthComponent = player.getComponent('health');
        if (!healthComponent) {
          console.warn(`Health component not found for player: ${player.name}`);
          continue;
        }
        this.healthDb.set(player, healthComponent.currentValue);
      } catch (error) {
        console.error(`Error updating health for player: ${player.name}: ${error}`);
      }
    }
  }

  private updatePositionAndSpeedData(): void {
    system.run(() => {
      for (const player of world.getAllPlayers()) {
        if (!player) continue;

        const currentPosition = player.location;
        const lastPosition = this.lastPositionMap.get(player.id);

        if (!currentPosition) continue;

        if (!lastPosition) {
          this.lastPositionMap.set(player.id, currentPosition);
          continue;
        }

        try {
          const dx = currentPosition.x - lastPosition.x;
          const dy = currentPosition.y - lastPosition.y;
          const dz = currentPosition.z - lastPosition.z;

          const speed = Math.sqrt(dx * dx + dy * dy + dz * dz);
          this.speedDb.set(player, speed);

          globalPlayerSpeeds[player.id] = globalPlayerSpeeds[player.id] || {};
          globalPlayerSpeeds[player.id].speed = speed;

          this.lastPositionMap.set(player.id, currentPosition);

        } catch (error) {
          console.error(`Error updating speed for player: ${player.name}: ${error}`);
        }
      }
    })

  }

  private updateRealtimeSpeedData(): void {
    system.run(() => {
      for (const player of world.getAllPlayers()) {
        if (!player) continue;

        const currentPosition = player.location;
        const previousPosition = this.previousPositionMap.get(player.id);

        if (!currentPosition) continue;

        if (!previousPosition) {
          this.previousPositionMap.set(player.id, currentPosition);
          continue;
        }

        try {
          const dx = currentPosition.x - previousPosition.x;
          const dy = currentPosition.y - previousPosition.y;
          const dz = currentPosition.z - previousPosition.z;

          const realtimeSpeed = Math.sqrt(dx * dx + dy * dy + dz * dz);

          globalPlayerSpeeds[player.id] = globalPlayerSpeeds[player.id] || {};
          globalPlayerSpeeds[player.id].realtimeSpeed = realtimeSpeed;

          this.previousPositionMap.set(player.id, currentPosition);

        } catch (error) {
          console.error(`Error updating realtime speed for player: ${player.name}: ${error}`);
        }
      }
    })
  }

  private subscribeToTickEvent(): void {
    tickEvent.subscribe('tps', (data: any) => {
      if (data.tps >= 20) {
        this.updateTPSData(20);
      }
      if (data.tps <= 20) {
        this.updateTPSData(data.tps);
      }
    });
  }


  private unsubscribeFromTickEvent(): void {
    tickEvent.unsubscribe('tps');
  }


  private updateTPSData(tps: number): void {
    try {
      this.tpsDb.set("tps", tps);

      if (tps === undefined || isNaN(tps)) {  // NaN チェックを追加
        console.warn("Invalid TPS value:", tps); // 無効な値の場合は警告
        return; // 何もせずに終了
      }


      const allMessages = [
        "§a通常§r",
        "§eちょいラグい§r",
        "§gかなりラグい§r",
        "§cめちゃラグい§r",
        "§dラグさ上限突破！！§r",
      ];
      let currentMessage = "";


      if (tps >= 20) {
        currentMessage = "§a通常§r";
      } else if (tps > 15) {
        currentMessage = "§eちょいラグい§r";
      } else if (tps > 10) {
        currentMessage = "§gかなりラグい§r";
      } else if (tps > 5) {
        currentMessage = "§cめちゃラグい§r";
      } else {
        currentMessage = "§dラグさ上限突破！！§r";
      }

      for (const message of allMessages) {
        if (message !== currentMessage) {
          this.lagDb.delete(message);
        }
      }
      this.lagDb.set(currentMessage, 0);

    } catch (error) {
      console.error(`Error updating TPS: ${error}`);
    }
  }
}

const gameDataModule = new GameDataModule();
moduleManager.registerModule(gameDataModule);