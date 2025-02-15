// GameDataModule.ts
import { world, Player, system, Vector3 } from '@minecraft/server';
import { Module, moduleManager } from '../../module/module';
import { Database } from '../../module/DataBase';

// グローバル変数として速度を保持 (blocks/tick)
export const globalPlayerSpeeds: {
  [playerId: string]: {
    speed: number;        // blocks/tick
    realtimeSpeed: number; // blocks/tick
  };
} = {};


class GameDataModule implements Module {
  name = 'Speed_And_Health_Monitor';
  enabledByDefault = true;
  docs = `使用可能DB:\n
§r- §9ws_db_hp\n
§r- §9ws_db_speed`;

  private healthDb: Database;
  private speedDb: Database;

  private cachedPlayers: Player[] = [];
  private updateInterval = 20;
  private speedCalcInterval = 20; // 速度を計算する間隔 (tick)
  private lastPositionMap = new Map<string, Vector3>();
  private previousPositionMap = new Map<string, Vector3>();
  private mainIntervalId: number | undefined;
  private realtimeSpeedIntervalId: number | undefined;
  private speedCalcIntervalId: number | undefined;

  constructor() {
    this.healthDb = Database.create('ws_db_hp');
    this.speedDb = Database.create('ws_db_speed');
  }

  onEnable(): void {
    this.log('Module Enabled');
    this.cachePlayers();
    this.registerEventListeners();
    this.startMonitoring();
  }

  onInitialize(): void {
    this.cachePlayers();
    this.registerEventListeners();
    this.startMonitoring();
  }

  onDisable(): void {
    this.log('Module Disabled');
    this.unregisterEventListeners();
    this.stopMonitoring();
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
  private log(message: string): void {
    console.log(`${this.name}: ${message}`);
    world.sendMessage(`${this.name}: ${message}`);
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
    for (const player of this.cachedPlayers) {
      if (!player) continue;

      const currentPosition = player.location;
      const lastPosition = this.lastPositionMap.get(player.id);

      if (!lastPosition) {
        this.lastPositionMap.set(player.id, currentPosition);
        continue;
      }

      try {
        const dx = currentPosition.x - lastPosition.x;
        const dy = currentPosition.y - lastPosition.y;
        const dz = currentPosition.z - lastPosition.z;

        // speedCalcInterval で割らない (距離をそのまま使う)
        const speed = Math.sqrt(dx * dx + dy * dy + dz * dz);
        this.speedDb.set(player, speed); // そのまま保存（blocks/interval）

        globalPlayerSpeeds[player.id] = globalPlayerSpeeds[player.id] || {};
        globalPlayerSpeeds[player.id].speed = speed; // blocks/interval

        this.lastPositionMap.set(player.id, currentPosition);

      } catch (error) {
        console.error(`Error updating speed for player: ${player.name}: ${error}`);
      }
    }
  }

  private updateRealtimeSpeedData(): void {
    for (const player of this.cachedPlayers) {
      if (!player) continue;

      const currentPosition = player.location;
      const previousPosition = this.previousPositionMap.get(player.id);

      if (!previousPosition) {
        this.previousPositionMap.set(player.id, currentPosition);
        continue;
      }

      try {
        const dx = currentPosition.x - previousPosition.x;
        const dy = currentPosition.y - previousPosition.y;
        const dz = currentPosition.z - previousPosition.z;

        const realtimeSpeed = Math.sqrt(dx * dx + dy * dy + dz * dz); // blocks/tick

        globalPlayerSpeeds[player.id] = globalPlayerSpeeds[player.id] || {};
        globalPlayerSpeeds[player.id].realtimeSpeed = realtimeSpeed;

        this.previousPositionMap.set(player.id, currentPosition);

      } catch (error) {
        console.error(`Error updating realtime speed for player: ${player.name}: ${error}`);
      }
    }
  }
}

const gameDataModule = new GameDataModule();
moduleManager.registerModule(gameDataModule);