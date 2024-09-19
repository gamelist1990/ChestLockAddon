import { ActionFormData, ModalFormData } from '@minecraft/server-ui';
import { Player } from '@minecraft/server';
import { runCommand } from '../../Modules/Handler';
import { getTpaRequests } from '../utility/tpa';
import { getAvailableLanguages, translate } from '../langs/list/LanguageManager';
import { getAllPlayerNames } from '../../Modules/Util';
import { checkReports } from '../utility/report';

export function showBasicUI(player: Player): Promise<void> {
  player.playSound('mob.chicken.plop');
  const form = new ActionFormData()
    .title('Main Menu')
    .body(translate(player, 'ChooseCom'));

  // ボタンの内容を条件分岐で変更
  if (player.hasTag("staff") || player.hasTag("op")) {
    form.button(translate(player, 'ui.StaffMenu'), 'textures/items/book_writable'); // アイコンはそのまま
  } else {
    form.button(translate(player, 'uihelp'), 'textures/items/book_writable');
  }

  form.button(translate(player, 'uichest'), 'textures/blocks/chest_front')
    .button(translate(player, 'uilang'), 'textures/ui/language_glyph_color')
    .button(translate(player, 'uijpch'), 'textures/ui/chat_send')
    .button(translate(player, 'uitpa'), 'textures/items/ender_pearl')
    .button(translate(player, 'ui.MainLoreButton'), 'textures/items/name_tag')
    .button(translate(player, 'ui.ReportButton'), 'textures/ui/icon_bell')
    .button(translate(player, 'back'));


  return form
    //@ts-ignore
    .show(player)
    .then((response) => {
      if (response.canceled) {
        return; // キャンセルされた場合は何もしない
      }

      let selection: number = response.selection !== undefined ? response.selection : -1;

   

      switch (selection) {
        case 0:
          if (player.hasTag("staff") || player.hasTag("op")) {
            showStaffUI(player);
          } else {
            runCommand(player.name, 'help');
          }
          break;
        case 1:
          showChestMenu(player);
          break;
        case 2:
          showLangMenu(player);
          break;
        case 3:
          showjpchMenu(player);
          break;
        case 4:
          showTpaMenu(player);
          break;
        case 5:
          showloreMenu(player);
          break;
        case 6:
          showReportMenu(player);
          break;
      }
    })
    .catch((error: Error) => {
      console.error(translate(player, 'FromError'), error);
      player.sendMessage(translate(player, 'FromError') + error.message);
    });
}

// スタッフ専用のUIを表示する関数
function showStaffUI(player: Player): Promise<void> {
  // スタッフUIの内容を定義
  const staffForm = new ActionFormData()
    .title('Staff Menu')
    .button(translate(player,"ui.checkReports"))
    .button(translate(player, "ui.warnmenu"))
    .button('Main Menu');

  return staffForm
    //@ts-ignore
    .show(player)
    .then((response) => {
      if (response.canceled) {
        return;
      }

      switch (response.selection) {
        case 0:
          checkReports(player);
          break;
        case 1:
          showWarnMainMenu(player); 
          break;
        case 2:
          showBasicUI(player);
          break;
      }
    });
}


function showWarnMainMenu(player: Player): Promise<void> {
  player.playSound('mob.chicken.plop');


  const form = new ActionFormData()
    .title('Warn Main Menu')
    .body(translate(player, 'command.warnMain'))
    .button(translate(player, 'ui.showWarn'))
    .button(translate(player, 'ui.tempkick'))
    .button(translate(player, 'back'));

  return (
    form
      //@ts-ignore
      .show(player)
      .then((response) => {
        if (response.canceled) {
        } else {
          if (response.selection === 0) {
            showWarnMenu(player);
          } else if (response.selection === 1) {
            showtempkick(player);
          } else if (response.selection === 2) {
            showBasicUI(player);
          }
        }
      })
      .catch((error: Error) => {
        console.error(translate(player, 'FromError'), error);
        player.sendMessage(translate(player, 'FromError') + error.message);
      })
  );
}

