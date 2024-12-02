### Minecraft WebSocket イベントリスト

**ソース元**
[EventSubscribe.js](https://gist.github.com/jocopa3/5f718f4198f1ea91a37e3a9da468675c#file-mcpe-w10-event-names)
[minecraft-bedrock-documentation](https://github.com/MisteFr/minecraft-bedrock-documentation/blob/master/release/1.12.0.28/1.12.0.28_wssEvents.md)

**動作実験中**

### 実験環境:
- Minecraft Bedrock 1.20.40

---

#### プレイヤー関連イベント
| イベント名                  | 状態                   | 備考                                |
|----------------------------|------------------------|-------------------------------------|
| MultiplayerRoundEnd        | 不明                   |                                     |
| MultiplayerRoundStart      | 不明                   |                                     |
| PlayerSaved                | 機能せず               | 多分リスポーンの事だと思う         |
| PlayerDied                 | [機能](./event/playerEvent/PlayerDied.md) |                                     |
| PlayerJoin                 | 実験中                 |                                     |
| PlayerLeave                | 実験中                 |                                     |
| PlayerMessage              | [機能](./event/playerEvent/PlayerMessage.md) |                                     |
| PlayerMessageChat          | [機能](./event/playerEvent/PlayerMessage.md) |                                     |
| PlayerMessageTell          | [機能](./event/playerEvent/PlayerMessage.md) |                                     |
| PlayerMessageMe            | [機能](./event/playerEvent/PlayerMessage.md) |                                     |
| PlayerMessageSay           | [機能](./event/playerEvent/PlayerMessage.md) |                                     |
| PlayerMessageTitle         | [機能](./event/playerEvent/PlayerMessage.md) |                                     |
| PlayerTransform            | [機能](./event/playerEvent/PlayerTransform.md) |                                     |
| PlayerTeleported           | [機能](./event/playerEvent/PlayerTeleported.md) |                                     |
| PlayerTravelled            | [機能](./event/playerEvent/PlayerTravelled.md) |                                     |
| PlayerBounced              | 機能せず               |                                     |

---

#### ゲームプレイ関連イベント
| イベント名                  | 状態                   | 備考                                |
|----------------------------|------------------------|-------------------------------------|
| GameTypeChanged            | 機能せず               |                                     |
| GameRulesLoaded            | 機能せず               |                                     |
| GameRulesUpdated           | 機能せず               |                                     |
| GameSessionStart           | 不明                   |                                     |
| GameSessionEnd             | 不明                   |                                     |
| EndOfDay                   | [機能](./event/worldEvent/EndOfDay.md) |                                     |
| Respawn                    | プレイヤーのリスポーン以外 | 不明                                |
| LevelDestruct              | 不明                   |                                     |
| WorldLoaded                | 不明                   | unloadedと同様な感じだと思う       |
| WorldUnloaded              | 不明                   | サーバーの負荷が高い時にのみ取得できるかも |
| WorldGenerated             | 機能せず               |                                     |
| WorldExported              | 機能せず               |                                     |
| WorldImported              | 機能せず               |                                     |
| WorldFilesListed           | 機能せず               |                                     |
| MultiplayerSessionUpdate   | 機能せず               |                                     |
| MultiplayerConnectionStateChanged | 機能せず       |                                     |
| GameSessionComplete        | 機能せず               |                                     |
| HasNewContent              | 機能せず               |                                     |
| TrialDeviceIdCorrelation   | 機能せず               |                                     |
| ContentLogsInWorldSession  | 機能せず               |                                     |
| PromotionNotificationClicked | 機能せず             |                                     |
| NewStoreContentCheckCompleted | 機能せず            |                                     |
| AdditionalContentLoaded    | 機能せず               |                                     |

---

#### アイテム関連イベント
| イベント名                  | 状態                   | 備考                                |
|----------------------------|------------------------|-------------------------------------|
| ItemUsed                   | [機能](./event/ItemEvent/ItemUsed.md) |                                     |
| ItemNamed                  | 不明                   |                                     |
| ItemCrafted                | [機能](./event/ItemEvent/ItemCrafted.md) |                                     |
| ItemDropped                | 機能せず               |                                     |
| ItemSmelted                | [機能](./event/ItemEvent/ItemSmelted.md) |                                     |
| ItemAcquired               | [機能](./event/ItemEvent/ItemAcquired.md) |                                     |
| ItemEquipped               | [機能](./event/ItemEvent/ItemEquipped.md) |                                     |
| ItemInteracted             | [機能](./event/ItemEvent/ItemInteracted.md) |                                     |
| ItemDestroyed              | 機能せず               |                                     |
| ItemEnchanted              | 機能せず               |                                     |

---

#### ブロック関連イベント
| イベント名                  | 状態                   | 備考                                |
|----------------------------|------------------------|-------------------------------------|
| BlockPlaced                | [機能](./event/blockEvent/BlockPlaced.md) |                                     |
| BlockBroken                | [機能](./event/blockEvent/BlockBroken.md) |                                     |
| BlockFound                 | 不明                   |                                     |
| BlockPlacedByCommand       | 不明                   |                                     |
| BlockChanged               | 不明                   |                                     |
| BlockRemoved               | 不明                   |                                     |
| ChunkChanged               | 1.0.2以降機能せず       |                                     |
| ChunkLoaded                | 1.0.2以降機能せず       |                                     |
| ChunkUnloaded              | 1.0.2以降機能せず       |                                     |

---

#### 実績関連イベント
| イベント名                  | 状態                   | 備考                                |
|----------------------------|------------------------|-------------------------------------|
| AwardAchievement           | 実績解除までの時間が長すぎて不明 |                                     |

---

#### クラフト関連イベント
| イベント名                  | 状態                   | 備考                                |
|----------------------------|------------------------|-------------------------------------|
| CraftingSessionEnd         | 機能せず               |                                     |
| CraftingSessionStart       | 機能せず               |                                     |
| CraftingSessionCompleted   | 機能せず               |                                     |

---

#### 書籍関連イベント
| イベント名                  | 状態                   | 備考                                |
|----------------------------|------------------------|-------------------------------------|
| BookEdited                 | 機能せず               |                                     |
| BookExported               | 機能せず               |                                     |
| SignedBookOpened           | 機能せず               |                                     |
| BookImageImported          | 機能せず               |                                     |
| BookCopied                 | 機能せず               |                                     |

---

#### エージェント関連イベント
| イベント名                  | 状態                   | 備考                                |
|----------------------------|------------------------|-------------------------------------|
| AgentCommand               | 多分機能せず？         |                                     |
| AgentCreated               | 多分機能せず？         |                                     |

---

#### エンティティ関連イベント
| イベント名                  | 状態                   | 備考                                |
|----------------------------|------------------------|-------------------------------------|
| MobBorn                    | 不明                   |                                     |
| PetDied                    | 機能せず               |                                     |
| MobKilled                  | [機能](./event/entityEvent/MobKilled.md) |                                     |
| BossKilled                 | 機能せず(エンドラ倒したけどなんも) |                                     |
| EntityInteracted           | 機能せず               |                                     |
| EntitySpawned              | [機能](./event/entityEvent/EntitySpawned.md) |                                     |
| EntityDanced               | 機能せず               |                                     |
| MobInteracted              | [機能](./event/entityEvent/MobInteracted.md) |                                     |

---

#### ポータル関連イベント
| イベント名                  | 状態                   | 備考                                |
|----------------------------|------------------------|-------------------------------------|
| PortalUsed                 | 機能せず               |                                     |
| PortalBuilt                | 機能せず               |                                     |

---

#### サービス関連イベント
| イベント名                  | 状態                   | 備考                                |
|----------------------------|------------------------|-------------------------------------|
| ApiInit                    | 不明                   |                                     |
| Heartbeat                  | 機能せず               |                                     |
| Storage                    | 不明                   |                                     |
| StorageReport              | 不明                   |                                     |
| StorageUpdate              | 不明                   |                                     |
| FocusGained                | 不明                   |                                     |
| FocusLost                  | 不明                   |                                     |
| ConnectionFailed           | 不明