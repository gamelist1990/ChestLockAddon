### Minecraft WebSocket イベントリスト

**ソース元**
[EventSubscribe.js](https://gist.github.com/jocopa3/5f718f4198f1ea91a37e3a9da468675c#file-mcpe-w10-event-names)
[minecraft-bedrock-documentation](https://github.com/MisteFr/minecraft-bedrock-documentation/blob/master/release/1.12.0.28/1.12.0.28_wssEvents.md)

**動作未確認**

#### プレイヤー関連イベント
- MultiplayerRoundEnd
- MultiplayerRoundStart
- PlayerSaved
- PlayerDied
- PlayerJoin
- PlayerLeave
- PlayerMessage
- PlayerMessageChat
- PlayerMessageTell
- PlayerMessageMe
- PlayerMessageSay
- PlayerMessageTitle
- PlayerTransform
- PlayerTeleported
- PlayerTravelled
- PlayerBounced

#### ゲームプレイ関連イベント
- GameTypeChanged
- GameRulesLoaded
- GameRulesUpdated
- GameSessionStart
- GameSessionEnd
- EndOfDay
- Respawn
- LevelDestruct
- WorldLoaded
- WorldUnloaded
- WorldGenerated
- WorldExported
- WorldImported
- WorldFilesListed
- MultiplayerSessionUpdate
- MultiplayerConnectionStateChanged
- GameSessionComplete
- HasNewContent
- TrialDeviceIdCorrelation
- ContentLogsInWorldSession
- PromotionNotificationClicked
- NewStoreContentCheckCompleted
- AdditionalContentLoaded

#### アイテム関連イベント
- ItemUsed
- ItemNamed
- ItemCrafted
- ItemDropped
- ItemSmelted
- ItemAcquired
- ItemEquipped
- ItemInteracted
- ItemDestroyed
- ItemEnchanted

#### ブロック関連イベント
- BlockPlaced
- [BlockBroken](./event/blockEvent/blockBreak.md)
- BlockFound
- BlockPlacedByCommand
- BlockChanged
- BlockRemoved
- ChunkChanged
- ChunkLoaded
- ChunkUnloaded

#### 実績関連イベント
- AwardAchievement

#### クラフト関連イベント
- CraftingSessionEnd
- CraftingSessionStart
- CraftingSessionCompleted

#### 書籍関連イベント
- BookEdited
- BookExported
- SignedBookOpened
- BookImageImported
- BookCopied

#### エージェント関連イベント
- AgentCommand
- AgentCreated

#### エンティティ関連イベント
- MobBorn
- PetDied
- MobKilled
- BossKilled
- EntityInteracted
- EntitySpawned
- EntityDanced
- MobInteracted

#### ポータル関連イベント
- PortalUsed
- PortalBuilt

#### サービス関連イベント
- ApiInit
- Heartbeat
- Storage
- StorageReport
- StorageUpdate
- FocusGained
- FocusLost
- ConnectionFailed
- performanceMetrics
- PackImportStage
- FileTransmissionCancelled
- FileTransmissionCompleted
- FileTransmissionStarted
- PortfolioExported
- RegionalPopup
- ScreenChanged
- ScreenHeartbeat
- LicenseCensus
- TrialDeviceIdCorrelation

#### システム関連イベント
- HardwareInfo
- DeviceInfo
- AppPaused
- AppResumed
- AppSuspended
- ConfigurationChanged

#### 教育関連イベント
- SignInEdu
- SignOutEdu
- EduOptionSet
- EduResources
- SignInToEdu

#### 開発関連イベント
- ScriptRan
- ScriptLoaded
- DevConsoleOpen
- DevConsoleCommand

#### インベントリ関連イベント
- InventoryUpdated

#### その他のイベント
- MenuShown
- OfferRated
- PackPlayed
- PackHashChanged
- PackImportStarted
- PackImportedCompleted
- PackUpgradeAttempt
- FirstTimeClientOpen
- JukeboxUsed
- MascotCreated
- PotionBrewed
- PurchaseAttempt
- PurchaseResolved
- RespondedToAcceptContent
- SpecialMobBuilt
- StartClient
- StartWorld
- TextToSpeechToggled
- UgcDownloadCompleted
- UgcDownloadStarted
- UploadSkin
- VehicleExited
- WorldFilesListed