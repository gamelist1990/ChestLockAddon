// main.js
import { world } from "@minecraft/server";
import { loadPlayerLanguages } from "./command/langs/list/LanguageManager"; 

world.afterEvents.worldInitialize.subscribe(() => {
  loadPlayerLanguages();
  console.warn("Player languages data has been loaded");
});

//Command
import './command/chest';
import './command/help';
import './command/dev';
import './command/test';
import './command/openUI';

//lang
import './command/langs/lang';


//GUI
import './command/gui/ui';


//Modules
import './Handler'; 
import './Util'; 

console.warn("Plugin has been Loaded");
