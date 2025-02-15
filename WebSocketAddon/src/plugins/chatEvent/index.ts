import { system } from '@minecraft/server';
import { world, Player, ScoreboardObjective } from '@minecraft/server';
import { Module, moduleManager } from '../../module/module';

// Chat Module
class ChatModule implements Module {
  name = 'Chat_Manager';
  enabledByDefault = false;
  docs = `チャットをスコアボードに記録します。\n
**機能**\n
§r- チャットを監視し、スコアボード'message'に記録。\n
§r- スコアボード名: §9{送信者名}_{メッセージ内容}\n
§r- スコアは常に§90\n
§r- モジュール有効化時、既存ログをクリア。\n

**注意点**\n
§r- '{', '}', '_'を含むメッセージは注意。\n
§r- 大量のチャットはパフォーマンスに影響の可能性あり(対策は使わないなら使用しない/定期的にReset)\n
§r- 定期的なログ整理を推奨。`;

  onEnable(): void {
    console.log(`${this.name}: onEnable`);
    world.sendMessage(`${this.name}: Module Enabled`);
    this.registerChatListener();
  }

  onInitialize(): void {
    this.registerChatListener();
    this.clearChatLog();
  }

  onDisable(): void {
    console.log(`${this.name}: onDisable`);
    world.sendMessage(`${this.name}: Module Disabled`);
    this.unregisterChatListener();
  }

  registerChatListener(): void {
    world.beforeEvents.chatSend.subscribe(this.handleChatEvent);
  }
  unregisterChatListener(): void {
    world.beforeEvents.chatSend.unsubscribe(this.handleChatEvent);
  }

  private handleChatEvent = (event: { sender: Player; message: string; cancel: boolean }) => {
    this.addOrUpdateScoreboardMessage(event.sender.name, event.message);
  };

  private addOrUpdateScoreboardMessage(sender: string, message: string) {
    const objectiveId = 'message';
    let objective: ScoreboardObjective | undefined;

    system.run(() => {
      try {
        objective = world.scoreboard.getObjective(objectiveId);
        if (!objective) {
          objective = world.scoreboard.addObjective(objectiveId, 'Chat Log');
        }
      } catch (error) {
        console.error('Error getting/adding scoreboard objective:', error);
        return;
      }

      if (objective) {
        const scoreName = `{${sender}_${message}}`;
        system.run(() => {
          objective?.setScore(scoreName, 0);
        });
      }
    });
  }

  private clearChatLog() {
    const objectiveId = 'message';
    try {
      const objective = world.scoreboard.getObjective(objectiveId);
      if (objective) {
        const participants = objective.getParticipants();
        for (const participant of participants) {
          objective.removeParticipant(participant);
        }
      }
    } catch (error) {
      console.error('Error clearing chat log:', error);
    }
  }
}

const chatModule = new ChatModule();
moduleManager.registerModule(chatModule);
