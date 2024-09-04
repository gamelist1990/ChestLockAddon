import { c } from '../../Modules/Util';
import { registerCommand, verifier, prefix, runCommand } from '../../Modules/Handler';
import { Player, world, system, BlockTypes, EntityInventoryComponent } from '@minecraft/server';
import { translate } from '../langs/list/LanguageManager'; // 翻訳機能を追加

// プレイヤーごとの選択範囲と選択状態を格納する変数
const playerData: { [playerName: string]: { pos1: any, pos2: any, selecting: boolean, commandArgs: string[] } } = {};

// プレイヤーごとのツール設定を格納する変数
const playerDataTool: { [playerName: string]: { tool: string, blockId: string, outlineRadius?: number, smoothRadius?: number, filledCircleRadius?: number } } = {};

// ブロック破壊イベントリスナー
world.beforeEvents.playerBreakBlock.subscribe(event => {
  const player = event.player;

  // プレイヤーが範囲選択中かどうかを確認
  if (playerData[player.name]?.selecting) {
    // プレイヤーが持っているアイテム
    const inventoryComponent = player.getComponent('minecraft:inventory') as EntityInventoryComponent;
    const heldItem = inventoryComponent && inventoryComponent.container ? inventoryComponent.container.getItem(player.selectedSlotIndex) : null;

    // プレイヤーがツールを使用中かどうかを確認
    if (playerDataTool[player.name]) {
      // ツールを使用中の場合: 木のクワを持っているか確認
      if (heldItem && heldItem.typeId === 'minecraft:wooden_hoe') {
        if (playerDataTool[player.name].tool === 'outline' || playerDataTool[player.name].tool === 'filledCircle' || playerDataTool[player.name].tool === 'smooth') {
          handleBlockBreakForSingleSelection(player, event.block.location);
        } else {
          handleBlockBreakForSelection(player, event.block.location);
        }
        event.cancel = true;
      }
    } else {
      // ツールを使用していない場合: アイテムチェックなしで handleBlockBreakForSelection を実行
      handleBlockBreakForSelection(player, event.block.location);
      event.cancel = true; // 必要に応じて追加
    }
  }
});

// 範囲選択処理を行う関数 (2点選択)
function handleBlockBreakForSelection(player: Player, blockLocation: any): void {
  const selection = playerData[player.name];

  // 1点目と2点目を設定
  if (!selection.pos1) {
    selection.pos1 = blockLocation;
    player.sendMessage(translate(player, "command.FirstPointSet")); // 翻訳キーを使用
  } else if (!selection.pos2) {
    selection.pos2 = blockLocation;
    player.sendMessage(translate(player, "command.SecondPointSet")); // 翻訳キーを使用
    player.sendMessage(translate(player, "command.SelectionCompleted")); // 翻訳キーを使用
    selection.selecting = false; // 範囲選択終了

    // 範囲選択完了後に、コマンドで指定された処理を実行
    executeCommandAfterSelection(player);
  }
}

// 1点のみを選択する関数
function handleBlockBreakForSingleSelection(player: Player, blockLocation: any): void {
  const selection = playerData[player.name];

  // 点を設定
  selection.pos1 = blockLocation;
  player.sendMessage(translate(player, "command.PointSet")); // 翻訳キーを使用
  selection.selecting = false; // 範囲選択終了

  // 範囲選択完了後に、コマンドで指定された処理を実行
  executeCommandAfterSelection(player);
}

// 有効なブロックIDかどうかを検証する関数
function isValidBlockId(blockId: string): boolean {
  return BlockTypes.get(blockId) !== undefined;
}

function calculateEndCoordinate(start: number, max: number, chunkSize: number): number {
  return Math.min(start + chunkSize - 1, max);
}

