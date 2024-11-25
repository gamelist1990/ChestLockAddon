import * as Server from "@minecraft/server";
import * as ServerUi from "@minecraft/server-ui";


declare global {
  var console: Console;
  interface Console {
    log: (...arg: any) => void;
    error: (...arg: any) => void;
    warn: (...arg: any) => void;
  }
}
