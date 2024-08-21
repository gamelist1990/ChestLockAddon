import { ActionFormData } from "@minecraft/server-ui";
import { Player } from "@minecraft/server";
import { runCommand } from "../../Handler";
import { getAvailableLanguages,translate } from "../langs/list/LanguageManager";


export function showBasicUI(player: Player): Promise<void> {
  const form = new ActionFormData()
    .title("Main Menu")
    .body(translate(player, "ChooseCom"))
    .button("help")
    .button("chest")
    .button("lang")
    .button("Exit");

  //@ts-ignore
  return form.show(player)
    .then((response) => {
      if (response.canceled) {
        // キャンセル時の処理 (必要であれば)
      } else {
        switch (response.selection) {
          case 0:
            runCommand(player.name, "help");
            break;
          case 1:
            showChestMenu(player); 
            break;
          case 2:
            showLangMenu(player);
            break;
        }
      }
    })
    .catch((error: Error) => {
      console.error(translate(player,"FromError"), error);
      player.sendMessage(translate(player,"FromError") + error.message);
    });
}

function showChestMenu(player: Player): Promise<void> {
  const form = new ActionFormData()
    .title("Chest Menu")
    .body(translate(player,"ChestCom"))
    .button(translate(player,"Chestinfo"))
    .button(translate(player,"Chestlock"))
    .button(translate(player,"ChestMember"))
    .button(translate(player,"back"));

  //@ts-ignore
  return form.show(player)
    .then((response) => {
      if (response.canceled) {
      } else {
        switch (response.selection) {
          case 0:
            runCommand(player.name,"chest",["info"]); 
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
      console.error(translate(player,"FromError"), error);
      player.sendMessage(translate(player,"FromError") + error.message);
    });
}




function showLockMenu(player: Player): Promise<void> {
  const form = new ActionFormData()
    .title("Lock Menu")
    .body(translate(player,"lockinfo"))
    .button(translate(player,"locking"))
    .button(translate(player,"unlocking"))
    .button(translate(player,"ProtectChest"))
    .button(translate(player,"back"));

  //@ts-ignore
  return form.show(player)
    .then((response) => {
      if (response.canceled) {
      } else {
        switch (response.selection) {
          case 0:
            runCommand(player.name, "chest",["lock"]); 
            break;
          case 1:
            runCommand(player.name, "chest",["unlock"]); 
            break;
          case 2:
            runCommand(player.name, "chest",["list"]); 
            break;
          case 3:
            showChestMenu(player);
            break;
        }
      }
    })
    .catch((error: Error) => {
      console.error(translate(player,"FromError"), error);
      player.sendMessage(translate(player,"FromError") + error.message);
    });
}

function showMemberMenu(player: Player): Promise<void> {
  const form = new ActionFormData()
    .title("Member Menu")
    .body(translate(player,"MemberChoose"))
    .button(translate(player,"MemberAdd"))
    .button(translate(player,"MemberRemove"))
    .button(translate(player,"Memberall"))
    .button(translate(player,"back"));

  //@ts-ignore
  return form.show(player)
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
            runCommand(player.name, "chest",["all"]);
            break;
          case 3:
            showChestMenu(player); 
            break;
        }
      }
    })
    .catch((error: Error) => {
      console.error(translate(player,"FromError"), error);
      player.sendMessage(translate(player,"FromError") + error.message);
    });
}


function showAddMemberMenu(player: Player): Promise<void> {
  const onlinePlayers = player.dimension.getPlayers();
  const form = new ActionFormData()
    .title("Add Member")
    .body(translate(player,"AddMemberSelect"));

  onlinePlayers.forEach((p) => {
    form.button(p.name);
  });

  form.button(translate(player,"back"));

  //@ts-ignore
  return form.show(player)
    .then((response) => {
      if (response.canceled) {
      } else {
        if (response.selection !== undefined && response.selection >= 0 && response.selection < onlinePlayers.length) {
          const targetPlayer = onlinePlayers[response.selection];
          runCommand(player.name, "chest", ["add", targetPlayer.name]);
        } else if (response.selection === onlinePlayers.length) { 
        } else {
        }

        showMemberMenu(player); 
      }
    })
    .catch((error: Error) => {
      console.error(translate(player,"FromError"), error);
      player.sendMessage(translate(player,"FromError") + error.message);
    });
}

function showRemoveMemberMenu(player: Player): Promise<void> {
  const onlinePlayers = player.dimension.getPlayers();
  const form = new ActionFormData()
    .title("Remove Member")
    .body(translate(player,"RemoveMemberSelect"));

  onlinePlayers.forEach((p) => {
    form.button(p.name);
  });

  form.button(translate(player,"back"));

  //@ts-ignore
  return form.show(player)
    .then((response) => {
      if (response.canceled) {
      } else {
        if (response.selection !== undefined && response.selection >= 0 && response.selection < onlinePlayers.length) {
          const targetPlayer = onlinePlayers[response.selection];
          runCommand(player.name, "chest", ["remove", targetPlayer.name]);
        } else if (response.selection === onlinePlayers.length) { 
        } else {
        }

        showMemberMenu(player); 
      }
    })
    .catch((error: Error) => {
      console.error(translate(player,"FromError"), error);
      player.sendMessage(translate(player,"FromError") + error.message);
    });
}


function showLangMenu(player: Player): Promise<void> {
  const form = new ActionFormData()
    .title("lang Menu")
    .body(translate(player,"SelectLang"))
    .button(translate(player,"langList"))
    .button(translate(player,"langChange"))
    .button(translate(player,"back"));

  //@ts-ignore
  return form.show(player)
    .then((response) => {
      if (response.canceled) {
      } else {
        switch (response.selection) {
          case 0:
            runCommand(player.name,"lang",["list"]); 
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
      console.error(translate(player,"FromError"), error);
      player.sendMessage(translate(player,"FromError") + error.message);
    });
}

function showChangeLangMenu(player: Player): Promise<void> {
  const availableLanguages = getAvailableLanguages();
  const form = new ActionFormData()
    .title("Change Language")
    .body(translate(player,"langChange1"));

  availableLanguages.forEach((lang) => {
    form.button(lang);
  });

  form.button(translate(player,"back"));

  //@ts-ignore
  return form.show(player)
    .then((response) => {
      if (response.canceled) {
      } else {
        if (response.selection !== undefined && response.selection >= 0 && response.selection < availableLanguages.length) {
          const selectedLang = availableLanguages[response.selection];
          runCommand(player.name, "lang", ["change", selectedLang]);
        } else if (response.selection === availableLanguages.length) {
          showLangMenu(player); 
        } else {
        }
      }
    })
    .catch((error: Error) => {
      console.error(translate(player,"FromError"), error);
      player.sendMessage(translate(player,"FromError") + error.message);
    });
}