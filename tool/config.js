import path from 'path';
import os from 'os';

const minecraftDataPath = path.join(
    os.homedir(),
    'AppData',
    'Local',
    'Packages',
    'Microsoft.MinecraftUWP_8wekyb3d8bbwe',
    'LocalState',
    'games',
    'com.mojang'
);

const config = {
    path: "./devFolder/scripts/devFolder/src",
    copyToPath: `${minecraftDataPath}/minecraftWorlds/q8TN2gMlvaE=/behavior_packs/createAddon/scripts`

};

export default config;