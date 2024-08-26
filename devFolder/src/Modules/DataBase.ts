import { world } from '@minecraft/server';

interface ChestLockAddonData {
  [key: string]: any;
}

export let chestLockAddonData: ChestLockAddonData = {};

// データの保存・更新関数
export function saveData(key: string, value: any): void {
  chestLockAddonData[key] = value;
  const data = JSON.stringify(chestLockAddonData);
  world.setDynamicProperty("ChestLockAddonData", data);
}

// データの読み込み関数
export function loadData(): void {
  const data = world.getDynamicProperty("ChestLockAddonData");
  if (data && typeof data === 'string') {
    chestLockAddonData = JSON.parse(data);
  }
}

// データの出力関数
export function logData(): void {
  console.warn(JSON.stringify(chestLockAddonData, null, 2));
}


export function resetData(): void {
  chestLockAddonData = {};
  console.warn("ChestLockAddon Data reset")
}