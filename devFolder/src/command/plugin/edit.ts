import { config } from '../../Modules/Util';
import { registerCommand, verifier, prefix, runCommand } from '../../Modules/Handler';
import { Player, world, system, BlockTypes, Block, Dimension } from '@minecraft/server';
import { translate } from '../langs/list/LanguageManager';
import { EntityInventoryComponent, ItemStack } from '@minecraft/server';

const playerData: { [playerName: string]: { pos1: any, pos2: any, selecting: boolean, commandArgs: string[] } } = {};
const playerDataTool: { [playerName: string]: { tool: string, blockId: string, outlineRadius?: number, smoothRadius?: number, filledCircleRadius?: number } } = {};

// ブロック破壊イベントリスナー
world.beforeEvents.playerBreakBlock.subscribe(event => {
  const player = event.player;
  if (!playerData[player.name]?.selecting) return;

  const inventoryComponent = player.getComponent('minecraft:inventory') as EntityInventoryComponent;
  const heldItem: ItemStack | null = inventoryComponent?.container?.getItem(player.selectedSlotIndex) || null;

  const tool = playerDataTool[player.name]?.tool;
  if (heldItem?.typeId === 'minecraft:wooden_hoe') {
    if (tool === 'outline' || tool === 'smooth') {
      handleBlockBreakForSingleSelection(player, event.block.location);
    } else {
      handleBlockBreakForSelection(player, event.block.location);
    }
    event.cancel = true;
  } else if (!tool) {
    handleBlockBreakForSelection(player, event.block.location);
    event.cancel = true;
  }
});

// 範囲選択処理を行う関数 (2点選択)
function handleBlockBreakForSelection(player: Player, blockLocation: any): void {
  const selection = playerData[player.name];

  if (!selection.pos1) {
    selection.pos1 = blockLocation;
    player.sendMessage(translate(player, "command.edit.FirstPointSet"));
  } else if (!selection.pos2) {
    selection.pos2 = blockLocation;
    player.sendMessage(translate(player, "command.edit.SecondPointSet"));
    player.sendMessage(translate(player, "command.edit.SelectionCompleted"));
    selection.selecting = false;
    executeCommandAfterSelection(player);
  }
}

// 1点のみを選択する関数
function handleBlockBreakForSingleSelection(player: Player, blockLocation: any): void {
  const selection = playerData[player.name];
  selection.pos1 = blockLocation;
  player.sendMessage(translate(player, "command.edit.PointSet"));
  selection.selecting = false;
  executeCommandAfterSelection(player);
}

// 有効なブロックIDかどうかを検証する関数
function isValidBlockId(blockId: string): boolean {
  return BlockTypes.get(blockId) !== undefined;
}

// チャンクサイズの計算
function calculateEndCoordinate(start: number, max: number, chunkSize: number): number {
  return Math.min(start + chunkSize - 1, max);
}

// ブロックをまとめて設置する関数
function fillBlocks(pos1: any, pos2: any, blockId: string): void {
  if (!pos1 || !pos2) return;

  const minX = Math.max(Math.min(pos1.x, pos2.x));
  const maxX = Math.min(Math.max(pos1.x, pos2.x));
  const minY = Math.max(Math.min(pos1.y, pos2.y));
  const maxY = Math.min(Math.max(pos1.y, pos2.y));
  const minZ = Math.max(Math.min(pos1.z, pos2.z));
  const maxZ = Math.min(Math.max(pos1.z, pos2.z));
  const chunkSize = 30;

  const commands: string[] = [];
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
  commands.forEach(command => world.getDimension('overworld').runCommand(command));
}

// Undo 機能に必要なデータ構造
interface EditAction {
  type: 'fill' | 'clear' | 'walls' | 'outline' | 'filledCircle' | 'smooth';
  pos1: any;
  pos2: any;
  blockId?: string;
  radius?: number;
  originalBlocks: BlockData[];
}

interface BlockData {
  x: number;
  y: number;
  z: number;
  blockId: string;
}

const undoStack: { [playerName: string]: EditAction[] } = {};

// ブロックの情報を取得する関数
function getBlockData(location: any): BlockData | null {
  try {
    const block: Block | undefined = world.getDimension('overworld').getBlock(location);
    if (!block) return null;
    return {
      x: location.x,
      y: location.y,
      z: location.z,
      blockId: block.typeId,
    };
  } catch (error: any) {
    console.error("Error getting block data:", error.message, "location:", location);
    return null;
  }

}

// ブロックの情報を設定する関数
function setBlockData(blockData: BlockData): void {
  if (blockData) {
    fillBlocks({ x: blockData.x, y: blockData.y, z: blockData.z }, { x: blockData.x, y: blockData.y, z: blockData.z }, blockData.blockId);
  }
}

