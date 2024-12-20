## ChestLockAddon Latest Version 1.6

Last Release : [![GitHub Release](https://img.shields.io/github/v/release/gamelist1990/ChestLockAddon?include_prereleases&sort=date&style=social)](https://github.com/gamelist1990/ChestLockAddon/releases)

Total Downloads: [![GitHub Downloads (all assets, all releases)](https://img.shields.io/github/downloads/gamelist1990/ChestLockAddon/total?style=flat-square&logo=https%3A%2F%2Fgithub.com%2Fgamelist1990%2FChestLockAddon%2Fblob%2Fmain%2FAllAddon%2Fpack_icon.png%3Fraw%3Dtrue)](https://github.com/gamelist1990/ChestLockAddon/releases)

See "How to Use" below for download instructions.

The current latest version is **1.6**. (Versions 1.5-beta ~ 1.5.5-beta are not available on GitHub.)

### Update History (Versions 1.4 to 1.6)

#### Version 1.6 (Latest)

[ChangeLog](https://github.com/gamelist1990/ChestLockAddon/compare/1.4...1.6)

-   **New Features:**
    -   `transfer` command: Cross-server data transfer functionality.
    -   Added relevant button icons to the UI.
-   **Improvements:**
    -   Updated version to 1.6.
    -   Added data transfer functionality to the Loader.
    -   Imported the `transfer` command.
    -   Updated translations.
    -   Added dependencies to `package.json`.

#### Version 1.5.5

[ChangeLog](https://github.com/gamelist1990/ChestLockAddon/compare/1.4...1.6)

-   **New Features:**
    -   Full support for Chinese/Finnish languages.
    -   Stable scoring system.
    -   Lockdown Mode.
    -   New BAN system.
-   **Improvements:**
    -   BAN handling:
        -   Players with `op` and `staff` tags are excluded from being banned.
        -   Corrected duration message and added player information.
        -   Handled errors when `player.json` is missing.
    -   Report function: Enhanced with the addition of timestamps.
    -   `formatTimestamp` function: Added timezone offset.
    -   `suggestCommand` function: Added arguments.
    -   UI: Changed button icons.
    -   Code cleanup for normal coordinate TP in the hub and `invsee`.
    -   Improved handling after tool execution.

#### Version 1.5.3-Beta

[ChangeLog](https://github.com/gamelist1990/ChestLockAddon/compare/1.4...1.6)

-   **New Features:**
    -   New Anti-Cheat system (v0.2).
    -   ServerStatus (displays server status).
    -   Function to display the player with the highest ping value.
-   **Improvements:**
    -   Updated warning (warn) functionality.
    -   Updated error checking functionality.

#### Version 1.5-Beta

[ChangeLog](https://github.com/gamelist1990/ChestLockAddon/compare/1.4...1.6)

-   **New Features:**
    -   `ping` command.
    -   Voting functionality.
    -   `getPlayersByName` command.
    -   WebSocket event collection functionality.
-   **Improvements:**
    -   Updated ChestLockAddon, bug fixes.
    -   Fixed Y-coordinate bug in the hub.
    -   Updated `sample.ts`, `test.ts`.
-   **Removed:**
    -   Shop functionality.

#### Version 1.4 (Previous Version)

-   File reorganization, changed translation keys.
-   Other bug fixes.

### Overview

This addon is operated using commands that begin with `!`. UI support is available (`!item`, `!ui` commands). The `!` prefix can be changed in `handler.ts`. Multilingual support is available. Please report any bugs or problems to Discord or Issues.

### Command List

-   Owner: Requires the `op` tag (`/tag @s add op`).
-   Staff: Requires the `staff` tag.

| Command            | Description                                                                   | Permission | Notes                                          |
| :------------------ | :------------------------------------------------------------------------ | :--------- | :--------------------------------------------- |
| `!help`             | Displays a list of available commands.                                  | Anyone     |                                                |
| `!chest`            | Opens the chest commands.                                              | Anyone     |                                                |
| `!lang`             | Changes the language settings.                                          | Anyone     |                                                |
| `!dev`              | Developer-only commands.                                                | `op`       |                                                |
| `!ui`               | Opens the UI (for PS4/5).                                               | Anyone     |                                                |
| `!jpch`             | LunaChat recreation function (experimental).                              | Anyone     |                                                |
| `!item`             | Gets the item to open the UI.                                           | Anyone     |                                                |
| `!tpa`              | Sends a TP request.                                                     | Anyone     |                                                |
| `!list`             | Displays player information.                                              | `op`       |                                                |
| `!antichat`         | Anti-chat control (on/off/freeze/unfreeze).                             | `op`       | Example: `!antichat on`                        |
| `!lore`             | Sets the description or name of an item.                               | Anyone     | Example: `!lore -set apple`, `!lore -rename test` |
| `!join`             | Subcommand `-settings` for rule settings, `-true`/`-false` for display toggle. | `op`       |                                                |
| `!warpgate`         | Create/delete/list warpgates.                                          | `op`       | Example: `!warpgate -create`, `-delete`, `-list`   |
| `!about`            | Displays an overview of the addon.                                      | Anyone     |                                                |
| `!staff`            | Staff-only commands.                                                    | `staff`    |                                                |
| `!report`           | Report a cheating player.                                                 | Anyone     |                                                |
| `!ping`             | Displays your ping value.                                                | Anyone     |                                                |
| `!vote`             | Starts a vote.                                                          | `op`       | (Only admins can start, everyone can participate) |
| `!getPlayersByName` | Retrieves information from a player's name.                               | Anyone     |                                                |
| `!lockDown`         | Enables/disables lockdown mode.                                         | `op`       |                                                |
| `!ban`              | Bans a player.                                                          | `op`       | Excludes players with `op` and `staff` tags     |
| `!transfer`         | Cross-server data transfer.                                              | `op`       |                                                |

-   This is the command list for version 1.6.

### Other Information

-   **Prefix Change:** Can be changed in `handler.ts`.
-   **Multilingual Support:** Japanese (ja_JP), English (en_US), Chinese (zh_CN), Russian (ru_RU), Korean (ko_KR), Finnish (fi_FI)
    -   Fully Supported: `ja_JP`, `en_US`, `zh_CN`, `fi_FI`
    -   Partially Supported: `ru_RU`, `ko_KR`
    -   Language can be changed using the `!lang` command.
-   **How to Use:**
    1. Download the latest version from [Releases](https://github.com/gamelist1990/ChestLockAddon/releases).
    2. In Minecraft, enable **[Beta API]** under Experimental Features.
    3. After joining the world, use `!help` to check the commands.
    4. Administrators: It is recommended to give yourself the `op` tag.
-   **Language Files:** `src/command/langs/list` (JSON format).
-   **Support:** [Discord](https://discord.com/invite/GJyqBm7Pyd)
-   **Download:** [GitHub Releases](https://github.com/gamelist1990/ChestLockAddon/releases)
