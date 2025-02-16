import { world, registerCommand, prefix, removeCommand } from '../../backend';
import { Player } from '../../module/player';

interface Plugin {
    name: string;
    onEnable?(): void;
    onDisable?(): void;
    isEnabled: boolean; // プラグインの有効/無効フラグ
    execute: () => Promise<void>; // プラグインの実行関数
}

const plugins: { [name: string]: Plugin } = {};

// プラグイン登録関数
export function registerPlugin(
    name: string,
    pluginData: { onEnable?: () => void; onDisable?: () => void },
    initialState: boolean, // 初期状態 (有効/無効)
    pluginFunction: () => Promise<void>,
) {
    if (plugins[name]) {
        console.warn(`[PluginManager] Plugin '${name}' is already registered.`);
        return;
    }

    const plugin: Plugin = {
        name: name,
        onEnable: pluginData.onEnable,
        onDisable: pluginData.onDisable,
        isEnabled: initialState, // 初期状態を設定
        execute: pluginFunction,
    };

    plugins[name] = plugin;
    console.log(
        `[PluginManager] Plugin '${name}' registered (initial state: ${initialState ? 'enabled' : 'disabled'}).`,
    );

    if (initialState) {
        // 初期状態が有効なら実行
        if (plugin.onEnable) {
            plugin.onEnable();
        }
        plugin.execute().catch((error) => {
            // 非同期エラーハンドリング
            console.error(`[PluginManager] Error executing plugin '${name}':`, error);
        });
    }
}

// プラグイン有効化関数
export async function enablePlugin(name: string) {
    const plugin = plugins[name];
    if (!plugin) {
        console.warn(`[PluginManager] Plugin '${name}' is not registered.`);
        return;
    }
    if (plugin.isEnabled) {
        console.warn(`[PluginManager] Plugin '${name}' is already enabled.`);
        return;
    }

    plugin.isEnabled = true; // フラグを有効に

    if (plugin.onEnable) {
        plugin.onEnable();
    }
    plugin.execute().catch((error) => {
        console.error(`[PluginManager] Error executing plugin '${name}':`, error);
    });
    console.log(`[PluginManager] Plugin '${name}' enabled.`);
}

// プラグイン無効化関数
export function disablePlugin(pluginName: string) {
    const plugin = plugins[pluginName];
    if (!plugin) {
        console.warn(`[PluginManager] Plugin '${pluginName}' is not registered.`);
        return;
    }
    if (!plugin.isEnabled) {
        console.warn(`[PluginManager] Plugin '${pluginName}' is already disabled.`);
        return;
    }

    plugin.isEnabled = false; // フラグを無効に
    removeCommand(pluginName);

    if (plugin.onDisable) { 
        plugin.onDisable();
    }
    console.log(`[PluginManager] Plugin '${pluginName}' disabled.`);
}



registerCommand({
    name: 'plugin',
    description: 'プラグイン管理コマンド',
    usage: 'plugin <list|enable|disable> [pluginName]',
    config: { enabled: true, adminOnly: true, requireTag: [] },
    executor: async (player: Player, args: string[]) => {
        const subCommand = args[0];

        switch (subCommand) {
            case 'list':
                listPlugins(player);
                break;
            case 'enable':
                handleEnableCommand(player, args[1]);
                break;
            case 'disable':
                handleDisableCommand(player, args[1]);
                break;
            default:
                player.sendMessage(`§cInvalid subcommand: ${subCommand}§r`);
                player.sendMessage(`§bUsage§f plugin <list|enable|disable> [pluginName]`)
        }
    },
});

async function handleEnableCommand(player: Player, pluginName: string) {
    if (!pluginName) {
        player.sendMessage(`§cUsage: ${prefix}plugin enable <pluginName>§r`);
        return;
    }
    await enablePlugin(pluginName);
    player.sendMessage(`§aPlugin '${pluginName}' enabled.§r`);
}

function handleDisableCommand(player: Player, pluginName: string) {
    if (!pluginName) {
        player.sendMessage(`§cUsage: ${prefix}plugin disable <pluginName>§r`);
        return;
    }
    disablePlugin(pluginName);
    player.sendMessage(`§aPlugin '${pluginName}' disabled.§r`);
}

function listPlugins(player: Player) {
    player.sendMessage('§6--- Registered Plugins ---§r');
    for (const pluginName in plugins) {
        const plugin = plugins[pluginName];
        player.sendMessage(`- ${pluginName} (${plugin.isEnabled ? 'enabled' : 'disabled'})`);
    }
}

