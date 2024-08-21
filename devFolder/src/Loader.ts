// main.js
import { world } from "@minecraft/server";
import { loadPlayerLanguages } from "./command/langs/list/LanguageManager"; 
import { loadProtectedChests } from "./command/chest"; 

world.afterEvents.worldInitialize.subscribe(() => {
  loadPlayerLanguages();
  loadProtectedChests();

  console.warn("Full data has been loaded");
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
