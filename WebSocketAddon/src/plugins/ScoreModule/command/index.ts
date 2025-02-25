import { registerResetScoreCommand } from './resetScore';
import { registerNumberCommand } from './randomNumber';
import { registerScoreCommand } from './copyScore';
import { registerTeamCommand } from './team';
import { registerScoreDeleteCommand } from './scoreDelete';
import { registerTeamCountCommand } from './teamCount';
import { registerCloseFormCommand } from './closeForm';
import { registerChangeTagCommand } from './changeTag';
import { registerCloneBlockCommand } from './cloneBlock';
import { Handler } from '../../../module/Handler';
import { registerChestFillCommand } from './chestFill';
import { registerRandomBlockCommand } from './randomBlock';
import { registerRandomDropCommand } from './dropItem';

export function registerAllCommands(handler: Handler, moduleName: string) {
    registerResetScoreCommand(handler, moduleName);
    registerNumberCommand(handler, moduleName);
    registerScoreCommand(handler, moduleName);
    registerTeamCommand(handler, moduleName);
    registerScoreDeleteCommand(handler, moduleName);
    registerTeamCountCommand(handler, moduleName);
    registerCloseFormCommand(handler, moduleName);
    registerChangeTagCommand(handler, moduleName);
    registerCloneBlockCommand(handler, moduleName);
    registerChestFillCommand(handler, moduleName);
    registerRandomBlockCommand(handler, moduleName);
    registerRandomDropCommand(handler, moduleName);
}