function showtempkick(player: Player): Promise<void> {
  player.playSound('mob.chicken.plop');

  const playerNames = getAllPlayerNames(player);

  const form = new ActionFormData()
    .title('TempKick Menu')
    .body(translate(player, 'sendtempkickUser'));

  playerNames.forEach((p) => {
    form.button(p);
  });

  form.button(translate(player, 'back'));

  return (
    form
      //@ts-ignore
      .show(player)
      .then((response) => {
        if (response.canceled) {
        } else {
          if (
            response.selection !== undefined &&
            response.selection >= 0 &&
            response.selection < playerNames.length
          ) {
            const targetPlayerName = playerNames[response.selection];
            runCommand(player.name, 'staff', ['warn','-p',targetPlayerName,'-r','tempkick','-kick',]);
          } else if (response.selection === playerNames.length) {
            showWarnMainMenu(player);
          } else {
          }
        }
      })
      .catch((error: Error) => {
        console.error(translate(player, 'FromError'), error);
        player.sendMessage(translate(player, 'FromError') + error.message);
      })
  );
}

function showWarnMenu(player: Player): Promise<void> {
  player.playSound('mob.chicken.plop');

  const playerNames = getAllPlayerNames(player);

  const form = new ActionFormData()
    .title('Warn Menu')
    .body(translate(player, 'ui.reportPSelect'));

  playerNames.forEach((p) => {
    form.button(p);
  });

  form.button(translate(player, 'back'));

  return (
    form
      //@ts-ignore
      .show(player)
      .then((response) => {
        if (response.canceled) {
        } else {
          if (
            response.selection !== undefined &&
            response.selection >= 0 &&
            response.selection < playerNames.length
          ) {
            const targetPlayerName = playerNames[response.selection];
            const modal = new ModalFormData()
              .title('Warn Reason')
              .textField(translate(player, "ui.EnterReson"), '');

            //@ts-ignore
            modal.show(player).then((modalResponse) => {
              if (modalResponse.canceled || modalResponse.formValues === undefined) return;

              const reason = modalResponse.formValues[0] as string;
              runCommand(player.name, 'staff', ['warn','-p',targetPlayerName, '-r', reason]);
            });
          } else if (response.selection === playerNames.length) {
            showWarnMainMenu(player);
          } else {
          }
        }
      })
      .catch((error: Error) => {
        console.error(translate(player, 'FromError'), error);
        player.sendMessage(translate(player, 'FromError') + error.message);
      })
  );
}

function showChestMenu(player: Player): Promise<void> {

  player.playSound('mob.chicken.plop');
  const form = new ActionFormData()
    .title('Chest Menu')
    .body(translate(player, 'ChestCom'))
    .button(translate(player, 'Chestinfo'))
    .button(translate(player, 'Chestlock'))
    .button(translate(player, 'ChestMember'))
    .button(translate(player, 'back'));

  return form
    //@ts-ignore
    .show(player)
    .then((response) => {
      if (response.canceled) {
      } else {
        switch (response.selection) {
          case 0:
            runCommand(player.name, 'chest', ['info']);
            break;
          case 1:
            showLockMenu(player);
            break;
          case 2:
            showMemberMenu(player);
            break;
          case 3:
            showBasicUI(player);
            break;
        }
      }
    })
    .catch((error: Error) => {
      console.error(translate(player, 'FromError'), error);
      player.sendMessage(translate(player, 'FromError') + error.message);
    });
}

function showLockMenu(player: Player): Promise<void> {
  player.playSound('mob.chicken.plop');
  const form = new ActionFormData()
    .title('Lock Menu')
    .body(translate(player, 'lockinfo'))
    .button(translate(player, 'locking'))
    .button(translate(player, 'unlocking'))
    .button(translate(player, 'ProtectChest'))
    .button(translate(player, 'back'));

  return form
    //@ts-ignore
    .show(player)
    .then((response) => {
      if (response.canceled) {
      } else {
        switch (response.selection) {
          case 0:
            runCommand(player.name, 'chest', ['lock']);
            break;
          case 1:
            runCommand(player.name, 'chest', ['unlock']);
            break;
          case 2:
            runCommand(player.name, 'chest', ['list']);
            break;
          case 3:
            showChestMenu(player);
            break;
        }
      }
    })
    .catch((error: Error) => {
      console.error(translate(player, 'FromError'), error);
      player.sendMessage(translate(player, 'FromError') + error.message);
    });
}

