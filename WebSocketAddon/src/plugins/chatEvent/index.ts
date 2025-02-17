import { system } from '@minecraft/server';
import { world, Player, ScoreboardObjective } from '@minecraft/server';
import { Module, moduleManager } from '../../module/module';

// Chat Module
class ChatModule implements Module {
  name = 'Chat_Manager';
  enabledByDefault = false;
  docs = `チャットをスコアボードに記録し、3秒後に削除します。\n
**機能**\n
§r- チャットを監視し、スコアボード'message'に記録。\n
§r- スコアボード名: §9{送信者名}_{メッセージ内容}\n
§r- スコアは常に§90\n
§r- モジュール有効化時、既存ログをクリア。\n
§r- 150文字を超えるチャットは送信不可。\n
§r- 記録されたチャットは3秒後に削除。\n

**注意点**\n
§r- '{', '}', '_'を含むメッセージは注意。\n
§r- 定期的なログ整理を推奨。(3秒で自動削除されますが、念のため)`;


  onEnable(): void {
    world.sendMessage(`${this.name}: Module Enabled`);
    this.registerChatListener();
  }

  onInitialize(): void {
    this.registerChatListener();
    this.clearChatLog();
  }


  onDisable(): void {
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
    if (event.message.length > 3) {
      event.cancel = true;
      event.sender.sendMessage("§c[ChatManager]§r: 150文字を超えるメッセージは送信できません。");
      return;
    }
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
        //scoreboradの名前は32767文字以下
        const scoreName = `{${sender}_${message}}`.substring(0, 32767);
        system.run(() => {
          objective?.setScore(scoreName, 0);

          // 3秒後にスコアボードエントリを削除
          system.runTimeout(() => {
            if (objective) {
              const participant = objective.getParticipants().find(p => p.displayName === scoreName);
              if (participant) {
                objective.removeParticipant(participant);
              }
            }
          }, 60);
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