function fillBlocks(pos1: any, pos2: any, blockId: string) {
  // pos1 と pos2 が null でないことを確認
  if (!pos1 || !pos2) {
    return; // pos1 または pos2 が null の場合は処理を中断
  }

  const minX = Math.max(Math.min(pos1.x, pos2.x));
  const maxX = Math.min(Math.max(pos1.x, pos2.x));
  const minY = Math.max(Math.min(pos1.y, pos2.y));
  const maxY = Math.min(Math.max(pos1.y, pos2.y));
  const minZ = Math.max(Math.min(pos1.z, pos2.z));
  const maxZ = Math.min(Math.max(pos1.z, pos2.z));

  const chunkSize = 30;
  let commands: string[] = []; // 実行するコマンドを格納する配列

  // コマンドを配列に格納
  for (let x = minX; x <= maxX; x += chunkSize) {
    for (let y = minY; y <= maxY; y += chunkSize) {
      for (let z = minZ; z <= maxZ; z += chunkSize) {
        const endX = calculateEndCoordinate(x, maxX, chunkSize);
        const endY = calculateEndCoordinate(y, maxY, chunkSize);
        const endZ = calculateEndCoordinate(z, maxZ, chunkSize);

        const command = `/fill ${Math.floor(x)} ${Math.floor(y)} ${Math.floor(z)} ${Math.floor(endX)} ${Math.floor(endY)} ${Math.floor(endZ)} ${blockId} replace`;
        commands.push(command);
      }
    }
  }

  let currentCommandIndex = 0; // 現在実行するコマンドのインデックス

  // tick イベントハンドラを登録
  system.runInterval(() => {
    if (currentCommandIndex < commands.length) {
      const command = commands[currentCommandIndex];
      world.getDimension('overworld').runCommand(command);
      // console.warn(`Executed command: ${command}`);
      currentCommandIndex++;
    }
  }, 1); // 1tick ごとに実行
}

// Undo 機能に必要なデータ構造
interface EditAction {
  type: 'fill' | 'clear' | 'walls' | 'outline' | 'filledCircle' | 'smooth';
  pos1: any;
  pos2: any;
  blockId?: string; // fill, walls, outline, filledCircle, smooth に必要
  radius?: number; // outline, filledCircle, smooth に必要
  originalBlocks: BlockData[]; // 変更前のブロックデータを保存
}

interface BlockData {
  x: number;
  y: number;
  z: number;
  blockId: string;
}

const undoStack: { [playerName: string]: EditAction[] } = {}; // プレイヤーごとの undo スタック

// ブロックの情報を取得する関数
function getBlockData(location: any): BlockData {
  const block = world.getDimension('overworld').getBlock(location);
  if (!block) {
    throw new Error("Block not found at location: " + JSON.stringify(location));
  }
  return {
    x: location.x,
    y: location.y,
    z: location.z,
    blockId: block.typeId,
  };
}


// ブロックの情報を設定する関数
function setBlockData(blockData: BlockData): void {
  fillBlocks({ x: blockData.x, y: blockData.y, z: blockData.z }, { x: blockData.x, y: blockData.y, z: blockData.z }, blockData.blockId);
}

