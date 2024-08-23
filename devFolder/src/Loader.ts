// main.js
import { world } from "@minecraft/server";
import { loadPlayerLanguages } from "./command/langs/list/LanguageManager"; 
import { loadProtectedChests } from "./command/chest";
import { showBasicUI } from './command/gui/ui';
import { customCommandsConfig } from './command/itemUI';
import { c } from './Modules/Util';


world.afterEvents.worldInitialize.subscribe(() => {
  loadPlayerLanguages();
  loadProtectedChests();

  console.warn("Full data has been loaded");
});

world.afterEvents.itemUse.subscribe(({ itemStack: item, source: player }) => {
  if (player.typeId !== "minecraft:player") return;

  if (c().commands.item.enabled && item.typeId === customCommandsConfig.ui.ui_item && item.nameTag === customCommandsConfig.ui.ui_item_name && !c().commands.item.requireTag.some(tag => !player.hasTag(tag))) {
    showBasicUI(player);
  }
});

//Command
import './command/chest';
import './command/help';
import './command/dev';
import './command/jpch';
import './command/openUI';
import './command/packet';
import './command/list';
import './command/tpa';
import './command/itemUI';


//lang
import './command/langs/lang';


//GUI
import './command/gui/ui';


//Modules
import './Modules/Handler'; 
import './Modules/Util';
import './Modules/version'; 


console.warn("Plugin has been Loaded");
