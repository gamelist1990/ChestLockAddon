// main.js
import { world } from "@minecraft/server";
import { loadPlayerLanguages } from "./command/langs/list/LanguageManager"; 

world.afterEvents.worldInitialize.subscribe(() => {
  loadPlayerLanguages();
  console.warn("Player languages data has been loaded");
});

import './Handler'; 
import './command/chest';
import './command/help';
import './command/langs/lang';
import './command/dev';
import './Util'; 

console.warn("Plugin has been Loaded");