// ブロックを設置してアンドゥ情報を記録する関数
function fillBlocksWithUndo(pos1: any, pos2: any, blockId: string, player: Player): void {
  if (!pos1 || !pos2) return;

  const minX = Math.max(Math.min(pos1.x, pos2.x));
  const maxX = Math.min(Math.max(pos1.x, pos2.x));
  const minY = Math.max(Math.min(pos1.y, pos2.y));
  const maxY = Math.min(Math.max(pos1.y, pos2.y));
  const minZ = Math.max(Math.min(pos1.z, pos2.z));
  const maxZ = Math.min(Math.max(pos1.z, pos2.z));

  const overworld: Dimension = world.getDimension('overworld');
  const heightRange = overworld.heightRange;

  const worldBounds = {
    minX: -30000000,
    minY: heightRange.min,
    minZ: -30000000,
    maxX: 30000000,
    maxY: heightRange.max,
    maxZ: 30000000,
  };

  const originalBlocks: BlockData[] = [];
  for (let x = Math.max(minX, worldBounds.minX); x <= Math.min(maxX, worldBounds.maxX); x++) {
    for (let y = Math.max(minY, worldBounds.minY); y <= Math.min(maxY, worldBounds.maxY); y++) {
      for (let z = Math.max(minZ, worldBounds.minZ); z <= Math.min(maxZ, worldBounds.maxZ); z++) {
        const blockData = getBlockData({ x, y, z });
        if (blockData) {
          originalBlocks.push(blockData);
        }
      }
    }
  }

  fillBlocks(pos1, pos2, blockId);

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

// Outlineを作成する関数
function createOutlineWithUndo(center: any, radius: number, blockId: string, player: Player): void {
  const minX = center.x - radius;
  const maxX = center.x + radius;
  const minY = center.y - radius;
  const maxY = center.y + radius;
  const minZ = center.z - radius;
  const maxZ = center.z + radius;

  const originalBlocks: BlockData[] = [];

  for (let x = minX; x <= maxX; x++) {
    for (let y = minY; y <= maxY; y++) {
      for (let z = minZ; z <= maxZ; z++) {
        const distance = Math.sqrt(
          Math.pow(x - center.x, 2) +
          Math.pow(y - center.y, 2) +
          Math.pow(z - center.z, 2)
        );

        if (distance >= radius - 0.5 && distance <= radius + 0.5) {
          const blockData = getBlockData({ x, y, z });
          if (blockData) {
            originalBlocks.push(blockData);
          }
        }
      }
    }
  }


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
    pos1: center,
    pos2: null,
    blockId,
    radius,
    originalBlocks,
  });
}

// 範囲をスムーズにする関数
function smoothAreaWithUndo(center: any, radius: number, blockId: string, player: Player): void {
  const originalBlocks: BlockData[] = [];
  const minX = Math.floor(center.x - radius);
  const maxX = Math.floor(center.x + radius);
  const minZ = Math.floor(center.z - radius);
  const maxZ = Math.floor(center.z + radius);
  const y = Math.floor(center.y);

  for (let x = minX; x <= maxX; x++) {
    for (let z = minZ; z <= maxZ; z++) {
      for (let currentY = y - radius; currentY <= y + radius; currentY++) {
        const blockData = getBlockData({ x, y: currentY, z });
        if (blockData) {
          originalBlocks.push(blockData);
        }
      }
    }
  }


  for (let x = minX; x <= maxX; x++) {
    for (let z = minZ; z <= maxZ; z++) {
      for (let currentY = y - radius; currentY <= y; currentY++) {
        fillBlocks({ x, y: currentY, z }, { x, y: currentY, z }, blockId);
      }
      for (let currentY = y + 1; currentY <= y + radius; currentY++) {
        fillBlocks({ x, y: currentY, z }, { x, y: currentY, z }, 'minecraft:air');
      }
    }
  }


  if (!undoStack[player.name]) {
    undoStack[player.name] = [];
  }
  undoStack[player.name].push({
    type: 'smooth',
    pos1: center,
    pos2: null,
    blockId,
    radius,
    originalBlocks,
  });
}