function fillBlocksWithUndo(pos1: any, pos2: any, blockId: string, player: Player) {
  const originalBlocks: BlockData[] = [];

  const minX = Math.max(Math.min(pos1.x, pos2.x));
  const maxX = Math.min(Math.max(pos1.x, pos2.x));
  const minY = Math.max(Math.min(pos1.y, pos2.y));
  const maxY = Math.min(Math.max(pos1.y, pos2.y));
  const minZ = Math.max(Math.min(pos1.z, pos2.z));
  const maxZ = Math.min(Math.max(pos1.z, pos2.z));

  const overworld = world.getDimension('overworld');
  const heightRange = overworld.heightRange;

  const worldBounds = {
    minX: -30000000,
    minY: heightRange.min,
    minZ: -30000000,
    maxX: 30000000,
    maxY: heightRange.max,
    maxZ: 30000000,
  };

  for (let x = Math.max(minX, worldBounds.minX); x <= Math.min(maxX, worldBounds.maxX); x++) {
    for (let y = Math.max(minY, worldBounds.minY); y <= Math.min(maxY, worldBounds.maxY); y++) {
      for (let z = Math.max(minZ, worldBounds.minZ); z <= Math.min(maxZ, worldBounds.maxZ); z++) {
        try {
          originalBlocks.push(getBlockData({ x, y, z }));
        } catch (error:any) {
          if (error.message.includes("Block not found")) {
            console.log("指定された座標にブロックが見つかりませんでした。スクリプトを続行します。");
          } else {
            throw error;
          }
        }
      }
    }
  }

  const chunkSize = 30;
  let commands: string[] = [];

  for (let x = minX; x <= maxX; x += chunkSize) {
    for (let y = minY; y <= maxY; y += chunkSize) {
      for (let z = minZ; z <= maxZ; z += chunkSize) {
        const endX = calculateEndCoordinate(x, maxX, chunkSize);
        const endY = calculateEndCoordinate(y, maxY, chunkSize);
        const endZ = calculateEndCoordinate(z, maxZ, chunkSize);

        const command = `/fill ${Math.floor(x)} ${Math.floor(y)} ${Math.floor(z)} ${Math.floor(endX)} ${Math.floor(endY)} ${Math.floor(endZ)} ${blockId} replace`;
        commands.push(command);
      }
    }
  }

  let currentCommandIndex = 0;

  system.runInterval(() => {
    if (currentCommandIndex < commands.length) {
      const command = commands[currentCommandIndex];
      world.getDimension('overworld').runCommand(command);
      currentCommandIndex++;
    }
  }, 1);

  if (!undoStack[player.name]) {
    undoStack[player.name] = [];
  }
  undoStack[player.name].push({
    type: 'fill',
    pos1,
    pos2,
    blockId,
    originalBlocks,
  });
}


function createWallsWithUndo(pos1: any, pos2: any, blockId: string, player: Player) {
  const originalBlocks: BlockData[] = [];

  const minX = Math.min(pos1.x, pos2.x);
  const maxX = Math.max(pos1.x, pos2.x);
  const minY = Math.min(pos1.y, pos2.y);
  const maxY = Math.max(pos1.y, pos2.y);
  const minZ = Math.min(pos1.z, pos2.z);
  const maxZ = Math.max(pos1.z, pos2.z);

  // createWalls のループ処理の前に originalBlocks に変更前のブロックデータを保存
  for (let x = minX; x <= maxX; x++) {
    for (let y = minY + 1; y <= maxY; y++) {
      originalBlocks.push(getBlockData({ x, y, z: minZ }));
      originalBlocks.push(getBlockData({ x, y, z: maxZ }));
      if (x === minX || x === maxX) {
        for (let z = minZ + 1; z <= maxZ - 1; z++) {
          originalBlocks.push(getBlockData({ x, y, z }));
        }
      }
    }
  }

  // createWalls の元のループ処理
  for (let x = minX; x <= maxX; x++) {
    for (let y = minY + 1; y <= maxY; y++) {
      fillBlocks({ x, y, z: minZ }, { x, y, z: minZ }, blockId); // 前面
      fillBlocks({ x, y, z: maxZ }, { x, y, z: maxZ }, blockId); // 後面
      if (x === minX || x === maxX) {
        fillBlocks({ x, y, z: minZ + 1 }, { x, y, z: maxZ - 1 }, blockId); // 左右側面
      }
    }
  }

  // undoStack にアクションを追加
  if (!undoStack[player.name]) {
    undoStack[player.name] = [];
  }
  undoStack[player.name].push({
    type: 'walls',
    pos1,
    pos2,
    blockId,
    originalBlocks,
  });
}


