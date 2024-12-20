import { config } from '../../Modules/Util';
import { registerCommand, verifier } from '../../Modules/Handler';
import { Player, system } from '@minecraft/server';
import { ActionFormData, ModalFormData } from '@minecraft/server-ui';
import { translate } from '../langs/list/LanguageManager';
import { transferPlayer } from '@minecraft/server-admin';
import { chestLockAddonData, loadData, saveData } from '../../Modules/DataBase';

interface ServerInfo {
    name: string;
    ip: string;
    port: number;
    texturePath?: string;
}

let playerServerData: { [key: string]: ServerInfo[] } = {};

// デフォルトサーバーの定義
const defaultServers: ServerInfo[] = [
    { name: "Zepa", ip: "zeqa.net", port: 19132, texturePath: 'textures/blocks/grass_side_carried.png' },
];

function saveTransFerData(): void {
    saveData('transferServersData', playerServerData);
}

export function resetTransferData(): void {
    playerServerData = {};
    saveTransFerData();
}

export function loadTransferData(): void {
    loadData();
    if (chestLockAddonData.transferServersData && typeof chestLockAddonData.transferServersData === 'object') {
        playerServerData = chestLockAddonData.transferServersData;
    } else {
        playerServerData = {};
    }

    // 新規プレイヤーにデフォルトサーバーを追加
    for (const playerID in playerServerData) {
        if (!playerServerData[playerID].some(server => defaultServers.some(defaultServer => defaultServer.name === server.name))) {
            playerServerData[playerID].push(...defaultServers);
        }
    }
}

registerCommand({
    name: 'transfer',
    description: 'transfer_docs',
    parent: false,
    maxArgs: 2,
    minArgs: 0,
    require: (player: Player) => verifier(player, config().commands['transfer']),
    executor: (player: Player, args: string[]) => {
        if (args.length === 0 || args[0] === 'open') {
            transferUI(player);
            return;
        }

        if (args.length === 1) {
            player.sendMessage(translate(player, 'command.transfer.missingArgument'));
            return;
        }

        if (args.length === 2) {
            const ipPort = args[1].split(':');
            if (ipPort.length !== 2) {
                player.sendMessage(translate(player, 'command.transfer.invalidFormat'));
                return;
            }
            const ip = ipPort[0];
            const port = parseInt(ipPort[1], 10);

            if (isNaN(port)) {
                player.sendMessage(translate(player, 'command.transfer.invalidPort'));
                return;
            }
            player.sendMessage(translate(player, 'command.transfer.connecting') + `${ip}:${port}`);
            runTransferCommand(player, ip, port);
            return;
        }
    },
});

function transferUI(player: Player) {
    system.runTimeout(() => { 
        transferMain(player); 
    }, 20 *3);
}

export function transferMain(player: Player) {
    player.playSound('mob.chicken.plop');
    const form = new ActionFormData()
        .title(translate(player, 'ui.transferTitle'))
        .body(translate(player, 'ui.transferBody'))
        .button(translate(player, 'ui.directConnect'))
        .button(translate(player, 'ui.addServer'))
        .button(translate(player, 'ui.removeServer'))
        .button(translate(player, 'ui.editServer'))
        .button(translate(player, 'ui.serverList'));

    form
        //@ts-ignore
        .show(player)
        .then((response) => {
            if (response.canceled) return;

            switch (response.selection) {
                case 0:
                    showDirectConnectForm(player);
                    break;
                case 1:
                    showAddServerForm(player);
                    break;
                case 2:
                    showRemoveServerForm(player);
                    break;
                case 3:
                    showEditServerForm(player);
                    break;
                case 4:
                    showServerList(player);
                    break;
            }
        })
        .catch((error: Error) => {
            console.error(translate(player, 'ui.FromError'), error);
            player.sendMessage(translate(player, 'ui.FromError') + error.message);
        });
}

