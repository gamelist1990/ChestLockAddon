// modules.ts (修正版 - docs 追加)
import { world, system, WorldAfterEvents } from "@minecraft/server";
import { Handler } from "./Handler";
import { Database } from "./DataBase";

interface Module {
    name: string;
    docs?: string; // 追加: モジュールの説明
    execute?: (context: any, ...args: any[]) => any;
    onInitialize?: (context: any) => void;
    onShutdown?: (context: any) => void;
    subscribeToEvents?: (eventManager: EventManager) => void;
    onEnable?: (context: any) => void;
    onDisable?: (context: any) => void;
    registerCommands?: (handler: Handler) => void;
    enabledByDefault?: boolean;
}

type EventHandler<T> = (eventData: T) => void;

class EventManager {
    private eventHandlers: { [eventName: string]: EventHandler<any>[] } = {};
    private worldEventHandlers: { [K in keyof WorldAfterEvents]?: EventHandler<Parameters<WorldAfterEvents[K]["subscribe"]>[0]>[] } = {};
    private enabledModules: Set<string> = new Set();

    subscribeToWorldEvent<K extends keyof WorldAfterEvents>(
        eventName: K,
        handler: EventHandler<Parameters<WorldAfterEvents[K]["subscribe"]>[0]>,
        moduleName: string
    ): void {
        if (!this.enabledModules.has(moduleName)) {
            return;
        }

        if (!this.worldEventHandlers[eventName]) {
            this.worldEventHandlers[eventName] = [];
            world.afterEvents[eventName].subscribe((eventData) => {
                this.worldEventHandlers[eventName]!.forEach(h => {
                    if (this.isHandlerEnabled(h, moduleName)) {
                        h(eventData as Parameters<WorldAfterEvents[K]["subscribe"]>[0]);
                    }
                });
            });
        }
        (handler as any)._moduleName = moduleName;
        this.worldEventHandlers[eventName]!.push(handler);
    }

    unsubscribeFromWorldEvent<K extends keyof WorldAfterEvents>(
        eventName: K,
        handler: EventHandler<Parameters<WorldAfterEvents[K]["subscribe"]>[0]>
    ): void {
        if (this.worldEventHandlers[eventName]) {
            this.worldEventHandlers[eventName] = this.worldEventHandlers[eventName]!.filter(h => h !== handler);
            if (this.worldEventHandlers[eventName]!.length === 0) {
                delete this.worldEventHandlers[eventName];
                console.warn(`No more handlers for ${String(eventName)}.  Consider cleanup, but unsubscribe is not available.`);
            }
        }
    }

    registerEvent(eventName: string) {
        if (this.eventHandlers[eventName]) {
            console.warn(`Event "${eventName}" already registered.`);
            return;
        }
        this.eventHandlers[eventName] = [];
    }

    subscribe(eventName: string, handler: EventHandler<any>, moduleName: string) {
        if (!this.eventHandlers[eventName]) {
            console.warn(`Event "${eventName}" not found.  Did you register it?`);
            return;
        }
        if (!this.enabledModules.has(moduleName)) {
            return;
        }
        (handler as any)._moduleName = moduleName;
        this.eventHandlers[eventName].push(handler);
    }

    unsubscribe(eventName: string, handler: EventHandler<any>) {
        if (this.eventHandlers[eventName]) {
            this.eventHandlers[eventName] = this.eventHandlers[eventName].filter(h => h !== handler);
        }
    }

    emit(eventName: string, eventData: any) {
        if (!this.eventHandlers[eventName]) {
            console.warn(`Event "${eventName}" not found (emit).`);
            return;
        }
        this.eventHandlers[eventName].forEach(handler => {
            if (this.isHandlerEnabled(handler, (handler as any)._moduleName)) {
                handler(eventData);
            }
        });
    }

    private isHandlerEnabled(handler: Function, moduleName: string): boolean {
        return (handler as any)._moduleName === moduleName;
    }

    enableModule(moduleName: string) {
        this.enabledModules.add(moduleName);
    }

    disableModule(moduleName: string) {
        this.enabledModules.delete(moduleName);
    }

    isModuleEnabled(moduleName: string): boolean {
        return this.enabledModules.has(moduleName);
    }
}

class ModuleManager {
    private modules: { [name: string]: Module } = {};
    private eventManager: EventManager = new EventManager();
    private context: any;
    private enabled: { [moduleName: string]: boolean } = {};
    private database: Database;
    private handler: Handler;
    private moduleStatusDB: Database; // モジュールステータス専用の Database

    constructor(context: any) {
        this.context = context;
        this.database = new Database();
        this.handler = new Handler(this.eventManager);
        this.moduleStatusDB = Database.create("ws_module"); // 専用のスコアボード
        this.initializeModuleStatus();
    }

