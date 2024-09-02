import { world } from '@minecraft/server';
import { loadPlayerLanguages } from './command/langs/list/LanguageManager';
import { loadProtectedChests } from './command/plugin/chest';
import { loadGate } from './command/plugin/warpgate';
import { loadjoinModules } from './command/utility/join';
import { showBasicUI } from './command/gui/ui';
import { customCommandsConfig } from './command/itemUI';
import { c } from './Modules/Util';
import { RunAntiCheat } from './command/plugin/packet';

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
    RunAntiCheat();
    loadGate();
    loadjoinModules();
    loadPlayerLanguages();
    loadProtectedChests();
    await loadAllImports();
  } catch (error) {
    console.warn(`Error loading data: ${(error as Error).message}`);
  }

  const endTime = Date.now();
  const loadTime = endTime - startTime;
  console.warn(`Plugin has been loaded in ${loadTime} ms`);
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
    showBasicUI(player);
  }
});

console.warn('Full ChestLock Addon Data loaded!!');
