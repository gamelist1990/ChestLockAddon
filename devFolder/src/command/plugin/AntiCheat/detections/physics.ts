//AntiCheat/Util/Physics.ts
import { Player, Vector3, world } from "@minecraft/server";

/**
 * Checks if the player is stuck to a wall.
 * @param {Player} player - The player to check.
 * @returns {boolean} - True if the player is stuck to a wall, false otherwise.
 */
export function isPlayerStuckToWall(player: Player): boolean {
    const playerLocation = player.location;
    const blockLocation = {
        x: Math.floor(playerLocation.x),
        y: Math.floor(playerLocation.y),
        z: Math.floor(playerLocation.z)
    };

    const directions: Vector3[] = [
        { x: 1, y: 0, z: 0 },  // East
        { x: -1, y: 0, z: 0 }, // West
        { x: 0, y: 0, z: 1 },  // South
        { x: 0, y: 0, z: -1 }  // North
    ];

    for (const direction of directions) {
        const adjacentBlock = world.getDimension("overworld").getBlock({
            x: blockLocation.x + direction.x,
            y: blockLocation.y + direction.y,
            z: blockLocation.z + direction.z
        });

        if (adjacentBlock && adjacentBlock.typeId !== "minecraft:air") {
            return true;
        }
    }

    return false;
}