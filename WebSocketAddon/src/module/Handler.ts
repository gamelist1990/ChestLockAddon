// Handler.ts
import { system, ScriptEventCommandMessageAfterEvent } from "@minecraft/server";
import { EventManager } from "./module";

interface CommandHandler {
    moduleName: string;
    execute: (message: string, event: ScriptEventCommandMessageAfterEvent) => void;
}

export class Handler {
    public commandHandlers: { [commandId: string]: CommandHandler[] } = {};
    private eventManager: EventManager;

    constructor(eventManager: EventManager) {
        this.eventManager = eventManager;

        system.afterEvents.scriptEventReceive.subscribe((event) => {
            //   console.log("----- Event Received -----");
            //   console.log(`Received event! id: ${event.id}, message: ${event.message}`);
            this.handleEvent(event);
        });
    }

    registerCommand(commandId: string, handler: CommandHandler) {
        console.log(`Command registered: ${commandId}`);
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

        // Handler では message を分割せず、そのまま渡す
        if (id.startsWith("ws:")) {
            commandId = id.substring(3);
        } else {
            commandId = id;
        }

        // console.log("Processed commandId:", commandId, "Processed commandArgs:", message); // message 全体を commandArgs として表示


        if (this.commandHandlers[commandId]) {
            this.commandHandlers[commandId].forEach(commandHandler => {
                if (this.eventManager.isModuleEnabled(commandHandler.moduleName)) {
                    // message全体をhandler.executeに渡す。
                    commandHandler.execute(message, event);
                }
            });
        } else {
            console.warn(`Unknown command: ${commandId}`);
        }
        //   console.log("----- Event Handling Finished -----");
    }
}