import World from 'socket-be/typings/structures/World';
import {
    registerCommand,
    MINECRAFT_COMMAND_PREFIX,
} from '../index';

interface AnticheatState {
    v1: { enabled: boolean; noclip: boolean };
    v2: { enabled: boolean };
}

let anticheatState: AnticheatState = {
    v1: { enabled: false, noclip: false },
    v2: { enabled: false },
};

// v1 commands
const anticheatV1Commands = [
    `/execute as @a[tag=ac:speed] at @s positioned ~ ~ ~ run summon armor_stand ac:speed_check_B ~ 1000 ~`,
    `/execute as @a[tag=ac:speed,m=c] at @s positioned ~ ~ ~ run execute as @e[type=armor_stand,name=ac:speed_check_B] at @s positioned ~ ~ ~ run execute as @e[type=armor_stand,name=ac:speed_check_A,rm=3.27] at @s positioned ~ ~ ~ run /tag @a[tag=ac:speed,tag=!ac:nsc] add ac:speed_out`,
    `/execute as @a[tag=ac:speed,m=!c] at @s positioned ~ ~ ~ run execute as @e[type=armor_stand,name=ac:speed_check_B] at @s positioned ~ ~ ~ run execute as @e[type=armor_stand,name=ac:speed_check_A,rm=1.21] at @s positioned ~ ~ ~ run /tag @a[tag=ac:speed,tag=!ac:nsc] add ac:speed_out`,
    `/execute as @a[tag=ac:speed_out] at @s positioned ~ ~ ~ run /tellraw @a {"rawtext":[
    {"text":"§4§l===[ 警告: AntiCheat ]===\n\n"},
    {"text":"§cプレイヤー: §e"},
    {"selector":"@s"},
    {"text":" §cに不正行為の疑いがあります\n\n"},
    {"text":"§eモード: §6v1\n\n"},
    {"text":"§4§l===[ 警告: AntiCheat ]===\n"}]}`,
    `/tag @a remove ac:nsc`,
    `/tag @a[m=survival,m=adventure,tag=ac:speed_out] add ac:nsc`,
    `/execute as @a[tag=ac:speed_out] at @s positioned ~ ~ ~ run execute as @e[type=armor_stand,name=ac:speed_check_E] at @s positioned ~ ~ ~ run /summon armor_stand ac:speed_check_F ~ ~-1000 ~`,
    `/execute as @a[tag=ac:speed_out] at @s positioned ~ ~ ~ run execute as @e[type=armor_stand,name=ac:speed_check_C] at @s positioned ~ ~ ~ run /tp @a[tag=ac:speed_out] ~ ~-1000 ~ facing @e[type=armor_stand,name=ac:speed_check_F]`,
    `/tp @e[type=armor_stand,name=ac:speed_check_F] ~ -100 ~`,
    `/tag @a remove ac:speed_out`,
    `/tag @a remove ac:speed`,
    `/kill @e[type=armor_stand,name=ac:speed_check_A]`,
    `/kill @e[type=armor_stand,name=ac:speed_check_B]`,
    `/tag @r[m=survival,m=adventure] add ac:speed`,
    `/execute as @a[tag=ac:speed] at @s positioned ~ ~ ~ run /summon armor_stand ac:speed_check_A ~ 1000 ~`,
    `/kill @e[type=armor_stand,name=ac:speed_check_C]`,
    `/kill @e[type=armor_stand,name=ac:speed_check_E]`,
    `/execute as @a[tag=ac:speed] at @s positioned ~ ~ ~ run /summon armor_stand ac:speed_check_C ~ ~1000 ~`,
    `/execute as @a[tag=ac:speed] at @s positioned ~ ~ ~ run /summon armor_stand ac:speed_check_D ^^^20`,
    `/execute as @e[type=armor_stand,name=ac:speed_check_D] at @s positioned ~ ~ ~ run /summon armor_stand ac:speed_check_E ~~1000~`,
    `/execute as @e[type=armor_stand,name=ac:speed_check_D] at @s positioned ~ ~ ~ run /tp @s ~ -100 ~`,
    `/execute as @e[type=armor_stand,name=ac:speed_check_A] at @s positioned ~ ~ ~ run /tp @s ~ 1000 ~`,
    `/execute as @e[type=armor_stand,name=ac:speed_check_B] at @s positioned ~ ~ ~ run /tp @s ~ 1000 ~`,
    `/execute as @e[type=armor_stand,name=ac:speed_check_C] at @s positioned ~ ~ ~ run /tp @s @s`,
    `/execute as @e[type=armor_stand,name=ac:speed_check_E] at @s positioned ~ ~ ~ run /tp @s @s`,
    `/execute as @a[rxm=0,rx=0] at @s positioned ~ ~ ~ run /tag @s add ac:nsc`,
    `/execute as @a[rxm=0,rx=0] at @s positioned ~ ~ ~ run /tp @s ~~~~ 1`,
];