function showMemberMenu(player: Player): Promise<void> {
  player.playSound('mob.chicken.plop');
  const form = new ActionFormData()
    .title('Member Menu')
    .body(translate(player, 'MemberChoose'))
    .button(translate(player, 'MemberAdd'))
    .button(translate(player, 'MemberRemove'))
    .button(translate(player, 'Memberall'))
    .button(translate(player, 'back'));

  //@ts-ignore
  return form
    //@ts-ignore
    .show(player)
    .then((response) => {
      if (response.canceled) {
      } else {
        switch (response.selection) {
          case 0:
            showAddMemberMenu(player);
            break;
          case 1:
            showRemoveMemberMenu(player);
            break;
          case 2:
            runCommand(player.name, 'chest', ['all']);
            break;
          case 3:
            showChestMenu(player);
            break;
        }
      }
    })
    .catch((error: Error) => {
      console.error(translate(player, 'FromError'), error);
      player.sendMessage(translate(player, 'FromError') + error.message);
    });
}

function showAddMemberMenu(player: Player): Promise<void> {
  player.playSound('mob.chicken.plop');
  const onlinePlayers = player.dimension.getPlayers();
  const form = new ActionFormData().title('Add Member').body(translate(player, 'AddMemberSelect'));

  onlinePlayers.forEach((p) => {
    form.button(p.name);
  });

  form.button(translate(player, 'back'));

  return form
    //@ts-ignore
    .show(player)
    .then((response) => {
      if (response.canceled) {
      } else {
        if (
          response.selection !== undefined &&
          response.selection >= 0 &&
          response.selection < onlinePlayers.length
        ) {
          const targetPlayer = onlinePlayers[response.selection];
          runCommand(player.name, 'chest', ['add', targetPlayer.name]);
        } else if (response.selection === onlinePlayers.length) {
        } else {
        }

        showMemberMenu(player);
      }
    })
    .catch((error: Error) => {
      console.error(translate(player, 'FromError'), error);
      player.sendMessage(translate(player, 'FromError') + error.message);
    });
}

function showRemoveMemberMenu(player: Player): Promise<void> {
  player.playSound('mob.chicken.plop');
  const onlinePlayers = player.dimension.getPlayers();
  const form = new ActionFormData()
    .title('Remove Member')
    .body(translate(player, 'RemoveMemberSelect'));

  onlinePlayers.forEach((p) => {
    form.button(p.name);
  });

  form.button(translate(player, 'back'));

  return form
    //@ts-ignore
    .show(player)
    .then((response) => {
      if (response.canceled) {
      } else {
        if (
          response.selection !== undefined &&
          response.selection >= 0 &&
          response.selection < onlinePlayers.length
        ) {
          const targetPlayer = onlinePlayers[response.selection];
          runCommand(player.name, 'chest', ['remove', targetPlayer.name]);
        } else if (response.selection === onlinePlayers.length) {
        } else {
        }

        showMemberMenu(player);
      }
    })
    .catch((error: Error) => {
      console.error(translate(player, 'FromError'), error);
      player.sendMessage(translate(player, 'FromError') + error.message);
    });
}

function showLangMenu(player: Player): Promise<void> {
  player.playSound('mob.chicken.plop');
  const form = new ActionFormData()
    .title('lang Menu')
    .body(translate(player, 'SelectLang'))
    .button(translate(player, 'langList'))
    .button(translate(player, 'langChange'))
    .button(translate(player, 'back'));

  //@ts-ignore
  return form
    //@ts-ignore
    .show(player)
    .then((response) => {
      if (response.canceled) {
      } else {
        switch (response.selection) {
          case 0:
            runCommand(player.name, 'lang', ['list']);
            break;
          case 1:
            showChangeLangMenu(player);
            break;
          case 2:
            showBasicUI(player);
            break;
        }
      }
    })
    .catch((error: Error) => {
      console.error(translate(player, 'FromError'), error);
      player.sendMessage(translate(player, 'FromError') + error.message);
    });
}

