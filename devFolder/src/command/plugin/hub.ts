import { config } from '../../Modules/Util';
import { registerCommand, verifier } from '../../Modules/Handler';
import { Player, system, Vector3, world, Dimension } from '@minecraft/server';
import { translate } from '../langs/list/LanguageManager';

registerCommand({
    name: 'hub',
    description: 'hub_docs',
    parent: false,
    maxArgs: 1,
    minArgs: 0,
    require: (player: Player) => verifier(player, config().commands['hub']),
    executor: (player: Player) => {
        let countdown = 5;
        const intervalId = system.runInterval(() => {
            player.sendMessage(translate(player, "command.hub.move", { countdown: `${countdown}` }));
            countdown--;

            if (countdown < 0) {
                system.clearRun(intervalId);
                const defaultSpawn = world.getDefaultSpawnLocation();
                let teleportY = (defaultSpawn.y === undefined || defaultSpawn.y === null || defaultSpawn.y === 32767) ? 64 : defaultSpawn.y;
                let teleportLocation: Vector3 = { x: defaultSpawn.x, y: teleportY, z: defaultSpawn.z };
                const playerDimension: Dimension = player.dimension;


                // 空気ブロックを探す処理
                const maxSearchHeight = 100;
                for (let i = 0; i < maxSearchHeight; i++) {
                    const block = playerDimension.getBlock(teleportLocation); 
                    if (block && block.typeId === "minecraft:air") {
                        break; 
                    }
                    teleportLocation.y++;
                }

              
                if (teleportLocation.y - teleportY >= maxSearchHeight) {
                    teleportLocation.y = (defaultSpawn.y === undefined || defaultSpawn.y === null || defaultSpawn.y === 32767) ? 64 : defaultSpawn.y;
                }

                player.teleport(teleportLocation);
            }
        }, 20);
    },
});