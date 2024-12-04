import { config } from '../../Modules/Util';
import { saveData, loadData, chestLockAddonData } from '../../Modules/DataBase';
import { registerCommand, verifier, prefix } from '../../Modules/Handler';
import { Player, world, system } from '@minecraft/server';
import { translate } from '../langs/list/LanguageManager';


interface WarpGate {
  name: string;
  destination: {
    x: number;
    y: number;
    z: number;
  };
  gateArea: {
    firstPos?: { x: number; y: number; z: number };
    secondPos?: { x: number; y: number; z: number };
  };
  creatingPlayer?: Player;
}

let warpGates: WarpGate[] = [];


function saveGate(): void {
  saveData('warpGate', warpGates);
}

// データの読み込み関数
export function loadGate(): void {
  loadData();
  const data = chestLockAddonData.warpGate;
  if (data && typeof data === 'object') {
    warpGates = data;
  }
}

// ブロック破壊イベントの処理関数
function handleBlockBreak(event: any) {
  const { player } = event;

  for (const gate of warpGates) {
    // 既に2点設定済みならスキップ
    if (gate.gateArea.firstPos && gate.gateArea.secondPos) continue;

    if (gate.creatingPlayer && gate.creatingPlayer.name === player.name) {
      // 1つ目のブロック破壊処理
      if (!gate.gateArea.firstPos) {
        gate.gateArea.firstPos = { x: event.block.location.x, y: event.block.location.y, z: event.block.location.z };
        player.sendMessage(translate(player, "command.edit.TheFirestBlock"));
        event.cancel = true;
        return;
      } else {
        // 2つ目のブロック破壊処理
        gate.gateArea.secondPos = { x: event.block.location.x, y: event.block.location.y, z: event.block.location.z };
        player.sendMessage(translate(player, "command.edit.TheSecond"));
        gate.creatingPlayer = undefined;
        event.cancel = true;
        saveGate();
        return;
      }
    }
  }
}

// サブコマンドの処理関数
function handleCreate(player: Player, args: string[]) {
  if (args.length !== 5) {
    player.sendMessage(translate(player, "command.warp.WarpUsage"));
    return;
  }

  const gatename = args[1];
  const destinationX = parseInt(args[2], 10);
  const destinationY = parseInt(args[3], 10);
  const destinationZ = parseInt(args[4], 10);

  if (warpGates.some(gate => gate.name === gatename)) {
    player.sendMessage(translate(player, "command.warp.AlreadyWarp"));
    return;
  }

  const newGate: WarpGate = {
    name: gatename,
    destination: { x: destinationX, y: destinationY, z: destinationZ },
    gateArea: {},
    creatingPlayer: player,
  };
  warpGates.push(newGate);

  player.sendMessage(translate(player, "command.warp.CreateGate", { gatename: `${gatename}` }));
}

function handleDelete(player: Player, args: string[]) {
  if (args.length !== 2) {
    player.sendMessage(translate(player, "server.Invalid"));
    return;
  }

  const gatename = args[1];
  const gateIndex = warpGates.findIndex((gate) => gate.name === gatename);
  if (gateIndex === -1) {
    player.sendMessage(translate(player, "command.warp.NotWarp"));
    return;
  }
  warpGates.splice(gateIndex, 1);
  player.sendMessage(translate(player, "command.warp.deleteWarp", { gatename: `${gatename}` }));
  saveGate();
}

function handleList(player: Player) {
  if (warpGates.length === 0) {
    player.sendMessage(translate(player, "command.warp.NotWarpSetting"));
    return;
  }

  let message = translate(player, "command.warp.listGate");
  for (const gate of warpGates) {
    message += `§7- ${gate.name}: (${gate.destination.x}, ${gate.destination.y}, ${gate.destination.z})\n`;
  }
  player.sendMessage(message);
  saveGate();
}

// コマンド登録
registerCommand({
  name: 'warpgate',
  description: 'warpgate_docs',
  parent: false,
  maxArgs: 5,
  minArgs: 1,
  require: (player: Player) => verifier(player, config().commands['warpgate']),
  executor: (player: Player, args: string[]) => {
    if (args.length === 0) {
      player.sendMessage(translate(player, "server.Invalid"));
      return;
    }

    const subCommand = args[0].toLowerCase();

    switch (subCommand) {
      case '-create':
        handleCreate(player, args);
        break;

      case '-delete':
        handleDelete(player, args);
        break;
      case '-list':
        handleList(player);
        break;
      case '-dev':
        console.warn(JSON.stringify(warpGates, null, 2));
        break;

      default:
        player.sendMessage(translate(player, "command.warp.UsageGate", { prefix: `${prefix}` }));
        break;
    }
  },
});


// プレイヤーがゲートの範囲内に入ったかチェックする関数
function checkGateEntry(player: Player) {
  const playerX = Math.floor(player.location.x);
  const playerY = Math.floor(player.location.y);
  const playerZ = Math.floor(player.location.z);

  for (const gate of warpGates) {
    const area = gate.gateArea;
    if (!area.firstPos || !area.secondPos) continue;

    const minX = Math.min(area.firstPos.x, area.secondPos.x);
    const maxX = Math.max(area.firstPos.x, area.secondPos.x);
    const minY = Math.min(area.firstPos.y, area.secondPos.y);
    const maxY = Math.max(area.firstPos.y, area.secondPos.y);
    const minZ = Math.min(area.firstPos.z, area.secondPos.z);
    const maxZ = Math.max(area.firstPos.z, area.secondPos.z);

    if (
      playerX >= minX && playerX <= maxX &&
      playerY >= minY && playerY <= maxY &&
      playerZ >= minZ && playerZ <= maxZ
    ) {
      player.teleport(gate.destination);
      player.sendMessage(translate(player, "command.warp.TPGATE", { gate: `${gate.name}` }));
      // 重複テレポートを防ぐために break;
      break;
    }
  }
}

// 一定間隔でプレイヤーの位置をチェック
system.runInterval(() => {
  for (const player of world.getPlayers()) {
    checkGateEntry(player);
  }
}, 10); // 20tick ごと (1秒ごと) 


world.beforeEvents.playerBreakBlock.subscribe(handleBlockBreak);