function showChangeLangMenu(player: Player): Promise<void> {
  player.playSound('mob.chicken.plop');
  const availableLanguages = getAvailableLanguages();
  const form = new ActionFormData().title('Change Language').body(translate(player, 'langChange1'));

  availableLanguages.forEach((lang) => {
    form.button(lang);
  });

  form.button(translate(player, 'back'));

  //@ts-ignore
  return form
    //@ts-ignore
    .show(player)
    .then((response) => {
      if (response.canceled) {
      } else {
        if (
          response.selection !== undefined &&
          response.selection >= 0 &&
          response.selection < availableLanguages.length
        ) {
          const selectedLang = availableLanguages[response.selection];
          runCommand(player.name, 'lang', ['change', selectedLang]);
        } else if (response.selection === availableLanguages.length) {
          showLangMenu(player);
        } else {
        }
      }
    })
    .catch((error: Error) => {
      console.error(translate(player, 'FromError'), error);
      player.sendMessage(translate(player, 'FromError') + error.message);
    });
}

function showjpchMenu(player: Player): Promise<void> {
  player.playSound('mob.chicken.plop');
  const form = new ActionFormData()
    .title('Jpch Menu')
    .body(translate(player, 'jpchCom'))
    .button(translate(player, 'jpenable'))
    .button(translate(player, 'jpdisable'))
    .button(translate(player, 'back'));

  return form
    //@ts-ignore
    .show(player)
    .then((response) => {
      if (response.canceled) {
      } else {
        switch (response.selection) {
          case 0:
            runCommand(player.name, 'jpch', ['-true']);
            break;
          case 1:
            runCommand(player.name, 'jpch', ['-false']);
            break;
          case 2:
            showBasicUI(player);
            break;
        }
      }
    })
    .catch((error: Error) => {
      console.error(translate(player, 'FromError'), error);
      player.sendMessage(translate(player, 'FromError') + error.message);
    });
}

function showTpaMenu(player: Player): Promise<void> {
  player.playSound('mob.chicken.plop');

  const requests = getTpaRequests(player.name);

  const form = new ActionFormData()
    .title('TPA Menu')
    .body(translate(player, 'TpaRequesMenu', { requestList: `${requests.length}` }))
    .button(translate(player, 'SendTpa'))
    .button(translate(player, 'ShowTpaRequests'))
    .button(translate(player, 'back'));

  return (
    form
      //@ts-ignore
      .show(player)
      .then((response) => {
        if (response.canceled) {
        } else {
          if (response.selection === 0) {
            showSendTpaMenu(player);
          } else if (response.selection === 1) {
            showTpaRequestsMenu(player, requests);
          } else if (response.selection === 2) {
            showBasicUI(player);
          }
        }
      })
      .catch((error: Error) => {
        console.error(translate(player, 'FromError'), error);
        player.sendMessage(translate(player, 'FromError') + error.message);
      })
  );
}

function showTpaRequestsMenu(player: Player, requests: string[]): Promise<void> {
  player.playSound('mob.chicken.plop');

  const form = new ActionFormData().title('TPA Requests');

  if (requests.length === 0) {
    form.body(translate(player, 'NoTpaRequests'));
  } else {
    // リクエストがある場合
    form.body(translate(player, 'SelectTpaRequest')); // リクエストを選択するよう促すメッセージを表示
    requests.forEach((requester) => {
      form.button(requester); // 各リクエスト元プレイヤーの名前がボタンになる
    });
  }

  form.button(translate(player, 'back')); // TPAメニューに戻るボタン


  return (
    form
      //@ts-ignore
      .show(player)
      .then((response) => {
        if (response.canceled) {
          // キャンセル時の処理
        } else {
          if (
            requests.length > 0 &&
            response.selection !== undefined &&
            response.selection >= 0 &&
            response.selection < requests.length
          ) {
            const requesterName = requests[response.selection];
            runCommand(player.name, 'tpa', ['-a', requesterName]); // TPAリクエストを承認
          } else if (response.selection === requests.length) {
            showTpaMenu(player); // TPAメニューに戻る
          }
        }
      })
      .catch((error: Error) => {
        console.error(translate(player, 'FromError'), error);
        player.sendMessage(translate(player, 'FromError') + error.message);
      })
  );
}