function showDirectConnectForm(player: Player) {
    const form = new ModalFormData()
        .title(translate(player, 'ui.directConnect'))
        .textField(translate(player, 'ui.ipAddress'), '127.0.0.1')
        .textField(translate(player, 'ui.port'), '19132');

    form
        //@ts-ignore
        .show(player)
        .then((response) => {
            if (response.canceled) {
                transferMain(player);
                return;
            }
            if (!response.formValues) {
                player.sendMessage(translate(player, 'command.transfer.invalidResponse'));
                showDirectConnectForm(player);
                return;
            }
            const ip = response.formValues[0] as string;
            const port = parseInt(response.formValues[1] as string);
            if (isNaN(port)) {
                player.sendMessage(translate(player, 'command.transfer.invalidPort'));
                showDirectConnectForm(player);
                return;
            }
            runTransferCommand(player, ip, port);
        })
        .catch((error: Error) => {
            console.error(translate(player, 'ui.FromError'), error);
            player.sendMessage(translate(player, 'ui.FromError') + error.message);
        });
}

function showAddServerForm(player: Player) {
    const form = new ModalFormData()
        .title(translate(player, 'ui.addServer'))
        .textField(translate(player, 'ui.serverName'), 'New Server')
        .textField(translate(player, 'ui.ipAddress'), '127.0.0.1')
        .textField(translate(player, 'ui.port'), '19132')
        .textField(translate(player, 'ui.texturePath'), '');

    form
        //@ts-ignore
        .show(player)
        .then((response) => {
            if (response.canceled) {
                transferMain(player);
                return;
            }
            if (!response.formValues) {
                player.sendMessage(translate(player, 'command.transfer.invalidResponse'));
                showAddServerForm(player);
                return;
            }

            const name = response.formValues[0] as string;
            const ip = response.formValues[1] as string;
            const port = parseInt(response.formValues[2] as string);
            const texturePath = response.formValues[3] as string;

            if (isNaN(port)) {
                player.sendMessage(translate(player, 'command.transfer.invalidPort'));
                showAddServerForm(player);
                return;
            }

            const playerID = player.id;
            const playerServers = playerServerData[playerID] || [];
            // texturePath が空欄でもそのまま追加
            playerServers.push({ name, ip, port, texturePath });
            playerServerData[playerID] = playerServers;
            saveTransFerData();

            player.sendMessage(translate(player, 'command.transfer.serverAdded'));
            transferMain(player);

        })
        .catch((error: Error) => {
            console.error(translate(player, 'ui.FromError'), error);
            player.sendMessage(translate(player, 'ui.FromError') + error.message);
        });
}

function showRemoveServerForm(player: Player) {
    const playerID = player.id;
    const playerServers = playerServerData[playerID] || [];

    if (playerServers.length === 0) {
        player.sendMessage(translate(player, 'command.transfer.noServerToRemove'));
        transferMain(player);
        return;
    }

    const form = new ActionFormData().title(translate(player, 'ui.removeServer'));
    playerServers.forEach((server) => {
        // texturePath が存在する場合のみ、ボタンにアイコンとして追加
        if (server.texturePath) {
            form.button(server.name, server.texturePath);
        } else {
            form.button(server.name);
        }
    });

    form
        //@ts-ignore
        .show(player)
        .then((response) => {
            if (response.canceled) {
                transferMain(player);
                return;
            }

            if (response.selection !== undefined) {
                playerServers.splice(response.selection, 1);
            }
            playerServerData[playerID] = playerServers;
            saveTransFerData();
            player.sendMessage(translate(player, 'command.transfer.serverRemoved'));
            transferMain(player);

        })
        .catch((error: Error) => {
            console.error(translate(player, 'ui.FromError'), error);
            player.sendMessage(translate(player, 'ui.FromError') + error.message);
        });
}

function showEditServerForm(player: Player) {
    const playerID = player.id;
    const playerServers = playerServerData[playerID] || [];

    if (playerServers.length === 0) {
        player.sendMessage(translate(player, 'command.transfer.noServerToEdit'));
        transferMain(player);
        return;
    }

    const form = new ActionFormData().title(translate(player, 'ui.editServer'));
    playerServers.forEach((server) => {
        // texturePath が存在する場合のみ、ボタンにアイコンとして追加
        if (server.texturePath) {
            form.button(server.name, server.texturePath);
        } else {
            form.button(server.name);
        }
    });

    form
        //@ts-ignore
        .show(player)
        .then((response) => {
            if (response.canceled) {
                transferMain(player);
                return;
            }

            if (response.selection !== undefined) {
                showEditServerDetailsForm(player, response.selection);
            }
        })
        .catch((error: Error) => {
            console.error(translate(player, 'ui.FromError'), error);
            player.sendMessage(translate(player, 'ui.FromError') + error.message);
        });
}

