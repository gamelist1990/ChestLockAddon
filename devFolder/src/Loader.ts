import { world } from '@minecraft/server';
import { loadPlayerLanguages } from './command/langs/list/LanguageManager';
import { loadProtectedChests } from './command/plugin/chest';
import { loadGate } from './command/plugin/warpgate';
import { loadjoinModules } from './command/utility/join';
import { showBasicUI } from './command/gui/ui';
import { customCommandsConfig } from './command/itemUI';
import { c } from './Modules/Util';
import { loadData } from './Modules/DataBase';
//import { RunAntiCheat } from './command/plugin/packet';

const startTime = Date.now();



async function loadAllImports() {
  try {
    await import('./command/import');
    await import('./Modules/import');
  } catch (error) {
    console.warn(`Error importing modules: ${(error as Error).message}`);
  }
}

world.afterEvents.worldInitialize.subscribe(async () => {
  try {
    loadPlayerLanguages();
    loadData();
    //RunAntiCheat();
    loadGate();
    loadjoinModules();
    loadProtectedChests();
    await loadAllImports();
  } catch (error) {
    console.warn(`Error loading data: ${(error as Error).message}`);
  }

  const endTime = Date.now();
  const loadTime = endTime - startTime;
  if (c().module.debugMode.enabled === true) {
    console.warn(`Plugin has been loaded in ${loadTime} ms`);
  }
  world.sendMessage(`§f[§bServer§f]§l§aChestLockAddonのデータの更新が ${loadTime} msで完了しました`)
});

//Custom Item
world.afterEvents.itemUse.subscribe(({ itemStack: item, source: player }) => {
  if (player.typeId !== 'minecraft:player') return;

  if (
    c().commands.item.enabled &&
    item.typeId === customCommandsConfig.ui.ui_item &&
    item.nameTag === customCommandsConfig.ui.ui_item_name &&
    !c().commands.item.requireTag.some((tag) => !player.hasTag(tag))
  ) {
    if (c().module.debugMode.enabled === true) {
      console.warn(`${player.name} has Use ShowUI`);
    }
    showBasicUI(player);
  }
});


if (c().module.debugMode.enabled === true) {
  console.warn('Full ChestLock Addon Data loaded!!');

}