function showSendTpaMenu(player: Player): Promise<void> {
  player.playSound('mob.chicken.plop');

  const playerNames = player.dimension.getPlayers();

  const form = new ActionFormData()
    .title('Send TPA Request')
    .body(translate(player, 'SendTpaSelect'));

  playerNames.forEach((p) => {
    form.button(p.name);
  });

  form.button(translate(player, 'back'));

  return (
    form
      //@ts-ignore
      .show(player)
      .then((response) => {
        if (response.canceled) {
        } else {
          if (
            response.selection !== undefined &&
            response.selection >= 0 &&
            response.selection < playerNames.length
          ) {
            const targetPlayerName = playerNames[response.selection];
            runCommand(player.name, 'tpa', ['-r', targetPlayerName.name]);
          } else if (response.selection === playerNames.length) {
            showTpaMenu(player);
          } else {
          }
        }
      })
      .catch((error: Error) => {
        console.error(translate(player, 'FromError'), error);
        player.sendMessage(translate(player, 'FromError') + error.message);
      })
  );
}



function showloreMenu(player: Player): Promise<void> {
  player.playSound('mob.chicken.plop');


  const form = new ActionFormData()
    .title('Lore Menu')
    .body(translate(player, 'command.loreDocs'))
    .button(translate(player, 'command.Changelore'))
    .button(translate(player, 'command.ChangeName'))
    .button(translate(player, 'command.ClearLore'))
    .button(translate(player, 'back'));

  return (
    form
      //@ts-ignore
      .show(player)
      .then((response) => {
        if (response.canceled) {
        } else {
          if (response.selection === 0) {
            showChangelore(player);
          } else if (response.selection === 1) {
            showChangeName(player);
          } else if (response.selection === 2) {
            ClearLore(player);
          }
        }
      })
      .catch((error: Error) => {
        console.error(translate(player, 'FromError'), error);
        player.sendMessage(translate(player, 'FromError') + error.message);
      })
  );
}

function showChangelore(player: Player): void {
  const form = new ModalFormData()
    .title('Change Lore')
    .textField(translate(player, "command.NewLore"), 'New lore');
  //@ts-ignore
  form.show(player).then((response) => {
    if (!response.canceled && response.formValues) {
      const NewLore = response.formValues[0] as string;
      runCommand(player.name, 'lore', ['-slot', '0', '-set', NewLore]);
    }
  });
}

function showChangeName(player: Player): void {
  const form = new ModalFormData()
    .title('Change Name')
    .textField(translate(player, "command.NewName"), 'New name');
  //@ts-ignore
  form.show(player).then((response) => {
    if (!response.canceled && response.formValues) {
      const NewName = response.formValues[0] as string;
      runCommand(player.name, 'lore', ['-slot', '0', '-rename', NewName]);
    }
  });
}

function ClearLore(player: Player): void {
  runCommand(player.name, 'lore', ['-slot', '0', '-clear','a']);
}


function showReportMenu(player: Player): Promise<void> {
  player.playSound('mob.chicken.plop');

  const playerNames = getAllPlayerNames(player);

  const form = new ActionFormData()
    .title('Report Request')
    .body(translate(player, 'ui.reportPSelect'));

  playerNames.forEach((p) => {
    form.button(p);
  });

  form.button(translate(player, 'back'));

  return (
    form
      //@ts-ignore
      .show(player)
      .then((response) => {
        if (response.canceled) {
        } else {
          if (
            response.selection !== undefined &&
            response.selection >= 0 &&
            response.selection < playerNames.length
          ) {
            const targetPlayerName = playerNames[response.selection];
            const modal = new ModalFormData()
              .title('Report Reason')
              .textField(translate(player,"ui.EnterReport"), '');

            //@ts-ignore
            modal.show(player).then((modalResponse) => {
              if (modalResponse.canceled || modalResponse.formValues === undefined) return;

              const reason = modalResponse.formValues[0] as string;
              runCommand(player.name, 'report', [targetPlayerName, '-r', reason]);
            });
          } else if (response.selection === playerNames.length) {
            showBasicUI(player);
          } else {
          }
        }
      })
      .catch((error: Error) => {
        console.error(translate(player, 'FromError'), error);
        player.sendMessage(translate(player, 'FromError') + error.message);
      })
  );
}