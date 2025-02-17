import { system, ScriptEventCommandMessageAfterEvent, Player } from "@minecraft/server";
import { EventManager } from "./module";

interface CommandHandler {
    moduleName: string;
    description?: string;
    usage?: string;
    execute: (message: string, event: ScriptEventCommandMessageAfterEvent) => void;
}

export class Handler {
    public commandHandlers: { [commandId: string]: CommandHandler[] } = {};
    private eventManager: EventManager;
    private readonly commandsPerPage = 5;

    constructor(eventManager: EventManager) {
        this.eventManager = eventManager;

        system.afterEvents.scriptEventReceive.subscribe((event) => {
            this.handleEvent(event);
        });

        this.registerHelpCommand(); // Helpコマンドを登録
    }

    registerCommand(commandId: string, handler: CommandHandler) {
        if (!this.commandHandlers[commandId]) {
            this.commandHandlers[commandId] = [];
        }
        this.commandHandlers[commandId].push(handler);
    }

    unregisterCommand(commandId: string, handler: CommandHandler) {
        if (this.commandHandlers[commandId]) {
            this.commandHandlers[commandId] = this.commandHandlers[commandId].filter(h => h !== handler);
        }
    }

    private handleEvent(event: ScriptEventCommandMessageAfterEvent) {
        const { message, id } = event;

        let commandId: string;

        if (id.startsWith("ws:")) {
            commandId = id.substring(3);
        } else {
            commandId = id;
        }

        if (this.commandHandlers[commandId]) {
            this.commandHandlers[commandId].forEach(commandHandler => {
                if (this.eventManager.isModuleEnabled(commandHandler.moduleName)) {
                    commandHandler.execute(message, event);
                }
            });
        }
    }


    private registerHelpCommand() {
        this.registerCommand("help", {
            moduleName: "ModuleEditer",
            description: "Helpコマンド help コマンド名でその説明を見れます",
            usage: "help <page|commandName>",
            execute: (message, event) => {
                const args = message.trim().split(/\s+/);
                if (args.length === 0 || (args.length === 1 && args[0] === "")) {
                    this.showCommandListPage(event, 1);
                } else {
                    const arg = args[0];
                    console.log(`args ${arg}`);

                    if (/^\d+$/.test(arg)) {
                        const pageNumber = parseInt(arg, 10);
                        this.showCommandListPage(event, pageNumber);
                    } else {
                        this.showCommandHelp(event, arg);
                    }
                }
            },
        });
    }



    private showCommandListPage(event: ScriptEventCommandMessageAfterEvent, pageNumber: number) {
        if (!(event.sourceEntity instanceof Player)) return;
        const player = event.sourceEntity;


        const enabledCommands: { command: string; description: string; }[] = [];

        for (const commandId in this.commandHandlers) {
            if (this.commandHandlers[commandId].some(handler => this.eventManager.isModuleEnabled(handler.moduleName))) {
                const enabledHandler = this.commandHandlers[commandId].find(handler => this.eventManager.isModuleEnabled(handler.moduleName));
                enabledCommands.push({
                    command: commandId,
                    description: enabledHandler?.description || "説明無し", 
                });
            }
        }


        const startIndex = (pageNumber - 1) * this.commandsPerPage;
        const endIndex = startIndex + this.commandsPerPage;
        const commandsToShow = enabledCommands.slice(startIndex, endIndex);
        const totalPages = Math.ceil(enabledCommands.length / this.commandsPerPage);


        if (commandsToShow.length > 0) {

            let helpMessage = `§a===== [Help] =====§r (Page ${pageNumber}/${totalPages})\n`; 
            commandsToShow.forEach(cmdInfo => {
                helpMessage += `§b> ${cmdInfo.command}§r\n`; 
                helpMessage += `  §7- ${cmdInfo.description}§r\n`; 
            });

            //ページネーション情報
            helpMessage += `§e----------§r\n`
            if (pageNumber > 1) {
                helpMessage += `§9<<前(${pageNumber - 1})§r `;
            } else {
                helpMessage += `§7<<前§r `;
            }

            helpMessage += `  ${pageNumber}/${totalPages}  ` //現在のページ/

            if (pageNumber < totalPages) {
                helpMessage += `§9次(${pageNumber + 1})>>§r`
            } else {
                helpMessage += `§7次>>§r`
            }


            player.sendMessage(helpMessage);
        } else {
            //該当ページにコマンドがないとき
            if (totalPages === 0) {
                player.sendMessage("§c利用可能なコマンドがありません")
            } else {
                player.sendMessage("§c指定されたページにコマンドはありません")
            }

        }
    }


    private showCommandHelp(event: ScriptEventCommandMessageAfterEvent, targetCommandName: string) {

        if (!(event.sourceEntity instanceof Player)) return;
        const player = event.sourceEntity;

        let description = "";
        let usage = "";

        if (this.commandHandlers[targetCommandName]) {
            const handlers = this.commandHandlers[targetCommandName];
            for (const handler of handlers) {
                if (this.eventManager.isModuleEnabled(handler.moduleName)) {
                    description = handler.description || "説明無し";
                    usage = handler.usage || "なし";
                    break;
                }
            }
        }

        if (!description) {
            player.sendMessage(`§cコマンド[${targetCommandName}]は存在しないか、無効です`);
            return;
        }



        let helpMessage = `§a===== [${targetCommandName}] =====§r\n`;
        helpMessage += `§7説明:§r\n  ${description}\n`;
        helpMessage += `§7使用法:§r\n  ${usage}\n`
        helpMessage += `§a========================§r`;


        player.sendMessage(helpMessage);

    }

}