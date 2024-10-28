import { world,} from "@minecraft/server";




world.afterEvents.worldInitialize.subscribe(async () => {
  try {
    await import("../../scripts/LBAPI/vendor/autoload.js");

  } catch (error) {
    console.warn(`Error loading data: ${(error as Error).message}`);
  }
});