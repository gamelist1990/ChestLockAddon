import { system } from '@minecraft/server';
import { world, Player, ScoreboardObjective } from '@minecraft/server';
import { Module, moduleManager } from '../../module/module';

// Chat Module
class ChatModule implements Module {
  name = 'Chat_Manager';
  enabledByDefault = true;
  docs = `
チャットメッセージをスコアボードに記録するモジュールです。
プレイヤーが送信したメッセージを、 \`{送信者名}_{メッセージ内容}\` という形式でスコアボードに記録します。

**機能:**

-   チャットメッセージの監視:  \`world.beforeEvents.chatSend\` イベントをリッスンし、プレイヤーが送信したメッセージを捕捉します。
-   スコアボードへの記録:  捕捉したメッセージを、スコアボードオブジェクト \`message\` に記録します。
    -   スコアボードが存在しない場合は、新しく作成します。
    -   スコアは常に 0 に設定されます (メッセージの表示順序を制御するため)。
-   チャットログのクリア:  モジュールが有効になったとき、および初期化時に、既存のチャットログ (スコアボードエントリ) をクリアします。

**スコアボード:**

-   オブジェクトID: \`message\`
-   表示名: \`Chat Log\`
-   スコア名:  \`{送信者名}_{メッセージ内容}\`  (例: \`{Player1_こんにちは}\`)
-   スコア:  \`0\` (常に)

**注意点:**

-   メッセージ内容に \`{\` や \`}\`、\`_\` が含まれていると、スコア名が意図しない形式になる可能性があります。
-   スコアボードの表示は、他のプラグインやコマンドによって制御される必要があります (このモジュール自体は表示を制御しません)。
-  大量のチャットが発生すると、スコアボードのエントリ数が非常に多くなる可能性があります。表示のパフォーマンスに影響が出たり、最大エントリ数制限に達する可能性に注意してください。可能であれば、定期的に古いエントリを削除するか、別の方法 (データベースなど) でチャットログを管理することを検討してください。

**改善案 (必要に応じて):**

-   メッセージのサニタイズ: スコア名として安全な形式にメッセージを変換する (特殊文字のエスケープなど)。
-   チャットログの保持期間/最大数の設定: 古いエントリを自動的に削除する、または最大エントリ数を超えないようにする。
-   データベース連携: スコアボードではなく、データベース (例えば、前のモジュールで作成した \`Database\` クラス) を使ってチャットログを永続化する。
-   チャットコマンドによるログの表示/クリア機能の追加
`;

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