// 範囲選択完了後に実行するコマンドを処理
function executeCommandAfterSelection(player: Player): void {
  const data = playerData[player.name];
  if (!data || !data.pos1) return;

  const args = data.commandArgs;
  const toolData = playerDataTool[player.name];
  system.runTimeout(() => {
    if (toolData) {
      const { tool, blockId, outlineRadius, smoothRadius } = toolData;
      if (tool === 'outline' && isValidBlockId(blockId)) {
        createOutlineWithUndo(data.pos1, outlineRadius || 5, blockId, player);
        player.sendMessage(translate(player, "command.edit.OutlineCreated"));
        system.runTimeout(() => {
          runCommand(player.name, 'edit', ['-start']);
        }, 20);

      } else if (tool === 'smooth' && isValidBlockId(blockId)) {
        smoothAreaWithUndo(data.pos1, smoothRadius || 5, blockId, player);
        player.sendMessage(translate(player, "smoothCreate"));
        system.runTimeout(() => {
          runCommand(player.name, 'edit', ['-start']);
        }, 20);
      }
      delete playerData[player.name];
    }
    else if (args[0] === '-set' && args.length === 2 && isValidBlockId(args[1])) {
      fillBlocksWithUndo(data.pos1, data.pos2, args[1], player);
      player.sendMessage(translate(player, "command.edit.RangeSet", { blockId: args[1] }));
      delete playerData[player.name];
    } else if (args[0] === '-clear') {
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
            const blockData = getBlockData({ x, y, z });
            if (blockData) {
              originalBlocks.push(blockData);
            }
          }
        }
      }
      fillBlocks(data.pos1, data.pos2, "minecraft:air");
      if (!undoStack[player.name]) {
        undoStack[player.name] = [];
      }
      undoStack[player.name].push({
        type: 'clear',
        pos1: data.pos1,
        pos2: data.pos2,
        originalBlocks,
      });
      player.sendMessage(translate(player, "command.edit.RangeCleared"));
      delete playerData[player.name];
    }
    else if (args[0] === '-outline' && args.length === 3 && !isNaN(parseInt(args[1])) && isValidBlockId(args[2])) {
      playerDataTool[player.name] = { tool: 'outline', blockId: args[2], outlineRadius: parseInt(args[1]) };
      data.commandArgs = args;
      data.selecting = true;
      player.sendMessage(translate(player, "command.edit.StartRangeSelection"));
    }
    else if (args[0] === '-smooth' && args.length === 3 && !isNaN(parseInt(args[1])) && isValidBlockId(args[2])) {
      playerDataTool[player.name] = { tool: 'smooth', blockId: args[2], smoothRadius: parseInt(args[1]) };
      data.commandArgs = args;
      data.selecting = true;
      player.sendMessage(translate(player, "command.edit.StartRangeSelection"));
    }
    else {
      player.sendMessage(translate(player, "command.edit.InvalidCommandUsage", { prefix: `${prefix}` }));
    }
  }, 20);
}


// コマンド登録
registerCommand({
  name: 'edit',
  description: 'edit_docs',
  parent: false,
  maxArgs: 4,
  minArgs: 1,
  require: (player: Player) => verifier(player, config().commands['edit']),
  executor: (player: Player, args: string[]) => {
    if (!playerData[player.name]) {
      playerData[player.name] = { pos1: null, pos2: null, selecting: false, commandArgs: [] };
    }
    const data = playerData[player.name];
    if (args[0] === 'tool') {
      if (args[1] === '-outline' && args.length === 4 && !isNaN(parseInt(args[2])) && isValidBlockId(args[3])) {
        const radius = parseInt(args[2]);
        const blockId = args[3];
        playerDataTool[player.name] = { tool: 'outline', blockId, outlineRadius: radius };
        player.sendMessage(translate(player, "command.edit.OutlineToolSelected", { radius: `${radius}`, blockId: `${blockId}` }));
      }
      else if (args[1] === '-smooth' && args.length === 4 && !isNaN(parseInt(args[2])) && isValidBlockId(args[3])) {
        const radius = parseInt(args[2]);
        const blockId = args[3];
        playerDataTool[player.name] = { tool: 'smooth', blockId, smoothRadius: radius };
        player.sendMessage(translate(player, "OutlineToolSelected", { radius: `${radius}`, blockId: `${blockId}` }));
      }
      else if (args[1] === '-exit') {
        delete playerDataTool[player.name];
        player.sendMessage(translate(player, "command.edit.ToolExited"));
      }
      else {
        player.sendMessage(translate(player, "command.edit.ToolOptions"));
      }
    }
    else if (args[0] === '-set' && args.length === 2) {
      data.commandArgs = args;
      data.selecting = true;
      player.sendMessage(translate(player, "command.edit.StartRangeSelection2"));
    } else if (args[0] === '-clear') {
      data.commandArgs = args;
      data.selecting = true;
      player.sendMessage(translate(player, "command.edit.StartRangeSelection2"));
    } else if (args[0] === '-start') {
      data.selecting = true;
      const currentTool = playerDataTool[player.name];
      if (currentTool) {
        player.sendMessage(translate(player, "command.edit.StartRangeSelection", { tool: currentTool.tool }));
      }
    } else if (args[0] === '-undo') {
      if (undoStack[player.name] && undoStack[player.name].length > 0) {
        const lastAction = undoStack[player.name].pop()!;
        if (lastAction.type === 'fill' || lastAction.type === 'clear' || lastAction.type === 'walls' || lastAction.type === 'outline' || lastAction.type === 'filledCircle' || lastAction.type === 'smooth') {
          lastAction.originalBlocks.filter(blockData => blockData != null).forEach(blockData => {
            setBlockData(blockData);
          });
          player.sendMessage(translate(player, "command.edit.Undone"));
        }
      } else {
        player.sendMessage(translate(player, "command.edit.NothingToUndo"));
      }

    }
    else {
      player.sendMessage(translate(player, "command.edit.InvalidCommandUsage", { prefix: `${prefix}` }));
    }

  },
});