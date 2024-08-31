export const translations = {
  "FirstPointSet": {
    msgid: ">> First point set.",
    msgstr: ">> 最初の地点を設定しました。"
  },
  "SecondPointSet": {
    msgid: ">> Second point set.",
    msgstr: ">> 2つ目の地点を設定しました。"
  },
  "SelectionCompleted": {
    msgid: ">> Selection completed.",
    msgstr: ">> 範囲選択が完了しました。"
  },
  "PointSet": {
    msgid: ">> Point set.",
    msgstr: ">> 地点を設定しました。"
  },
  "WallsCreated": {
    msgid: ">> Walls created.",
    msgstr: ">> 壁を作成しました。"
  },
  "InvalidBlockId": {
    msgid: ">> Invalid block ID.",
    msgstr: ">> 無効なブロックIDです。"
  },
  "OutlineCreated": {
    msgid: ">> Outline created.",
    msgstr: ">> アウトラインを作成しました。"
  },
  "FilledCircleCreated": {
    msgid: ">> Filled circle created.",
    msgstr: ">> 中を埋めた円を作成しました。"
  },
  "RangeSet": {
    msgid: ">> Range set with the specified block ({blockId}).",
    msgstr: ">> 指定したブロック({blockId})で範囲内が設定されました。"
  },
  "RangeCleared": {
    msgid: ">> Range cleared.",
    msgstr: ">> 範囲内がクリアされました。"
  },
  "WallsToolSelected": {
    msgid: ">> Walls tool selected. (Block ID: {blockId})",
    msgstr: ">> walls ツールを選択しました。 (ブロックID: {blockId})"
  },
  "OutlineToolSelected": {
    msgid: ">> Outline tool selected. (Radius: {radius}, Block ID: {blockId})",
    msgstr: ">> outline ツールを選択しました。 (半径: {radius}, ブロックID: {blockId})"
  },
  "FilledCircleToolSelected": {
    msgid: ">> Filled circle tool selected. (Radius: {radius}, Block ID: {blockId})",
    msgstr: ">> filledCircle ツールを選択しました。 (半径: {radius}, ブロックID: {blockId})"
  },
  "ToolExited": {
    msgid: ">> Tool exited.",
    msgstr: ">> ツールを終了しました。"
  },
  "ToolOptions": {
    msgid: ">> Tool options: -wall <blockID>, -outline <radius> <blockID>, -filledCircle <radius> <blockID>, -exit",
    msgstr: ">> ツールオプション: -wall <ブロックID>, -outline <半径> <ブロックID>, -filledCircle <半径> <ブロックID>, -exit"
  },
  "StartRangeSelection2": {
    msgid: ">> Range selection started. Please break two blocks.",
    msgstr: ">> 範囲選択を開始しました。ブロックを2つ破壊してください。"
  },
  "StartRangeSelection": {
    msgid: ">> Range selection started. Hold a wooden hoe and break a block.",
    msgstr: ">> 範囲選択を開始しました。木のクワを持ちブロックを破壊してください"
  },
  "InvalidCommandUsage": {
    msgid: ">> Invalid command usage: /{prefix}edit -set <blockID> | /{prefix}edit -clear | /{prefix}edit tool <options> | /{prefix}edit start",
    msgstr: ">> コマンドの使用方法: {prefix}edit -set <ブロックID> | {prefix}edit -clear | {prefix}edit tool <オプション> | {prefix}edit start"
  },
  "PlayerNotFound": {
    msgid: "§cPlayerNotFound!! Make sure you're really there",
    msgstr: "§cこのプレイヤーが見つかりません！！"
  },
  "TheFirestBlock": {
    msgid: "§a1 The first block has been recorded. Destroy the block again.",
    msgstr: "§a1 最初のブロックが記録されました。次のブロックを選択してください."
  },
  "TheSecond": {
    msgid: "§a2 second block has been recorded. Warp gate has been set.",
    msgstr: "§a2二個目のブロックが記録に成功したため。ワープゲートの設定が完了しました"
  },
  "WarpUsage": {
    msgid: "§c usage: warpgate -create <gate name> <x> <y> <z",
    msgstr: "§c使用方法は: warpgate -create <gate name> <x> <y> <z>だよ"
  },
  "AlreadyWarp": {
    msgid: "§cA warp gate of that name already exists.",
    msgstr: "§cその名前のワープゲートは既に存在しています。"
  },
  "CreateGate": {
    msgid: "§aCreate a warp gate {gatename} \n §aNext, destroy the two blocks to specify the extent of the gate.",
    msgstr: "§aワープゲートを{gatename}で作成します \n §次に、ゲートの範囲を指定するために2つのブロックを壊して下さい"
  },
  "NotWarp": {
    msgid: "§cThe gate with the specified name does not exist",
    msgstr: "§c指定された名前のゲートは存在しません。"
  },
  "deleteWarp": {
    msgid: "§a gate removed: {gatename}",
    msgstr: "§aゲートの削除に成功しました: {gatename}。"
  },
  "NotWarpSetting": {
    msgid: "§cNo warp gate is set.",
    msgstr: "§cワープゲートが設定されていません"
  },
  "listGate": {
    msgid: "§a List of warp gates:\n",
    msgstr: "§aワープゲートのリスト:\n"
  },
  "warpgateCom": {
    msgid: "Warp gate can be set",
    msgstr: "ワープゲートを作る事ができます"
  },
  "UsageGate": {
    msgid: "§c invalid subcommand usage {prefix}warpgate <-create/delete/list> [name] |\n§c create command Only -create [name] [x,y,z]",
    msgstr: "§c 無効なサブコマンドです使い方は {prefix}warpgate <-create/delete/list> [name] |\n§c ただ-create引数の時はこのようにしてください -create [name] [x,y,z]."
  },
  "TPGATE": {
    msgid: "§a Teleported to warp gate {gate}.",
    msgstr: "§a ワープゲート{gate}にテレポートしました"
  },
  "Joincommand": {
    msgid: "Displays a message when joining a world",
    msgstr: "プレイヤー参加時にメッセージを出します"
  },
  "Joinenabled": {
    msgid: "§aEnabled messages when joining worlds",
    msgstr: "§aワールドに参加メッセージを有効にしました"
  },
  "Joindisabled": {
    msgid: "§cDisabled messages when joining worlds.",
    msgstr: "§cワールド参加メッセージを無効にしました."
  },
  "Invalid": {
    msgid: "§cInvalid argument.",
    msgstr: "§c不明な値です"
  },
  "UsageJoin": {
    msgid: "§cUsage is join <-ture/-false/-settings>",
    msgstr: "§c使用法はjoin <-true/-false/-settings>　です"
  },
  "welcome": {
    msgid: "§7 Welcome! My Server",
    msgstr: "§a==ようこそ！！ゆっくりしていってね=="
  },
  "Rulejoin": {
    msgid: "§6 Server Rules!!",
    msgstr: "このサーバーのルール！"
  },
  "RulesNumber": {
    msgid: "§bNumber of Rules",
    msgstr: "§bルールの数を入力(4ぐらいがオススメ)"
  },
  "RulesEnter": {
    msgid: "§0Enter the number of rules",
    msgstr: "§0ここに入力!!"
  },
  "RuleSettings": {
    msgid: "§6Rule Settings",
    msgstr: "ルール設定"
  },
  "Rules": {
    msgid: "§bRule {i}",
    msgstr: "§bルール {i}"
  },
  "RuleEnter2": {
    msgid: "§0Enter rule {i}",
    msgstr: "§0ルールの内容を入力 {i}"
  },
  "RuleUpdate": {
    msgid: "§aRules updated!",
    msgstr: "§aルールを更新しました"
  },
  "joinSettings": {
    msgid: "§6Join Log Settings",
    msgstr: "参加ログ設定！"
  },
  "TpaRequesMenu": {
    msgid: "§2Welcome to tpa MenuCurrent requests:{requestList} people",
    msgstr: "§2tpaメニューへようこそ現在のリクエスト人数は:{requestList}人"
  },
  "SendTpa": {
    msgid: "§0Send a TPARequest",
    msgstr: "§0TPリクエストを送る"
  },
  "ShowTpaRequests": {
    msgid: "§0Confirm TP request addressed to me",
    msgstr: "§0自分宛のTPリクエストを確認"
  },
  "NoTpaRequests": {
    msgid: "§cNo TP request has been sent to you",
    msgstr: "§c自分宛にTPリクエストは届いていませんでした"
  },
  "SelectTpaRequest": {
    msgid: "§2TPRequest has arrived, please select the player you accept",
    msgstr: "§2TPリクエストを受け取りました。受け入れるプレイヤーを選択してください"
  },
  "SendTpaSelect": {
    msgid: "§2Select the player to whom you would like to send a request",
    msgstr: "§2TPリクエストを送信したいプレイヤーを選択してください"
  },
  "uihelp": {
    msgid: "§0HelpMenu",
    msgstr: "§0ヘルプメニュー！"
  },
  "uichest": {
    msgid: "§0ChestMenu(BETA)",
    msgstr: "§0チェストロックメニュー(BETA)"
  },
  "uilang": {
    msgid: "§0LangMenu",
    msgstr: "§0言語メニュー"
  },
  "uijpch": {
    msgid: "§0jpchMenu(BETA)",
    msgstr: "§0JPCHメニュー(BETA)"
  },
  "uitpa": {
    msgid: "§0Tpa Menu(BETA)",
    msgstr: "§0TPリクエストメニュー(BETA)"
  },
  "closeChat": {
    msgid: "§a==Close The Chat Panel==",
    msgstr: "§a==チャット欄を閉じて下さい=="
  },
  "Tpcommand": {
    msgid: "You can send a request and TP it",
    msgstr: "このコマンドではリクエストを送信してTPすることができます"
  },
  "tpaRequestSent": {
    msgid: "§aTPA request sent to {playerName}",
    msgstr: "§b{playerName}§aにTPAリクエストを送信しました【受け入れの制限時間は一分間です】"
  },
  "tpaRequestAlreadySent": {
    msgid: "§cThe cTPA request has already been sent to {playerName}!",
    msgstr: "§cTPA リクエストは既に{playerName}宛てに送信されています！"
  },
  "tpaRequestReceived": {
    msgid: "§2Received a TPA request from {playerName}.",
    msgstr: "§b【{playerName}】§aからTPAリクエストを受け取りました"
  },
  "noPendingTpaRequests": {
    msgid: "§3You have no pending TPA requests.",
    msgstr: "§3保留中の TPA リクエストはありません"
  },
  "invalidTpaRequest": {
    msgid: "§cInvalid TPA request",
    msgstr: "§c無効な TPA リクエストです(期限切れ)"
  },
  "requesterNotFound": {
    msgid: "§cRequester not found",
    msgstr: "§cリクエストした人が見つかりません"
  },
  "teleportedToPlayer": {
    msgid: "§aTeleported to {playerName}",
    msgstr: "§b{playerName}§aにテレポートしました"
  },
  "tpaRequestAccepted": {
    msgid: "§a{playerName} has accepted your TPA request",
    msgstr: "§b{playerName}§aがあなたのTPAリクエストを受け入れました"
  },
  "tpaRequestAcceptes": {
    msgid: "§aTPA request from {playerName} accepted!",
    msgstr: "§b{playerName}§aからのTPAリクエストを受け入れました！"
  },
  "cannotTpaToSelf": {
    msgid: "§cYou cannot send a TPA request to yourself",
    msgstr: "§cTPA リクエストを自分自身に送信することはできません"
  },
  "invalidTpaCommandUsage": {
    msgid: "§3Invalid usage. Use tpa -r <player> to send a request, or tpa -a <player> to accept",
    msgstr: "§3無効な使用法です tpa -r <player> を使用してリクエストを送信するか、 tpa -a <player> を使用して受け入れる事ができます"
  },
  "tpaRequestTimedOut": {
    msgid: "§3TPA request from {playerName} has timed out",
    msgstr: "§b{playerName}§6に送ったTPAリクエストがタイムアウトしました！"
  },
  "jpchCom": {
    msgid: "§2Functions like LunaChat",
    msgstr: "§2LunaChatと似たようなやつ(実験機能)"
  },
  "jpenable": {
    msgid: "§aEnable Function",
    msgstr: "§a有効化"
  },
  "jpdisable": {
    msgid: "§cDisable function",
    msgstr: "§c無効化"
  },
  "AccesItemUI": {
    msgid: "itemUI command (accesses Chest Lock UI)",
    msgstr: "itemUI コマンド (Chest Lock UI にアクセスします)"
  },
  "FullInv": {
    msgid: "§cYour inventory is full and items cannot be granted",
    msgstr: "§cインベントリがいっぱいのためアイテムを付与できません"
  },
  "AlreadyInv": {
    msgid: "§cUIitem already exists in your inventory",
    msgstr: "§cUIitem は既にインベントリに存在します"
  },
  "AddInv": {
    msgid: "§aYou have added an item to your inventory! (please check)",
    msgstr: "§aインベントリにアイテムが追加されました。 （チェックしてください）"
  },
  "Displayplayerinformation": {
    msgid: "List command (displays player information)",
    msgstr: "Listコマンド（プレイヤー情報を表示）"
  },
  "commands.list.usage": {
    msgid: "§aUsage: list show <playerName> Or list all",
    msgstr: "§a使用法: list show <playerName> または list all"
  },
  "commands.list.playerInfo": {
    msgid: "§6==== Player Info =====\n §2Name: §f{TragetName},\n §2ID: §f{TargetID},\n §2Location: §f({TargetX}, {TargetY}, {TargetZ}),\n §2Health: §f{health},\n §2Game Mode:§f {GameMode},\n §2Ping: {ping}\n §6===========",
    msgstr: "§6==== プレイヤー情報 =====\n §2名前: §f{TargetName},\n §2ID: §f{TargetID},\n §2場所: §f({TargetX}, {TargetY} 、{TargetZ})、\n §2ヘルス: §f{ヘルス}、\n §2ゲームモード:§f {GameMode}、\n §2Ping: {ping}\n §6==========="
  },
  "commands.list.playerNotFound": {
    msgid: "§cPlayer not found: {tragetplayer}",
    msgstr: "§cプレーヤーが見つかりません: {tragetplayer}"
  },
  "jpch_command_description": {
    msgid: "jpch command (experimental feature)",
    msgstr: "LunaChat風のローマ字から日本語に変換する機能です（実験的)"
  },
  "ui_command_description": {
    msgid: "ui command (this command displays a GUI with ActionForm)",
    msgstr: "UIを表示します(Switch/PS4/5用)"
  },
  "ChooseCom": {
    msgid: "§2Select the command:",
    msgstr: "§2使用したいコマンドを選択してね:"
  },
  "ChestCom": {
    msgid: "§2Select the chest:",
    msgstr: "§2使用したい内容を選択:"
  },
  "Chestinfo": {
    msgid: "§0See nearby chests",
    msgstr: "§0近くのチェストの情報を見る"
  },
  "Chestlock": {
    msgid: "§0lock system",
    msgstr: "§0ロック機能系"
  },
  "ChestMember": {
    msgid: "§0Member system",
    msgstr: "§0メンバー操作系"
  },
  "back": {
    msgid: "§2back",
    msgstr: "§2戻る"
  },
  "lockinfo": {
    msgid: "§2Select the type of lock:",
    msgstr: "§2ロックの種類を選択してください:"
  },
  "locking": {
    msgid: "§alocking!",
    msgstr: "§aロック!"
  },
  "unlocking": {
    msgid: "§cunlocking!",
    msgstr: "§cロック解除!"
  },
  "ProtectChest": {
    msgid: "§0Protection Chest Status",
    msgstr: "§0保護チェストのステータス"
  },
  "MemberChoose": {
    msgid: "§2Choose your member's:",
    msgstr: "§2操作するボタンを選択してください:"
  },
  "MemberAdd": {
    msgid: "§0Member Add",
    msgstr: "§0メンバーを追加"
  },
  "MemberRemove": {
    msgid: "§0Member Remove",
    msgstr: "§0メンバーを削除"
  },
  "Memberall": {
    msgid: "§0Member list",
    msgstr: "§0メンバーリスト"
  },
  "AddMemberSelect": {
    msgid: "§2Select the member you wish to add:",
    msgstr: "§2追加したいメンバーを選択してください:"
  },
  "RemoveMemberSelect": {
    msgid: "§2Select the member you wish to Remove:",
    msgstr: "§2削除したいメンバーを選択してください:"
  },
  "SelectLang": {
    msgid: "§2Select an operation from the language menu:",
    msgstr: "§2言語メニューから操作を選択してください:"
  },
  "langList": {
    msgid: "§0lang List",
    msgstr: "§0言語対応リスト"
  },
  "langChange": {
    msgid: "§0lang Change",
    msgstr: "§0言語変更"
  },
  "langChange1": {
    msgid: "§2Please select the language you wish to change:",
    msgstr: "§2変更したい言語を選択してください:"
  },
  "FromError": {
    msgid: "§cAn error occurred while displaying the form:",
    msgstr: "§cフォームの表示中にエラーが発生しました"
  },
  "desabledCom": {
    msgid: "§cUnregistered or disabled command",
    msgstr: "§c無効なコマンド"
  },
  "desableComSuggest": {
    msgid: "§6Invalid command. Is it possibly the {possibleCommands} command? If so, answer {prefix}yes",
    msgstr: "§6無効なコマンドです。もしかして {possibleCommands} コマンドでしょうか?そうであれば、[{prefix}yes]と答えてください"
  },
  "AllowTagCom": {
    msgid: "§cOnly players with an authorized tag can use it",
    msgstr: "§c許可されたタグを持つプレイヤーのみが使用できます"
  },
  "invalidCom": {
    msgid: "§6invalid command. Please make sure it is correct Commands used:{commandName}",
    msgstr: "§6無効なコマンドです。正しいことを確認してください。使用されたコマンド:{commandName}"
  },
  "Developer commands": {
    msgid: "dev command (this command provides developers and administrators with the ability to reset and verify dynamic properties)",
    msgstr: "デベロッパー専用コマンド(tag OPが必要)"
  },
  "available_commands": {
    msgid: "§6Current available commands",
    msgstr: "§6現在使用可能なコマンド"
  },
  "help_command_description": {
    msgid: "help command (this command displays help as you can see)",
    msgstr: "helpコマンド(登録されたコマンドを表示します）"
  },
  "lang_removeData": {
    msgid: "Language data deletion complete",
    msgstr: "言語データの削除が完了しました"
  },
  "lang_docs": {
    msgid: "lang command (this command switches the language)",
    msgstr: "Lang コマンド(言語を変更できます)"
  },
  "lang_list": {
    msgid: "§aAvailable Languages:\n",
    msgstr: "§a使用可能な言語:\n"
  },
  "lang_change": {
    msgid: "§aLanguage changed to",
    msgstr: "§a言語が変更されました"
  },
  "lang_failed": {
    msgid: "§cFailed to change language to",
    msgstr: "§c言語を変更できませんでした"
  },
  "lang_invalid": {
    msgid: "§cInvalid command usage. Use lang list or lang change <language_code>",
    msgstr: "§c無効なコマンドの使用法です。\nlang list または lang change <language_code> を使用してね"
  },
  "chest_command": {
    msgid: "Chest Command",
    msgstr: "チェストを保護するコマンド(BETA版)"
  },
  "unavailable": {
    msgid: "§cLack of authority",
    msgstr: "§cこのコマンドを使用する権限がありません"
  },
  "chest_help": {
    msgid: "§cInvalid command.\n§aChest protection command usage:.\n  §bchest lock        - locks the chest\n  §bchest info       - displays information about the nearest chest\n  §bchest unlock      - unlocks the chest\n  §bchest protect <lock/unlock> - toggles chest protection\n  §bchest add <playername>   - add a member to the chest\n  §bchest remove <playername>  - remove a member of a chest\n  §bchest all        - displays a list of chest members\n  §bchest list        -displays a list of chest\n  §b_______________________________________\n  §bAuthor: Koukun        - License AGPL-3.0\n  §bYoutubeURL         - https://www.youtube.com/@PEXkoukunn",
    msgstr: "§c無効なコマンドです。\n§aチェスト保護コマンドの使用方法:\n  §bchest lock        - チェストをロックします\n  §bchest info       - 近くのチェストの情報を表示します\n  §bchest unlock      - チェストのロックを解除します\n  §bchest protect <lock/unlock> - チェストの保護状態を切り替えます\n  §bchest add <playername>   - チェストのメンバーを追加します\n  §bchest remove <playername>  - チェストのメンバーを削除します\n  §bchest all        - チェストのメンバー一覧を表示します\n  §bchest list        - 現在保護しているチェストのリストを表示します\n  §b_______________________________________\n  §b作者: こう君        - License AGPL-3.0\n  §bYoutubeURL         - https://www.youtube.com/@PEXkoukunn"
  },
  "MaxChestLimitReached": {
    msgid: "§cThe installation limit of {protectChest} has already been reached",
    msgstr: "§c既に設置上限である{protectChest}に達しています"
  },
  "chestLocksCount": {
    msgid: "§aYou are currently protecting {protectChest} chests",
    msgstr: "§a現在{protectChest}個のチェストが保護されています。"
  },
  "ChestlistCom": {
    msgid: "§aYou have protected {playerChests} chests:",
    msgstr: "§aあなたは現在{playerChests}個のチェストを保護しています。"
  },
  "chestlocation": {
    msgid: "§e- Location: {key}",
    msgstr: "§e- 座標: {key}"
  },
  "nearby_chest_info": {
    msgid: "§a---- Nearby Chest Info ----",
    msgstr: "§a---- 近くのチェスト情報 ----"
  },
  "coordinate_x": {
    msgid: "§bX: §e",
    msgstr: ""
  },
  "coordinate_y": {
    msgid: "§bY: §e",
    msgstr: ""
  },
  "coordinate_z": {
    msgid: "§bZ: §e",
    msgstr: ""
  },
  "protected": {
    msgid: "§aProtected",
    msgstr: "§a保護されています"
  },
  "owner": {
    msgid: "§bOwner: §e",
    msgstr: "§b所有者: §e"
  },
  "members": {
    msgid: "§bMembers: §e",
    msgstr: "§bメンバー: §e"
  },
  "large_chest": {
    msgid: "§bLarge Chest: §e",
    msgstr: "§bラージチェスト: §e"
  },
  "yes": {
    msgid: "Yes",
    msgstr: "§aはい"
  },
  "no": {
    msgid: "No",
    msgstr: "§cいいえ"
  },
  "not_protected": {
    msgid: "§cNot Protected",
    msgstr: "§c保護されていません"
  },
  "notFound_chest": {
    msgid: "§cCan't find chest",
    msgstr: "§cチェストが見つかりませんでした"
  },
  "chestProtectRemove": {
    msgid: "§a Chest protection removed",
    msgstr: "§aチェストの保護を解除しました"
  },
  "AlreadyProChest": {
    msgid: "§a This chest is already protected",
    msgstr: "§a このチェストは既に保護されています。"
  },
  "chest_lookstate": {
    msgid: "§a chest protected {lcokstate}",
    msgstr: "§aチェストを保護しました{lcokstate}"
  },
  "chest_removeData": {
    msgid: "§aAll chest protection data has been reset.",
    msgstr: "§a全てのチェスト保護データをリセットしました"
  },
  "isLookChest": {
    msgid: "§cThis chest is locked",
    msgstr: "§cこのチェストはロックされています"
  },
  "isProChest": {
    msgid: "§c This chest is protected!",
    msgstr: "§cこのチェストは保護されています"
  },
  "ProChestBreak": {
    msgid: "§a Protected chest has been destroyed. Protected data also deleted.",
    msgstr: "§a保護されたチェストを破壊しました。保護データも削除されました。"
  },
  "lockChange": {
    msgid: "§a Protection state of chest is changed to {lock}",
    msgstr: "§aチェストの保護状態を変更しました"
  },
  "NotChest": {
    msgid: "§cYou are not authorized to operate this chest.",
    msgstr: "§cこのチェストを操作する権限がありません"
  },
  "AddM": {
    msgid: "§a{member} Added  as a member location:{chestLocation}",
    msgstr: "§aをメンバーに追加しました。"
  },
  "addYouM": {
    msgid: "§aThis{playerName}has added you to the following chests{chestLocation}",
    msgstr: "§a{playerName}があなたを以下のチェストのメンバーに追加しました:\n{chestLocation}のチェスト"
  },
  "RemoveYouM": {
    msgid: "§aThis{playerName}has removed you from members in the following chests{chestLocation}",
    msgstr: "§a{playerName}があなたを以下のチェストのメンバーから削除しました:\n{chestLocation}のチェスト"
  },
  "MAlreday": {
    msgid: "§c{member} is already a member. ",
    msgstr: "§cは既にメンバーです"
  },
  "RemoveM": {
    msgid: "§a{member} has Removed from members",
    msgstr: "§aをメンバーから削除しました"
  },
  "NotM": {
    msgid: "§cis not a member",
    msgstr: "§cはメンバーではありません"
  },
  "allM": {
    msgid: "§a member: ",
    msgstr: "§aメンバー: "
  },
  "NotFoundM": {
    msgid: "§c No members",
    msgstr: "§c メンバーがいません"
  },
  "ExplosionWarning": {
    msgid: "§c Can you please not blow that up?",
    msgstr: "§c このチェストは無敵です"
  },
  "cannotPlaceItem": {
    msgid: "§c It is forbidden to place pistons in this area",
    msgstr: "§c このエリアにこのアイテムを置く事は禁止されています"
  },
};