    private async initializeModuleStatus() {
        const allModules = this.getAllModules();
        for (const module of allModules) {
            const enabled =
                (await this.moduleStatusDB.get(module.name)) ??
                (module.enabledByDefault ? 1 : 0);
            this.enabled[module.name] = enabled === 1;
            if (enabled === 1) {
                this.eventManager.enableModule(module.name);
            }
        }
        for (const moduleName in this.enabled) {
            if (this.enabled[moduleName]) {
                const module = this.getModule(moduleName);
                if (module && module.onEnable) {
                    module.onEnable(this.context);
                }
            }
        }
    }

    private async updateModuleStatus(moduleName: string, enabled: boolean) {
        await this.moduleStatusDB.set(moduleName, enabled ? 1 : 0);
    }

    registerModule(module: Module) {
        if (this.modules[module.name]) {
            console.warn(`Module "${module.name}" already registered. Overwriting.`);
        }
        this.modules[module.name] = module;
        this.moduleStatusDB
            .get(module.name)
            .then((value) => {
                const enabled = value ?? (module.enabledByDefault ? 1 : 0);
                this.enabled[module.name] = enabled === 1;

                if (this.enabled[module.name]) {
                    this.eventManager.enableModule(module.name);
                }

                if (module.onInitialize) {
                    module.onInitialize(this.context);
                }
                if (module.registerCommands) {
                    module.registerCommands(this.handler);
                }
            })
            .catch(async (_error) => {
                this.enabled[module.name] = !!module.enabledByDefault;
                if (this.enabled[module.name]) {
                    this.eventManager.enableModule(module.name);
                }
                await this.updateModuleStatus(module.name, this.enabled[module.name]);

                if (module.onInitialize) {
                    module.onInitialize(this.context);
                }
                if (module.registerCommands) {
                    module.registerCommands(this.handler);
                }
            });
    }

    getModule(name: string): Module | undefined {
        return this.modules[name];
    }
    // 追加: モジュールの説明を取得するメソッド
    getModuleDocs(moduleName: string): string | undefined {
        const module = this.getModule(moduleName);
        return module ? module.docs : undefined;
    }

    executeModule(name: string, ...args: any[]): any {
        const module = this.getModule(name);
        if (!module || !module.execute || !this.enabled[name]) {
            console.error(
                `Module "${name}" not found, not enabled, or has no execute function.`
            );
            return undefined;
        }
        return module.execute(this.context, ...args);
    }

    getAllModules(): Module[] {
        return Object.values(this.modules);
    }

    unregisterModule(name: string): void {
        const module = this.modules[name];
        if (module) {
            if (this.enabled[name]) {
                this.disableModule(name);
            }
            if (module.onShutdown) {
                module.onShutdown(this.context);
            }
            delete this.modules[name];
            delete this.enabled[name];
            this.moduleStatusDB.delete(name);
        } else {
            console.warn(`Module "${name}" not found. Cannot unregister.`);
        }
    }

    async enableModule(name: string): Promise<boolean> {
        const module = this.getModule(name);
        if (!module) {
            console.warn(`Module "${name}" not found.`);
            return false;
        }
        if (this.enabled[name]) {
            console.warn(`Module "${name}" is already enabled.`);
            return true;
        }

        this.enabled[name] = true;
        this.eventManager.enableModule(name);
        await this.updateModuleStatus(name, true);

        if (module.onEnable) {
            module.onEnable(this.context);
        }
        if (module.subscribeToEvents) {
            module.subscribeToEvents(this.eventManager);
        }
        return true;
    }

    async disableModule(name: string): Promise<boolean> {
        const module = this.getModule(name);
        if (!module) {
            console.warn(`Module "${name}" not found.`);
            return false;
        }
        if (!this.enabled[name]) {
            console.warn(`Module "${name}" is already disabled.`);
            return true;
        }

        this.enabled[name] = false;
        this.eventManager.disableModule(name);
        await this.updateModuleStatus(name, false);

        if (module.onDisable) {
            module.onDisable(this.context);
        }
        return true;
    }

    isModuleEnabled(name: string): boolean {
        return this.enabled[name] ?? false;
    }

    getEventManager(): EventManager {
        return this.eventManager;
    }

    getHandler(): Handler {
        return this.handler;
    }

    getDatabase(): Database {
        return this.database;
    }

    async getModuleStatus(): Promise<{ [moduleName: string]: boolean }> {
        const status: { [moduleName: string]: boolean } = {};
        for (const moduleName in this.modules) {
            status[moduleName] = this.enabled[moduleName];
        }
        return status;
    }
}

const moduleManager = new ModuleManager({ world, system });
export { moduleManager, Module, EventManager, EventHandler };