

import { system, world, } from '@minecraft/server';
import { ver } from './plugins/ScoreModule';


const startTime = Date.now();


async function loadAllImports() {
    try {
        await import('./module/import');
        await import('./plugins/import');
    } catch (error) {
        console.warn(`Error importing modules: ${(error as Error).message}`);
    }
}



//reload コマンド待機用
system.run(() => {
    main();
})

//ワールドの初期化処理

async function main() {
    system.runTimeout(async () => {
        try {
            await loadAllImports();
        } catch (error) {
            console.warn(`Error loading data: ${(error as Error).message}`);
        }

        const endTime = Date.now();
        const loadTime = endTime - startTime;

        world.sendMessage(`§f[§bServer§f]§l§aWebSocketAddon§6v${ver}§aのデータの更新が ${loadTime} msで完了しました`)


    }, 1)
}
