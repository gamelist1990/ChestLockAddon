import { system, world, Player, ScoreboardObjective } from '@minecraft/server';
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
§r- "w:chat_ここにメッセージ" という形式のタグをプレイヤーに追加し、1秒後に削除\n
§r- w:chat_cancel タグを持っているプレイヤーはメッセージ送信不可\n
§r- スパム検知 (短時間に同一メッセージ、類似メッセージを検知)\n
§r- 危険な単語リストによるブロック\n
§r- スパム検知されたプレイヤーは30秒間メッセージ送信不可\n

**注意点**\n
§r- '{', '}', '_'を含むメッセージは注意。\n
§r- 定期的なログ整理を推奨。(3秒で自動削除されますが、念のため)`;


  private recentMessages: Map<string, { message: string; timestamp: number; count: number }[]> = new Map();
  private readonly spamThreshold = 2;
  private readonly spamTimeframe = 2000;
  private readonly similarityThreshold = 0.8;
  private spamMutedPlayers: Map<string, number> = new Map(); // PlayerName, Timestamp
  private readonly spamMuteDuration = 30000; // 30 seconds

  private blockedWords: string[] = [
    // 侮辱系 (Insults)
    "バカ", "アホ", "クズ", "死ね", "消えろ", "ゴミ", "カス", "ノロマ", "デブ", "ブス", "ハゲ", "チビ",
    "低能", "無能", "役立たず", "負け犬", "雑魚", "弱虫", "卑怯者", "嘘つき", "裏切り者",
    "baka", "aho", "kuzu", "shine", "kiero", "gomi", "kasu", "noroma", "debu", "busu", "hage", "chibi",
    "teinou", "munou", "yakudatazu", "makeinu", "zako", "yowamushi", "hikyoumono", "usotsuki", "uragirimono",
    "idiot", "fool", "moron", "stupid", "dumb", "retard", "asshole", "bitch", "bastard", "loser",
    "scum", "trash", "garbage", "worthless", "incompetent",

    // 挑発系 (Provocations)
    "雑魚乙", "弱すぎ", "下手くそ", "noob", "nub", "ボット", "bot", "煽り", "aori",
    "lol", "lmao", "rofl", "get good", "git gud", "ez", "easy", "noob", "tryhard", "sweat", "salty",
    "mad", "triggered", "cry", "crying", "rage", "raging", "ez",

    // セクシャルハラスメント系 (Sexual Harassment)
    "おっぱい", "ちんこ", "まんこ", "セックス", "エッチ", "変態", "ロリ", "ショタ",
    "oppai", "chinko", "manko", "sekkusu", "ecchi", "hentai", "rori", "shota",
    "boobs", "tits", "dick", "cock", "pussy", "sex", "fuck", "slut", "whore", "cum", "orgasm",
    "rape", "molest", "pedophile",

    //差別系
    "黒人", "ニガー", "ガイジ", "障害者", "gaiji", "syougaisya",

    // その他 (Others)
    "mb",

  ];


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
    const { sender, message } = event;
    const senderName = sender.name;

    if (sender.hasTag("w:chat_cancel")) {
      event.cancel = true;
    }

    // Check if the player is muted
    if (this.spamMutedPlayers.has(senderName)) {
      const muteEndTime = this.spamMutedPlayers.get(senderName);
      if (muteEndTime !== undefined && Date.now() < muteEndTime) {
        event.cancel = true;
        sender.sendMessage(`§c[ChatManager]§r: あなたはスパム行為のため、${Math.ceil((muteEndTime - Date.now()) / 1000)}秒間メッセージを送信できません。`);
        return;
      } else {
        this.spamMutedPlayers.delete(senderName); // Remove if mute time is over
      }
    }

    if (message.length > 150) {
      event.cancel = true;
      sender.sendMessage("§c[ChatManager]§r: 150文字を超えるメッセージは送信できません。");
      return;
    }

    if (this.containsBlockedWord(message)) {
      event.cancel = true;
      sender.sendMessage("§c[ChatManager]§r: 不適切な単語が含まれているため、メッセージを送信できません。");
      world.sendMessage(`§c[ChatManager]§r: ${sender.name} が不適切なメッセージを送信しようとしました`);
      return;
    }

    if (this.isSpam(senderName, message)) {
      event.cancel = true;
      sender.sendMessage("§c[ChatManager]§r: スパム行為は禁止されています。");
      world.sendMessage(`§c[ChatManager]§r: ${senderName} がスパム行為を行いました。`);
      this.spamMutedPlayers.set(senderName, Date.now() + this.spamMuteDuration); // Mute the player
      return;
    }


    this.addOrUpdateScoreboardMessage(sender.name, message);
    this.addAndRemoveChatTag(sender, message);
  };


  private addAndRemoveChatTag(player: Player, message: string) {
    const tag = `w:chat_${message}`;
    system.run(() => {
      try {
        player.addTag(tag.substring(0, 32767));
        //console.warn(`[ChatManager] addAndRemoveChatTag - Added tag: ${tag.substring(0, 32767)}`);

        system.runTimeout(() => {
          player.removeTag(tag.substring(0, 32767));
          //console.warn(`[ChatManager] addAndRemoveChatTag - Removed tag: ${tag.substring(0, 32767)}`);
        }, 20);
      } catch (error) {
        console.error(`[ChatManager] addAndRemoveChatTag - Error: ${error}`); // エラーログ
      }
    });
  }

  private addOrUpdateScoreboardMessage(sender: string, message: string) {
    const objectiveId = 'message';
    let objective: ScoreboardObjective | undefined;

    system.run(() => {
      try {
        objective = world.scoreboard.getObjective(objectiveId);
        if (!objective) {
          objective = world.scoreboard.addObjective(objectiveId, 'Chat Log');
          //console.warn(`[ChatManager] addOrUpdateScoreboardMessage - Created new objective: ${objectiveId}`);
        }
      } catch (error) {
        console.error('Error getting/adding scoreboard objective:', error);
        return;
      }


      if (objective) {
        const scoreName = `{${sender}_${message}}`.substring(0, 32767);
        system.run(() => {
          objective?.setScore(scoreName, 0);
          //console.warn(`[ChatManager] addOrUpdateScoreboardMessage - Set score for: ${scoreName}`);


          system.runTimeout(() => {
            if (objective) {
              const participant = objective.getParticipants().find(p => p.displayName === scoreName);
              if (participant) {
                objective.removeParticipant(participant);
                //console.warn(`[ChatManager] addOrUpdateScoreboardMessage - Removed score for: ${scoreName}`);
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
        //  console.warn(`[ChatManager] clearChatLog - Cleared chat log`); 
      }
    } catch (error) {
      console.error('Error clearing chat log:', error);
    }
  }



  private isSpam(senderName: string, message: string): boolean {
    const now = Date.now();
    const userMessages = this.recentMessages.get(senderName) || [];

    const recent = userMessages.filter(entry => now - entry.timestamp < this.spamTimeframe);
    //console.warn(`[ChatManager] isSpam - ${senderName} recent messages: ${JSON.stringify(recent)}`);


    let identicalCount = 0;
    for (const entry of recent) {
      if (entry.message === message) {
        identicalCount++;
      }
    }

    let similarCount = 0;
    for (const entry of recent) {
      if (this.calculateSimilarity(entry.message, message) >= this.similarityThreshold) {
        similarCount++;
      }
    }
    // console.warn(`[ChatManager] isSpam - ${senderName} - identicalCount: ${identicalCount}, similarCount: ${similarCount}`); 

    if (identicalCount >= this.spamThreshold - 1 || similarCount >= this.spamThreshold) {
      //console.warn(`[ChatManager] isSpam - Spam detected! ${senderName}: ${message}`);

      // Don't add the message if it's spam
      return true;
    }


    let added = false;
    for (let i = 0; i < recent.length; i++) {
      if (recent[i].message === message) {
        recent[i].count++;
        added = true;
        break;
      }
    }

    if (!added) {
      recent.push({ message, timestamp: now, count: 1 });
    }

    this.recentMessages.set(senderName, recent);
    //console.warn(`[ChatManager] isSpam - Updated recent messages for ${senderName}: ${JSON.stringify(this.recentMessages.get(senderName))}`);
    return false;

  }


  private calculateSimilarity(s1: string, s2: string): number {
    const similarity = this.jaroWinkler(s1.toLowerCase(), s2.toLowerCase());
    //console.warn(`[ChatManager] calculateSimilarity - Similarity between "${s1}" and "${s2}": ${similarity}`);
    return similarity;
  }



  private jaroWinkler(s1: string, s2: string): number {
    let jaro = this.jaro(s1, s2);
    let prefixLength = 0;
    for (let i = 0; i < Math.min(s1.length, s2.length, 4); i++) {
      if (s1[i] === s2[i]) {
        prefixLength++;
      } else {
        break;
      }
    }
    return jaro + (prefixLength * 0.1 * (1 - jaro));
  }

  private jaro(s1: string, s2: string): number {
    if (s1 === s2) {
      return 1.0;
    }

    let len1 = s1.length;
    let len2 = s2.length;
    let matchWindow = Math.floor(Math.max(len1, len2) / 2) - 1;

    let matches1 = new Array(len1);
    let matches2 = new Array(len2);
    let matches = 0;

    for (let i = 0; i < len1; i++) {
      let start = Math.max(0, i - matchWindow);
      let end = Math.min(i + matchWindow + 1, len2);

      for (let j = start; j < end; j++) {
        if (!matches2[j] && s1[i] === s2[j]) {
          matches1[i] = true;
          matches2[j] = true;
          matches++;
          break;
        }
      }
    }

    if (matches === 0) {
      return 0.0;
    }

    let transpositions = 0;
    let k = 0;
    for (let i = 0; i < len1; i++) {
      if (matches1[i]) {
        while (!matches2[k]) {
          k++;
        }
        if (s1[i] !== s2[k]) {
          transpositions++;
        }
        k++;
      }
    }

    return ((matches / len1) + (matches / len2) + ((matches - transpositions / 2) / matches)) / 3.0;
  }

  private containsBlockedWord(message: string): boolean {
    const lowerCaseMessage = message.toLowerCase();
    for (const word of this.blockedWords) {
      if (lowerCaseMessage.includes(word)) {
        //console.warn(`[ChatManager] containsBlockedWord - Blocked word found: ${word}`);
        return true;
      }
    }
    return false;
  }
}

const chatModule = new ChatModule();
moduleManager.registerModule(chatModule);