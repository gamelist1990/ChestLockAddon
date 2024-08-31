import { c } from '../../Modules/Util';
import { registerCommand, verifier, prefix, runCommand } from '../../Modules/Handler';
import { Player, world, system, BlockTypes, EntityInventoryComponent } from '@minecraft/server';
import { translate } from '../langs/list/LanguageManager'; // 翻訳機能を追加

// プレイヤーごとの選択範囲と選択状態を格納する変数
const playerData: { [playerName: string]: { pos1: any, pos2: any, selecting: boolean, commandArgs: string[] } } = {};

// プレイヤーごとのツール設定を格納する変数
const playerDataTool: { [playerName: string]: { tool: string, blockId: string, outlineRadius?: number, filledCircleRadius?: number } } = {};

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
        if (playerDataTool[player.name].tool === 'outline' || playerDataTool[player.name].tool === 'filledCircle') {
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
    player.sendMessage(translate(player, "FirstPointSet")); // 翻訳キーを使用
  } else if (!selection.pos2) {
    selection.pos2 = blockLocation;
    player.sendMessage(translate(player, "SecondPointSet")); // 翻訳キーを使用
    player.sendMessage(translate(player, "SelectionCompleted")); // 翻訳キーを使用
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
  player.sendMessage(translate(player, "PointSet")); // 翻訳キーを使用
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

  // 世界の境界内に制限
  const minX = Math.min(pos1.x, pos2.x);
  const maxX = Math.max(pos1.x, pos2.x);
  const minY = Math.min(pos1.y, pos2.y);
  const maxY = Math.max(pos1.y, pos2.y);
  const minZ = Math.min(pos1.z, pos2.z);
  const maxZ = Math.max(pos1.z, pos2.z);

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
      console.log(`Executed command: ${command}`);
      currentCommandIndex++;
    } else {
    }
  }, 1); // 1tick ごとに実行
}

function createWalls(pos1: any, pos2: any, blockId: string) {
  const minX = Math.min(pos1.x, pos2.x);
  const maxX = Math.max(pos1.x, pos2.x);
  const minY = Math.min(pos1.y, pos2.y);
  const maxY = Math.max(pos1.y, pos2.y);
  const minZ = Math.min(pos1.z, pos2.z);
  const maxZ = Math.max(pos1.z, pos2.z);

  // 指定された2点の間にベルリンの壁を作成 (上面と底面を除く)
  for (let x = minX; x <= maxX; x++) {
    for (let y = minY + 1; y <= maxY; y++) { // 底面を除外するために minY + 1 から開始
      fillBlocks({ x, y, z: minZ }, { x, y, z: minZ }, blockId); // 前面
      fillBlocks({ x, y, z: maxZ }, { x, y, z: maxZ }, blockId); // 後面
      if (x === minX || x === maxX) {
        fillBlocks({ x, y, z: minZ + 1 }, { x, y, z: maxZ - 1 }, blockId); // 左右側面
      }
    }
  }
}

// outline ツールの実装 (fillBlocks を使用)
function createOutline(center: any, radius: number, blockId: string) {
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
          fillBlocks({ x, y, z }, { x, y, z }, blockId);
        }
      }
    }
  }
}

// filledCircle ツールの実装 (fillBlocks を使用)
function createFilledCircle(center: any, radius: number, blockId: string) {
  const minX = center.x - radius;
  const maxX = center.x + radius;
  const minY = center.y - radius;
  const maxY = center.y + radius;
  const minZ = center.z - radius;
  const maxZ = center.z + radius;

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
}

