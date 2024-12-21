import { world } from '@minecraft/server';
import { config } from './Util';

interface ChestLockAddonData {
  [key: string]: any;
}

export let chestLockAddonData: ChestLockAddonData = {};

/**
 * Saves data to the chestLockAddonData object and updates the dynamic property in the world.
 *
 * @param key - The key under which the value will be stored.
 * @param value - The value to be stored.
 */
export function saveData(key: string, value: any): void {
  chestLockAddonData[key] = value;
  const data = JSON.stringify(chestLockAddonData);
  world.setDynamicProperty('ChestLockAddonData', data);
}


/**
 * Loads the ChestLockAddon data from the dynamic property in the world.
 * The data is expected to be a JSON string which is parsed into an object.
 * If the data contains a `timestamp` key with a numeric value, it is converted to a Date object.
 *
 * @throws {SyntaxError} If the JSON string is malformed.
 */
export function loadData(): void {
  const data = world.getDynamicProperty('ChestLockAddonData');
  if (data && typeof data === 'string') {
    chestLockAddonData = JSON.parse(data, (key, value) => {
      if (typeof value === 'number' && key === 'timestamp') {
        return new Date(value);
      }
      return value;
    });
  }
}

// データの出力関数
export function logData(): void {
  console.warn(JSON.stringify(chestLockAddonData, null, 2));
}

// ResetData (データ破損時用)
export function resetData(): void {
  chestLockAddonData = {};
  if (config().module.debugMode.enabled === true) {
    console.warn('ChestLockAddon Data reset');
  }

  world.sendMessage("§l§eWarn §aChestLockAddon DataBase is Reset");
}

// データのキーを出力する関数
export function logKeys(): void {
  const keys = Object.keys(chestLockAddonData);
  if (keys.length === 0) {
    console.warn('ChestLockAddon Data: No keys are currently registered.');
    return;
  }
  console.warn('ChestLockAddon Data Keys:');
  keys.forEach(key => console.warn(` - ${key}`));
}