const noclipDetectionBlocks = [
    "grass",
    "dirt",
    "stone",
    "bedrock",
];

function generateNoclipDetectionCommands(blocks: string[]): string[] {
    const commands: string[] = [];
    blocks.forEach(block => {
        commands.push(`/execute as @a[m=!spectator] at @s if block ~~~ ${block} run /tag @s add ac:noclip`);
    });
    return commands;
}

const anticheatV1NoclipCommands = [
    `/execute as @a[tag=ac:noclip] at @s run /spreadplayers ~~ 0 1 @s`,
    `/execute as @a[tag=ac:noclip] at @s run /tp @s ~~~`,
    `/execute as @a[tag=ac:noclip] at @s run /tellraw @a {"rawtext":[{"text":"§c[AC] §l§f"},{"selector":"@s"},{"text":" §r§cがNoClipを使用している可能性があります。(v1)"}]}`,
    `/tag @a remove ac:noclip`,
    ...generateNoclipDetectionCommands(noclipDetectionBlocks),
];

const anticheatV2Commands = [
    `/execute as @a[tag=ac:noclip] at @s run /spreadplayers ~~ 0 1 @s`,
    `/execute as @a[tag=ac:noclip] at @s run /tp @s ~~~`,
    `/execute as @a[tag=ac:noclip] at @s run /tellraw @a {"rawtext":[{"text":"§c[AC] §l§f"},{"selector":"@s"},{"text":" §r§cがNoClipを使用している可能性があります。(v2)"}]}`,
    `/tag @a remove ac:noclip`,
    ...generateNoclipDetectionCommands(noclipDetectionBlocks),
];