function createOutlineWithUndo(center: any, radius: number, blockId: string, player: Player) {
  const originalBlocks: BlockData[] = [];

  const minX = center.x - radius;
  const maxX = center.x + radius;
  const minY = center.y - radius;
  const maxY = center.y + radius;
  const minZ = center.z - radius;
  const maxZ = center.z + radius;


  for (let x = minX; x <= maxX; x++) {
    for (let y = minY; y <= maxY; y++) {
      for (let z = minZ; z <= maxZ; z++) {
        const distance = Math.sqrt(
          Math.pow(x - center.x, 2) +
          Math.pow(y - center.y, 2) +
          Math.pow(z - center.z, 2)
        );

        if (distance >= radius - 0.5 && distance <= radius + 0.5) {
          originalBlocks.push(getBlockData({ x, y, z }));
        }
      }
    }
  }

  // createOutline の元のループ処理
  for (let x = minX; x <= maxX; x++) {
    for (let y = minY; y <= maxY; y++) {
      for (let z = minZ; z <= maxZ; z++) {
        const distance = Math.sqrt(
          Math.pow(x - center.x, 2) +
          Math.pow(y - center.y, 2) +
          Math.pow(z - center.z, 2)
        );
        if (distance >= radius - 0.5 && distance <= radius + 0.5) {
          fillBlocks({ x, y, z }, { x, y, z }, blockId);
        }
      }
    }
  }


  if (!undoStack[player.name]) {
    undoStack[player.name] = [];
  }
  undoStack[player.name].push({
    type: 'outline',
    pos1: center, // pos1 を center に設定
    pos2: null, // pos2 は使用しないので null に設定
    blockId,
    radius,
    originalBlocks,
  });
}


function createFilledCircleWithUndo(center: any, radius: number, blockId: string, player: Player) {
  const originalBlocks: BlockData[] = [];

  const minX = center.x - radius;
  const maxX = center.x + radius;
  const minY = center.y - radius;
  const maxY = center.y + radius;
  const minZ = center.z - radius;
  const maxZ = center.z + radius;

  // createFilledCircle のループ処理の前に originalBlocks に変更前のブロックデータを保存
  for (let x = minX; x <= maxX; x++) {
    for (let z = minZ; z <= maxZ; z++) {
      for (let y = minY; y <= maxY; y++) {
        const distance = Math.sqrt(
          Math.pow(x - center.x, 2) +
          Math.pow(y - center.y, 2) +
          Math.pow(z - center.z, 2)
        );

        if (distance <= radius) {
          originalBlocks.push(getBlockData({ x, y, z }));
        }
      }
    }
  }

  // createFilledCircle の元のループ処理
  for (let x = minX; x <= maxX; x++) {
    for (let z = minZ; z <= maxZ; z++) {
      for (let y = minY; y <= maxY; y++) {
        const distance = Math.sqrt(
          Math.pow(x - center.x, 2) +
          Math.pow(y - center.y, 2) +
          Math.pow(z - center.z, 2)
        );

        if (distance <= radius) {
          fillBlocks({ x, y, z }, { x, y, z }, blockId);
        }
      }
    }
  }

  // undoStack にアクションを追加
  if (!undoStack[player.name]) {
    undoStack[player.name] = [];
  }
  undoStack[player.name].push({
    type: 'filledCircle',
    pos1: center, // pos1 を center に設定
    pos2: null, // pos2 は使用しないので null に設定
    blockId,
    radius,
    originalBlocks,
  });
}


function smoothAreaWithUndo(center: any, radius: number, blockId: string, player: Player): void {
  const originalBlocks: BlockData[] = [];

  const minX = Math.floor(center.x - radius);
  const maxX = Math.floor(center.x + radius);
  const minZ = Math.floor(center.z - radius);
  const maxZ = Math.floor(center.z + radius);
  const y = Math.floor(center.y);

  // smoothArea のループ処理の前に originalBlocks に変更前のブロックデータを保存
  for (let x = minX; x <= maxX; x++) {
    for (let z = minZ; z <= maxZ; z++) {
      for (let currentY = y - radius; currentY <= y + radius; currentY++) {
        originalBlocks.push(getBlockData({ x, y: currentY, z }));
      }
    }
  }

  // smoothArea の元のループ処理
  for (let x = minX; x <= maxX; x++) {
    for (let z = minZ; z <= maxZ; z++) {
      // 指定の高さまでブロックで埋める
      for (let currentY = y - radius; currentY <= y; currentY++) {
        fillBlocks({ x, y: currentY, z }, { x, y: currentY, z }, blockId);
      }
      // 上面を空気ブロックにする
      for (let currentY = y + 1; currentY <= y + radius; currentY++) {
        fillBlocks({ x, y: currentY, z }, { x, y: currentY, z }, 'minecraft:air');
      }
    }
  }

  // undoStack にアクションを追加
  if (!undoStack[player.name]) {
    undoStack[player.name] = [];
  }
  undoStack[player.name].push({
    type: 'smooth',
    pos1: center, // pos1 を center に設定
    pos2: null, // pos2 は使用しないので null に設定
    blockId,
    radius,
    originalBlocks,
  });
}

