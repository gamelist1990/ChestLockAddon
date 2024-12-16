import { system, world, } from '@minecraft/server';
import { loadPlayerLanguages } from './command/langs/list/LanguageManager';
import { loadProtectedChests } from './command/plugin/chest';
import { loadGate } from './command/plugin/warpgate';
import { loadjoinModules } from './command/utility/join';
import { showBasicUI } from './command/gui/ui';
import { customCommandsConfig } from './command/itemUI';
import { config, tempkick } from './Modules/Util';
import { loadData } from './Modules/DataBase';
import { banPlayers } from './Modules/globalBan';
import { loadReport } from './command/utility/report';
import { ver } from './Modules/version';
import { AddNewPlayers, initializeAntiCheat } from './command/plugin/AntiCheat/index';
import { loadBan } from './command/utility/ban';

const startTime = Date.now();





async function loadAllImports() {
  try {
    await import('./command/import');
    await import('./Modules/import');
  } catch (error) {
    console.warn(`Error importing modules: ${(error as Error).message}`);
  }
}



world.afterEvents.worldInitialize.subscribe(()=>{
  main();
})

//ワールドの初期化処理

async function main() {
  system.runTimeout(async () => {
    try {
      loadPlayerLanguages();
      loadData();
      loadReport();
      //AntiCheat    //
      initializeAntiCheat();
      AddNewPlayers();
      //_____________//
      loadGate();
      loadBan();
      loadjoinModules();
      loadProtectedChests();
      await loadAllImports();
    } catch (error) {
      console.warn(`Error loading data: ${(error as Error).message}`);
    }

    const endTime = Date.now();
    const loadTime = endTime - startTime;
    if (config().module.debugMode.enabled === true) {
      console.warn(`Plugin has been loaded in ${loadTime} ms`);
    }

    world.sendMessage(`§f[§bServer§f]§l§aChestLockAddonのデータの更新が ${loadTime} msで完了しました`)


  }, 1)
}



//Custom Item
world.afterEvents.itemUse.subscribe(({ itemStack: item, source: player }) => {
  if (player.typeId !== 'minecraft:player') return;

  if (
    config().commands.item.enabled &&
    item.typeId === customCommandsConfig.ui.ui_item &&
    item.nameTag === customCommandsConfig.ui.ui_item_name &&
    !config().commands.item.requireTag.some((tag) => !player.hasTag(tag))
  ) {
    if (config().module.debugMode.enabled === true) {
      console.warn(`${player.name} has Use ShowUI`);
    }
    showBasicUI(player);
  }
});


world.afterEvents.playerSpawn.subscribe((event: any) => {
  const { player } = event;

  //globalBAN

  system.runTimeout(() => {
    if (player) {
      const playerXuid = player.id;
      const isBanned = banPlayers.some((bannedPlayer) => bannedPlayer.id === playerXuid);
      if (isBanned) {
        tempkick(player);
      }
    }
  }, 20);
});

if (config().module.debugMode.enabled === true) {
  console.warn(`Full ChestLock Addon Data loaded!! Version${ver}`);

}

