import { world, system } from "@minecraft/server";
import { db_leaderboards } from "../index";
import { Leaderboard } from "./Leaderboard";

function registerCommand(name, aliases = [], callback) {
    world.beforeEvents.chatSend.subscribe((event) => {
        if (event.message.startsWith(name) || aliases.some((alias) => event.message.startsWith(alias))) {
            event.cancel = true;
            const sender = event.sender;
            // Only process if the sender has the "op" tag
            if (!sender.hasTag("op")) {
                sender.sendMessage("§cYou do not have permission to execute this command.");
                return;
            }
            const args = event.message.split(" ").slice(1); // Get arguments excluding the command name
            callback(sender, args);
        }
    });
}

// Register leaderboard command - change the prefix from . to ! if you like
registerCommand(".lb", [], (sender, args) => {
    if (args.length === 0) {
        sender.sendMessage("§cUsage: -lb <create|remove|list|help>"); // Add help subcommand
        return;
    }
    const subcommand = args[0];
    switch (subcommand) {
        case "create":
            const addLeaderboard = args.length === 5;
            if (args.length !== 5 && args.length !== 6) {
                sender.sendMessage("§cUsage: -lb create <objective> <x> <y> <z> [-false]");
                return;
            }
            const objective = args[1];
            const x = parseFloat(args[2]);
            const y = parseFloat(args[3]);
            const z = parseFloat(args[4]);
            if (isNaN(x) || isNaN(y) || isNaN(z)) {
                sender.sendMessage("§cCoordinates must be numerical values.");
                return;
            }
            system.runTimeout(() => {
                const location = {
                    x: x + 0.5,
                    y: y,
                    z: z + 0.5
                };
                const entity = sender.dimension.spawnEntity("mcbehub:floating_text", location);
                if (!entity) {
                    sender.sendMessage("§cFailed to create leaderboard.");
                    return;
                }
                new Leaderboard(objective, entity, sender.dimension, addLeaderboard);
                sender.sendMessage(`§aLeaderboard "${objective}" created.`);
                sender.playSound("random.orb");
            });
            break;
        case "remove":
            if (args.length !== 2) {
                sender.sendMessage("§cUsage: -lb remove <objective>");
                return;
            }
            const objectiveToRemove = args[1];
            const leaderboardToRemove = db_leaderboards[objectiveToRemove];
            if (!leaderboardToRemove) {
                sender.sendMessage(`§cNo leaderboard found with the name "${objectiveToRemove}".`);
                return;
            }
            system.runTimeout(() => {
                if (leaderboardToRemove.delete()) {
                    delete db_leaderboards[objectiveToRemove];
                    sender.sendMessage(`§aLeaderboard "${objectiveToRemove}" removed.`);
                    sender.playSound("random.orb");
                } else {
                    sender.sendMessage(`§cFailed to remove leaderboard "${objectiveToRemove}".`);
                }
            });
            break;
        case "list":
            const page = args.length >= 2 ? parseInt(args[1]) : 1;
            if (isNaN(page) || page < 1) {
                sender.sendMessage("§cPage number must be 1 or higher.");
                return;
            }
            system.runTimeout(() => {
                const leaderboards = Object.values(db_leaderboards);
                const maxPages = Math.ceil(leaderboards.length / 7);
                const currentPage = Math.min(page, maxPages);
                sender.sendMessage(`§2--- Leaderboard List (Page ${currentPage} / ${maxPages}) ---`);
                for (let i = (currentPage - 1) * 7; i < Math.min(currentPage * 7, leaderboards.length); i++) {
                    const leaderboard = leaderboards[i];
                    if (leaderboard) {
                        sender.sendMessage(`§b#${i + 1}§r §g${leaderboard.objective}§r §e${Math.floor(leaderboard.entity?.location.x)}, ${Math.floor(leaderboard.entity?.location.y)}, ${Math.floor(leaderboard.entity?.location.z)}§r §7(${leaderboard.dimension.id})`);
                    }
                }
            });
            break;
        case "help":
            system.runTimeout(() => {
                sender.sendMessage("§2--- Leaderboard Command Help ---");
                sender.sendMessage("§b-lb create <objective> <x> <y> <z>§r: Creates a leaderboard.");
                sender.sendMessage("§b-lb remove <x> <y> <z>§r: Removes a leaderboard.");
                sender.sendMessage("§b-lb list [page number]§r: Displays the list of leaderboards.");
                sender.sendMessage("§b-lb help§r: Displays this help message.");
            });
            break;
        default:
            sender.sendMessage("§cInvalid subcommand. Use -lb help for command help.");
            break;
    }
});