// 範囲選択完了後に実行するコマンドを処理
function executeCommandAfterSelection(player: Player) {
  const data = playerData[player.name];
  if (!data || !data.pos1) {
    return;
  }

  const args = data.commandArgs; // コマンド実行時に保存しておいた引数
  const toolData = playerDataTool[player.name]; // ツールデータ

  system.runTimeout(() => {
    if (toolData) {
      // ツール使用時の処理
      const tool = toolData.tool;
      const blockId = toolData.blockId;

      if (tool === 'walls') {
        if (isValidBlockId(blockId)) {
          createWallsWithUndo(data.pos1, data.pos2, blockId, player);
          player.sendMessage(translate(player, "command.WallsCreated")); // 翻訳キーを使用
          system.runTimeout(() => {
            runCommand(player.name, 'edit', ['-start']);
          }, 20);
        } else {
          player.sendMessage(translate(player, "command.InvalidBlockId")); // 翻訳キーを使用
        }
      } else if (tool === 'outline') {
        if (isValidBlockId(blockId)) {
          const radius = toolData.outlineRadius || 5;
          createOutlineWithUndo(data.pos1, radius, blockId, player);
          player.sendMessage(translate(player, "command.OutlineCreated")); // 翻訳キーを使用
          system.runTimeout(() => {
            runCommand(player.name, 'edit', ['-start']);
          }, 20);
        } else {
          player.sendMessage(translate(player, "command.InvalidBlockId")); // 翻訳キーを使用
        }
      } else if (tool === 'filledCircle') {
        if (isValidBlockId(blockId)) {
          // filledCircleRadius が設定されている場合はそれを使用、そうでなければデフォルト値 5 を使用
          const radius = toolData.filledCircleRadius || 5; // playerDataTool から半径を取得
          createFilledCircleWithUndo(data.pos1, radius, blockId, player);
          player.sendMessage(translate(player, "FilledCircleCreated")); // 翻訳キーを使用
          runCommand(player.name, 'edit', ['-start']);
        } else {
          player.sendMessage(translate(player, "command.InvalidBlockId")); // 翻訳キーを使用
        }
      } else if (tool === 'smooth') {
        if (isValidBlockId(blockId)) {
          const radius = toolData.smoothRadius || 5;
          smoothAreaWithUndo(data.pos1, radius, blockId, player);
          player.sendMessage(translate(player, "smoothCreate")); // 翻訳キーを使用
          system.runTimeout(() => {
            runCommand(player.name, 'edit', ['-start']);
          }, 20);
        } else {
          player.sendMessage(translate(player, "command.InvalidBlockId")); // 翻訳キーを使用
        }
      }

      // ツールを使用した場合はプレイヤーデータを削除
      delete playerData[player.name];

    } else if (args[0] === '-set' && args.length === 2) {
      // -set の処理
      const blockId = args[1];

      if (isValidBlockId(blockId)) {
        fillBlocksWithUndo(data.pos1, data.pos2, blockId, player);
        player.sendMessage(translate(player, "RangeSet", { blockId: blockId })); // 翻訳キーを使用、データを渡す
      } else {
        player.sendMessage(translate(player, "command.InvalidBlockId")); // 翻訳キーを使用
      }

      // -set を使用した場合はプレイヤーデータを削除
      delete playerData[player.name];

    } else if (args[0] === '-clear') {
      // -clear の処理
      const originalBlocks: BlockData[] = [];
      const minX = Math.min(data.pos1.x, data.pos2.x);
      const maxX = Math.max(data.pos1.x, data.pos2.x);
      const minY = Math.min(data.pos1.y, data.pos2.y);
      const maxY = Math.max(data.pos1.y, data.pos2.y);
      const minZ = Math.min(data.pos1.z, data.pos2.z);
      const maxZ = Math.max(data.pos1.z, data.pos2.z);

      for (let x = minX; x <= maxX; x++) {
        for (let y = minY; y <= maxY; y++) {
          for (let z = minZ; z <= maxZ; z++) {
            originalBlocks.push(getBlockData({ x, y, z }));
          }
        }
      }

      fillBlocks(data.pos1, data.pos2, "minecraft:air");

      // undoStack にアクションを追加
      if (!undoStack[player.name]) {
        undoStack[player.name] = [];
      }
      undoStack[player.name].push({
        type: 'clear',
        pos1: data.pos1,
        pos2: data.pos2,
        originalBlocks,
      });

      player.sendMessage(translate(player, "RangeCleared")); // 翻訳キーを使用

      // -clear を使用した場合はプレイヤーデータを削除
      delete playerData[player.name];

    }  else if (args[0] === '-walls' && args.length === 2) { // walls コマンドを追加
      const blockId = args[1];
      if (isValidBlockId(blockId)) {
        data.commandArgs = args;
        data.selecting = true;
        player.sendMessage(translate(player, "StartRangeSelection2"));
      } else {
        player.sendMessage(translate(player, "command.InvalidBlockId"));
      }
    } else if (args[0] === '-outline' && args.length === 3 && !isNaN(parseInt(args[1]))) { // outline コマンドを追加
      const radius = parseInt(args[1]);
      const blockId = args[2];
      if (isValidBlockId(blockId)) {
        playerDataTool[player.name] = { tool: 'outline', blockId, outlineRadius: radius };
        data.commandArgs = args;
        data.selecting = true;
        player.sendMessage(translate(player, "StartRangeSelection"));
      } else {
        player.sendMessage(translate(player, "command.InvalidBlockId"));
      }
    } else if (args[0] === '-filledCircle' && args.length === 3 && !isNaN(parseInt(args[1]))) { // filledCircle コマンドを追加
      const radius = parseInt(args[1]);
      const blockId = args[2];
      if (isValidBlockId(blockId)) {
        playerDataTool[player.name] = { tool: 'filledCircle', blockId, filledCircleRadius: radius };
        data.commandArgs = args;
        data.selecting = true;
        player.sendMessage(translate(player, "StartRangeSelection"));
      } else {
        player.sendMessage(translate(player, "command.InvalidBlockId"));
      }
    } else if (args[0] === '-smooth' && args.length === 3 && !isNaN(parseInt(args[1]))) { // smooth コマンドを追加
      const radius = parseInt(args[1]);
      const blockId = args[2];
      if (isValidBlockId(blockId)) {
        playerDataTool[player.name] = { tool: 'smooth', blockId, smoothRadius: radius };
        data.commandArgs = args;
        data.selecting = true;
        player.sendMessage(translate(player, "StartRangeSelection"));
      } else {
        player.sendMessage(translate(player, "command.InvalidBlockId"));
      }

    } else {
      // 不正な引数の場合はエラーメッセージを表示
      player.sendMessage(translate(player, "InvalidCommandUsage", { prefix: `${prefix}` })); // 翻訳キーを使用、データを渡す
    }

    // プレイヤーデータ自体は削除しない (ツール使用時のみ削除)
  }, 20);
}