// 範囲選択完了後に実行するコマンドを処理
function executeCommandAfterSelection(player: Player) {
  const data = playerData[player.name];
  if (!data || !data.pos1) {
    // pos1 が設定されていない場合は処理を中断
    return;
  }

  const args = data.commandArgs; // コマンド実行時に保存しておいた引数
  const toolData = playerDataTool[player.name]; // ツールデータ

  // 20tick（1秒）待機してからコマンドを実行 (必要に応じて調整)
  system.runTimeout(() => {
    if (toolData) {
      // ツール使用時の処理
      const tool = toolData.tool;
      const blockId = toolData.blockId;

      if (tool === 'walls') {
        if (isValidBlockId(blockId)) {
          createWalls(data.pos1, data.pos2, blockId);
          player.sendMessage(translate(player, "WallsCreated")); // 翻訳キーを使用
          system.runTimeout(() => { 
            runCommand(player.name,'edit',['-start']);
          },20);
        } else {
          player.sendMessage(translate(player, "InvalidBlockId")); // 翻訳キーを使用
        }
      } else if (tool === 'outline') {
        if (isValidBlockId(blockId)) {
          const radius = toolData.outlineRadius || 5; 
          createOutline(data.pos1, radius, blockId);
          player.sendMessage(translate(player, "OutlineCreated")); // 翻訳キーを使用
          system.runTimeout(() => { 
            runCommand(player.name,'edit',['-start']);
          },20);
        } else {
          player.sendMessage(translate(player, "InvalidBlockId")); // 翻訳キーを使用
        }
      } else if (tool === 'filledCircle') {
        if (isValidBlockId(blockId)) {
          // filledCircleRadius が設定されている場合はそれを使用、そうでなければデフォルト値 5 を使用
          const radius = toolData.filledCircleRadius || 5; // playerDataTool から半径を取得
          createFilledCircle(data.pos1, radius, blockId);
          player.sendMessage(translate(player, "FilledCircleCreated")); // 翻訳キーを使用
          runCommand(player.name,'edit',['-start']);
        } else {
          player.sendMessage(translate(player, "InvalidBlockId")); // 翻訳キーを使用
        }
      }

      // ツールを使用した場合はプレイヤーデータを削除
      delete playerData[player.name];

    } else if (args[0] === '-set' && args.length === 2) {
      // -set の処理
      const blockId = args[1];

      if (isValidBlockId(blockId)) {
        fillBlocks(data.pos1, data.pos2, blockId);
        player.sendMessage(translate(player, "RangeSet", { blockId: blockId })); // 翻訳キーを使用、データを渡す
      } else {
        player.sendMessage(translate(player, "InvalidBlockId")); // 翻訳キーを使用
      }

      // -set を使用した場合はプレイヤーデータを削除
      delete playerData[player.name];

    } else if (args[0] === '-clear') {
      // -clear の処理
      fillBlocks(data.pos1, data.pos2, "minecraft:air");
      player.sendMessage(translate(player, "RangeCleared")); // 翻訳キーを使用

      // -clear を使用した場合はプレイヤーデータを削除
      delete playerData[player.name];

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
          player.sendMessage(translate(player, "WallsToolSelected", { radius: `${radius}`, blockId: `${blockId}` })); // 翻訳キーを使用、データを渡す
        } else {
          player.sendMessage(translate(player, "InvalidBlockId")); // 翻訳キーを使用
        }
      } else if (args[1] === '-outline' && args.length === 4 && !isNaN(parseInt(args[2]))) {
        // outline ツールで半径とブロックIDを指定
        const radius = parseInt(args[2]);
        const blockId = args[3];
        if (isValidBlockId(blockId)) {
          playerDataTool[player.name] = { tool: 'outline', blockId, outlineRadius: radius }; // playerDataTool に半径を保存
          player.sendMessage(translate(player, "OutlineToolSelected", { radius: `${radius}`, blockId: `${blockId}` })); // 翻訳キーを使用、データを渡す
        } else {
          player.sendMessage(translate(player, "InvalidBlockId")); // 翻訳キーを使用
        }
      } else if (args[1] === '-filledCircle' && args.length === 4 && !isNaN(parseInt(args[2]))) {
        // filledCircle ツールで半径とブロックIDを指定
        const radius = parseInt(args[2]);
        const blockId = args[3];
        if (isValidBlockId(blockId)) {
          playerDataTool[player.name] = { tool: 'filledCircle', blockId, filledCircleRadius: radius }; // playerDataTool に半径を保存
          player.sendMessage(translate(player, "FilledCircleToolSelected", { radius: `${radius}`, blockId: `${blockId}` })); // 翻訳キーを使用、データを渡す
        } else {
          player.sendMessage(translate(player, "InvalidBlockId")); // 翻訳キーを使用
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

    } else {
      // 不正な引数の場合はエラーメッセージを表示
      player.sendMessage(translate(player, "InvalidCommandUsage", { prefix: `${prefix}` })); // 翻訳キーを使用、データを渡す
    }
  },
}); 