function showEditServerDetailsForm(player: Player, serverIndex: number) {
    const playerID = player.id;
    const playerServers = playerServerData[playerID] || [];
    const serverToEdit = playerServers[serverIndex];

    const form = new ModalFormData()
        .title(translate(player, 'ui.editServerDetails'))
        .textField(translate(player, 'ui.serverName'), serverToEdit.name, serverToEdit.name)
        .textField(translate(player, 'ui.ipAddress'), serverToEdit.ip, serverToEdit.ip)
        .textField(translate(player, 'ui.port'), serverToEdit.port.toString(), serverToEdit.port.toString())
        .textField(translate(player, 'ui.texturePath'), serverToEdit.texturePath || '', serverToEdit.texturePath || ''); // 既存のパスか空欄

    form
        //@ts-ignore
        .show(player)
        .then((response) => {
            if (response.canceled) {
                showEditServerForm(player);
                return;
            }
            if (!response.formValues) {
                player.sendMessage(translate(player, 'command.transfer.invalidResponse'));
                showEditServerDetailsForm(player, serverIndex);
                return;
            }

            const name = response.formValues[0] as string;
            const ip = response.formValues[1] as string;
            const port = parseInt(response.formValues[2] as string);
            const texturePath = response.formValues[3] as string;

            if (isNaN(port)) {
                player.sendMessage(translate(player, 'command.transfer.invalidPort'));
                showEditServerDetailsForm(player, serverIndex);
                return;
            }

            // texturePath が空欄でもそのまま更新
            playerServers[serverIndex] = { name, ip, port, texturePath };
            playerServerData[playerID] = playerServers;
            saveTransFerData();

            player.sendMessage(translate(player, 'command.transfer.serverUpdated'));
            transferMain(player);
        })
        .catch((error: Error) => {
            console.error(translate(player, 'ui.FromError'), error);
            player.sendMessage(translate(player, 'ui.FromError') + error.message);
        });
}

function showServerList(player: Player) {
    const playerID = player.id;
    const playerServers = playerServerData[playerID] || [];

    defaultServers.forEach(defaultServer => {
        if (!playerServers.some(server => server.name === defaultServer.name)) {
            playerServers.push(defaultServer);
        }
    });

    playerServerData[playerID] = playerServers;
    saveTransFerData();

    if (playerServers.length === 0) {
        player.sendMessage(translate(player, 'command.transfer.noServer'));
        transferMain(player);
        return;
    }

    const form = new ActionFormData().title(translate(player, 'ui.serverList'));
    playerServers.forEach((server) => {
        if (server.texturePath) {
            form.button(server.name, server.texturePath);
        } else {
            form.button(server.name);
        }
    });

    form
        //@ts-ignore
        .show(player)
        .then((response) => {
            if (response.canceled || response.selection === undefined) {
                transferMain(player);
                return;
            }

            const selectedServer = playerServers[response.selection];
            runTransferCommand(player, selectedServer.ip, selectedServer.port);
        })
        .catch((error: Error) => {
            console.error(translate(player, 'ui.FromError'), error);
            player.sendMessage(translate(player, 'ui.FromError') + error.message);
        });
}



system.afterEvents.scriptEventReceive.subscribe(async (event) => {
    const { id, sourceEntity, message } = event;
    if (id === 'ch:transfer' && sourceEntity instanceof Player) {
        const player = sourceEntity;
        const ipPort = message.split(':');
        if (ipPort.length !== 2) {
            player.sendMessage(translate(player, 'command.transfer.invalidFormat'));
            return;
        }
        const ip = ipPort[0];
        const port = parseInt(ipPort[1], 10);

        if (isNaN(port)) {
            player.sendMessage(translate(player, 'command.transfer.invalidPort'));
            return;
        }
        player.sendMessage(translate(player, 'command.transfer.connecting') + `${ip}:${port}`);
        runTransferCommand(player, ip, port);

    }
});


/**
 * 
 * @param player 
 * @param ip 
 * @param port 
 */
function runTransferCommand(player: Player, ip: string, port: number) {
    system.runTimeout(() => {
        //@ts-ignore
        transferPlayer(player, ip, port);
    })
}