async function switchAnticheatMode(world: World, mode: "v1" | "v2" | "v1noclip", enabled?: boolean): Promise<string> {
    if (enabled === undefined) {
        if (mode === "v1") {
            anticheatState.v1.enabled = !anticheatState.v1.enabled;
        } else if (mode === "v2") {
            anticheatState.v2.enabled = !anticheatState.v2.enabled;
        } else if (mode === "v1noclip") {
            anticheatState.v1.noclip = !anticheatState.v1.noclip;
        }
    } else {
        if (mode === "v1") {
            anticheatState.v1.enabled = enabled;
        } else if (mode === "v2") {
            anticheatState.v2.enabled = enabled;
        } else if (mode === "v1noclip") {
            anticheatState.v1.noclip = enabled;
        }
    }

    if (anticheatState.v1.enabled && anticheatState.v2.enabled) {
        if (mode === "v1") {
            anticheatState.v2.enabled = false;
        } else if (mode === "v2") {
            anticheatState.v1.enabled = false;
            anticheatState.v1.noclip = false; 
        }
    }

    if (mode === "v1" || mode === "v1noclip") {
        if (anticheatState.v1.enabled) {
            world.sendMessage(`アンチチート v1 を実行しています...`);
            for (const command of anticheatV1Commands) {
                try {
                    await world.runCommand(command);
                } catch (error) {
                    console.error(`コマンド実行エラー: ${command}`, error);
                }
            }
            if (anticheatState.v1.noclip) {
                world.sendMessage(`アンチチート v1 Noclip オプションを有効化しています...`);
                for (const command of anticheatV1NoclipCommands) {
                    try {
                        await world.runCommand(command);
                    } catch (error) {
                        console.error(`コマンド実行エラー: ${command}`, error);
                    }
                }
            }
        } else {
            //一応停止処理をする
            world.sendMessage(`アンチチート v1 を停止しています...`);
            try {
                await world.runCommand(`/tag @a remove ac:speed`);
                await world.runCommand(`/kill @e[type=armor_stand,name=ac:speed_check_A]`);
                await world.runCommand(`/kill @e[type=armor_stand,name=ac:speed_check_B]`);
                await world.runCommand(`/kill @e[type=armor_stand,name=ac:speed_check_C]`);
                await world.runCommand(`/kill @e[type=armor_stand,name=ac:speed_check_D]`);
                await world.runCommand(`/kill @e[type=armor_stand,name=ac:speed_check_E]`);
                await world.runCommand(`/kill @e[type=armor_stand,name=ac:speed_check_F]`);
            } catch (error) {
                console.error(`コマンド実行エラー:`, error);
            }
            if (!anticheatState.v1.enabled) {
                anticheatState.v1.noclip = false;
                try {
                    await world.runCommand(`/tag @a remove ac:noclip`);
                } catch (error) {
                    console.error(`コマンド実行エラー:`, error);
                }
            }
        }
    }

    if (mode === "v2") {
        if (anticheatState.v2.enabled) {
            world.sendMessage(`アンチチート v2 (Noclip) を実行しています...`);
            for (const command of anticheatV2Commands) {
                try {
                    await world.runCommand(command);
                } catch (error) {
                    console.error(`コマンド実行エラー: ${command}`, error);
                }
            }
        } else {
            world.sendMessage(`アンチチート v2 (Noclip) を停止しています...`);
            try {
                await world.runCommand(`/tag @a remove ac:noclip`);
            } catch (error) {
                console.error(`コマンド実行エラー:`, error);
            }
        }
    }


    let message = "";
    if (mode === "v1") {
        message = `アンチチートモード 'v1' を ${anticheatState.v1.enabled ? '有効' : '無効'} にしました。`;
        if (anticheatState.v1.enabled && anticheatState.v1.noclip) {
            message += ` (Noclip: ${anticheatState.v1.noclip ? '有効' : '無効'})`;
        }
    } else if (mode === "v2") {
        message = `アンチチートモード 'v2' (Noclip) を ${anticheatState.v2.enabled ? '有効' : '無効'} にしました。`;
    } else if (mode === "v1noclip") {
        message = `アンチチート v1 の Noclip オプションを ${anticheatState.v1.noclip ? '有効' : '無効'} にしました。`;
    }

    return message;
}

function getActiveAnticheatMode(): { mode: "v1" | "v2" | null; noclip: boolean } {
    if (anticheatState.v1.enabled) {
        return { mode: "v1", noclip: anticheatState.v1.noclip };
    } else if (anticheatState.v2.enabled) {
        return { mode: "v2", noclip: true };
    } else {
        return { mode: null, noclip: false };
    }
}

registerCommand('anticheat', `${MINECRAFT_COMMAND_PREFIX}anticheat <mode> [v1/v2/v1noclip] [true/false]`, 'Anticheat(BETA System)', true, async (sender: any, world, args) => {
    if (args.length === 0) {
        world.sendMessage(`使用方法: ${MINECRAFT_COMMAND_PREFIX}anticheat <mode> [v1/v2/v1noclip] [true/false]`, sender);
        return;
    }
    const subcommand = args[0].toLowerCase();

    if (subcommand === 'mode') {
        const mode = args[1] as "v1" | "v2" | "v1noclip";
        const enabled = args[2] === 'true' ? true : args[2] === 'false' ? false : undefined;

        if (mode !== "v1" && mode !== "v2" && mode !== "v1noclip") {
            world.sendMessage(`不明なモードです: ${mode}。 'v1', 'v2', 'v1noclip' のいずれかを指定してください。`, sender);
            return;
        }

        const message = await switchAnticheatMode(world, mode, enabled);
        world.sendMessage(message, sender);
    } else if (subcommand === 'status') {
        const { mode, noclip } = getActiveAnticheatMode();
        if (mode === "v1") {
            world.sendMessage(`現在有効なアンチチートモード: v1 (Noclip: ${noclip ? '有効' : '無効'})`, sender);
        } else if (mode === "v2") {
            world.sendMessage(`現在有効なアンチチートモード: v2 (Noclip)`, sender);
        } else {
            world.sendMessage(`アンチチートモードは有効になっていません。`, sender);
        }
    } else {
        world.sendMessage(`不明なサブコマンドです: ${subcommand}`, sender);
    }
});