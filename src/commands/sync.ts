import chalk from "chalk";

import { logError, LogOptions } from "../log.js";
import { diff } from "../modules/sync/diff.js";
import { fetchModel, transformSyncModel } from "../modules/sync/generateSyncModel.js";
import { printDiff } from "../modules/sync/printDiff.js";
import { requestConfirmation } from "../modules/sync/utils/consoleHelpers.js";
import { readContentModelFromFolder } from "../modules/sync/utils/getContentModel.js";
import { validateContentFolder, validateContentModel } from "../modules/sync/validation.js";
import { RegisterCommand } from "../types/yargs.js";
import { throwError } from "../utils/error.js";

export const register: RegisterCommand = yargs =>
  yargs.command({
    command: "sync",
    describe: "Synchronize content model between two Kontent.ai environments",
    builder: yargs =>
      yargs
        .option("environmentId", {
          type: "string",
          describe: "Id of the target Kontent.ai environment.",
          demandOption: "You need to provide the environmentId of your Kontent.ai environment",
          alias: "e",
        })
        .option("apiKey", {
          type: "string",
          describe: "Management API key of target Kontent.ai environment",
          demandOption: "You need to provide a Management API key for the given Kontent.ai environment.",
          alias: "k",
        })
        .option("folderName", {
          type: "string",
          describe: "Name of the folder containing source content model",
          alias: "f",
          conflicts: ["sourceApiKey", "sourceEnvironmentId"],
        })
        .option("sourceEnvironmentId", {
          type: "string",
          describe: "Id of Kontent.ai environmnent containing source content model",
          conflicts: "folderName",
          implies: ["sourceApiKey"],
        })
        .option("sourceApiKey", {
          type: "string",
          describe: "Management API key of Kontent.ai environmnent containing source content model",
          conflicts: "folderName",
          implies: ["sourceEnvironmentId"],
        })
        .option("skipWarning", {
          type: "boolean",
          describe: "Skip warning message.",
          alias: "s",
        }),
    handler: args => syncContentModel(args),
  });

export type SyncParams =
  & Readonly<{
    environmentId: string;
    apiKey: string;
    folderName?: string;
    sourceEnvironmentId?: string;
    sourceApiKey?: string;
    skipWarning?: boolean;
  }>
  & LogOptions;

export const syncContentModel = async (params: SyncParams) => {
  if (params.folderName) {
    const folderErrors = await validateContentFolder(params.folderName);
    if (folderErrors.length) {
      folderErrors.forEach(e => logError(params, "standard", e));
      process.exit(1);
    }
  }

  const sourceModel = params.folderName
    ? await readContentModelFromFolder(params.folderName)
    : transformSyncModel(
      await fetchModel({
        environmentId: params.sourceEnvironmentId ?? throwError("sourceEnvironmentId should not be undefined"),
        apiKey: params.sourceApiKey ?? throwError("sourceApiKey should not be undefined"),
      }),
      params,
    );

  const targetModel = await fetchModel({ apiKey: params.apiKey, environmentId: params.environmentId });
  const assetsReferences = new Map(targetModel.assets.map(a => [a.codename, { id: a.id, codename: a.codename }]));
  const itemReferences = new Map(targetModel.items.map(i => [i.codename, { id: i.id, codename: i.codename }]));
  const transformedTargetModel = transformSyncModel(targetModel, params);

  const modelErrors = await validateContentModel(sourceModel, transformedTargetModel);
  if (modelErrors.length) {
    modelErrors.forEach(e => logError(params, "standard", e));
    process.exit(1);
  }

  const diffModel = diff({
    targetAssetsReferencedFromSourceByCodenames: assetsReferences,
    targetItemsReferencedFromSourceByCodenames: itemReferences,
    targetEnvModel: transformedTargetModel,
    sourceEnvModel: sourceModel,
  });

  printDiff(diffModel, params);

  const warningMessage = chalk.yellow(
    `⚠ Running this operation may result in irreversible changes to the content in environment ${params.environmentId}.\n\nOK to proceed y/n? (suppress this message with -s parameter)\n`,
  );

  const confirmed = !params.skipWarning ? await requestConfirmation(warningMessage) : true;

  if (!confirmed) {
    logError(params, chalk.red("Operation aborted."));
    process.exit(1);
  }
};