// コマンド登録
registerCommand({
  name: 'edit',
  description: 'editCom',
  parent: false,
  maxArgs: 3, // 最大引数を3に増やす
  minArgs: 1,
  require: (player: Player) => verifier(player, c().commands['edit']),
  executor: (player: Player, args: string[]) => {
    // プレイヤーのデータを取得または初期化
    if (!playerData[player.name]) {
      playerData[player.name] = { pos1: null, pos2: null, selecting: false, commandArgs: [] };
    }
    const data = playerData[player.name];

    if (args[0] === 'tool') {
      // tool サブコマンド
      if (args[1] === '-wall' && args.length === 3) {
        const blockId = args[2];
        if (isValidBlockId(blockId)) {
          playerDataTool[player.name] = { tool: 'walls', blockId };
          player.sendMessage(translate(player, "WallsToolSelected", { blockId: `${blockId}` })); // 翻訳キーを使用、データを渡す
        } else {
          player.sendMessage(translate(player, "command.InvalidBlockId")); // 翻訳キーを使用
        }
      } else if (args[1] === '-outline' && args.length === 4 && !isNaN(parseInt(args[2]))) {
        // outline ツールで半径とブロックIDを指定
        const radius = parseInt(args[2]);
        const blockId = args[3];
        if (isValidBlockId(blockId)) {
          playerDataTool[player.name] = { tool: 'outline', blockId, outlineRadius: radius }; // playerDataTool に半径を保存
          player.sendMessage(translate(player, "OutlineToolSelected", { radius: `${radius}`, blockId: `${blockId}` })); // 翻訳キーを使用、データを渡す
        } else {
          player.sendMessage(translate(player, "command.InvalidBlockId")); // 翻訳キーを使用
        }
      } else if (args[1] === '-filledCircle' && args.length === 4 && !isNaN(parseInt(args[2]))) {
        // filledCircle ツールで半径とブロックIDを指定
        const radius = parseInt(args[2]);
        const blockId = args[3];
        if (isValidBlockId(blockId)) {
          playerDataTool[player.name] = { tool: 'filledCircle', blockId, filledCircleRadius: radius }; // playerDataTool に半径を保存
          player.sendMessage(translate(player, "FilledCircleToolSelected", { radius: `${radius}`, blockId: `${blockId}` })); // 翻訳キーを使用、データを渡す
        } else {
          player.sendMessage(translate(player, "command.InvalidBlockId")); // 翻訳キーを使用
        }
      } else if (args[1] === '-smooth' && args.length === 4 && !isNaN(parseInt(args[2]))) {
        // outline ツールで半径とブロックIDを指定
        const radius = parseInt(args[2]);
        const blockId = args[3];
        if (isValidBlockId(blockId)) {
          playerDataTool[player.name] = { tool: 'smooth', blockId, smoothRadius: radius }; // playerDataTool に半径を保存
          player.sendMessage(translate(player, "OutlineToolSelected", { radius: `${radius}`, blockId: `${blockId}` })); // 翻訳キーを使用、データを渡す
        } else {
          player.sendMessage(translate(player, "command.InvalidBlockId")); // 翻訳キーを使用
        }
      } else if (args[1] === '-exit') {
        // ツールを終了
        delete playerDataTool[player.name];
        player.sendMessage(translate(player, "ToolExited")); // 翻訳キーを使用
      } else {
        player.sendMessage(translate(player, "ToolOptions")); // 翻訳キーを使用
      }

    } else if (args[0] === '-set' && args.length === 2) {
      // -set コマンド
      // 範囲選択を開始
      data.commandArgs = args; // コマンド引数を保存
      data.selecting = true;
      player.sendMessage(translate(player, "StartRangeSelection2")); // 翻訳キーを使用

    } else if (args[0] === '-clear') {
      // -clear コマンド
      // 範囲選択を開始
      data.commandArgs = args; // コマンド引数を保存
      data.selecting = true;
      player.sendMessage(translate(player, "StartRangeSelection2")); // 翻訳キーを使用

    } else if (args[0] === '-start') { // !edit -start コマンドの処理を追加
      data.selecting = true;
      player.sendMessage(translate(player, "StartRangeSelection")); // 翻訳キーを使用

    } else if (args[0] === '-undo') {
      // -undo コマンドの処理
      if (undoStack[player.name] && undoStack[player.name].length > 0) {
        const lastAction = undoStack[player.name].pop()!;

        if (lastAction.type === 'fill' || lastAction.type === 'clear' || lastAction.type === 'walls' || lastAction.type === 'outline' || lastAction.type === 'filledCircle' || lastAction.type === 'smooth') {
          lastAction.originalBlocks.forEach(blockData => {
            setBlockData(blockData);
          });
          player.sendMessage(translate(player, "command.Undone")); // 翻訳キーを使用
        }
      } else {
        player.sendMessage(translate(player, "command.NothingToUndo")); // 翻訳キーを使用
      }

    } else {
      // 不正な引数の場合はエラーメッセージを表示
      player.sendMessage(translate(player, "InvalidCommandUsage", { prefix: `${prefix}` })); // 翻訳キーを使用、データを渡す
    }
  },
});