import { match, P } from "ts-pattern";

import { logError, LogOptions } from "../../../log.js";
import { syncEntityChoices, SyncEntityName } from "../../../modules/sync/constants/entities.js";
import { syncDiffInternal, SyncDiffParams } from "../../../modules/sync/diffEnvironments.js";
import { createAdvancedDiffFile, printDiff } from "../../../modules/sync/printDiff.js";
import { RegisterCommand } from "../../../types/yargs.js";
import { simplifyErrors } from "../../../utils/error.js";

const commandName = "diff";

export const register: RegisterCommand = yargs =>
  yargs.command({
    command: commandName,
    describe: "Compares content models from two Kontent.ai environments.",
    builder: yargs =>
      yargs
        .option("targetEnvironmentId", {
          type: "string",
          describe: "Id of the target Kontent.ai environment that should be diffed.",
          demandOption: "You need to provide the environmentId of target Kontent.ai environment.",
          alias: "t",
        })
        .option("targetApiKey", {
          type: "string",
          describe: "Management API key of target Kontent.ai environment.",
          demandOption: "You need to provide a Management API key for target Kontent.ai environment.",
          alias: "tk",
        })
        .option("folderName", {
          type: "string",
          describe: "Name of the folder containing source content model.",
          alias: "f",
          conflicts: ["sourceApiKey", "sourceEnvironmentId"],
        })
        .option("sourceEnvironmentId", {
          type: "string",
          describe: "Id of Kontent.ai environmnent containing source content model.",
          conflicts: "folderName",
          implies: ["sourceApiKey"],
          alias: "s",
        })
        .option("sourceApiKey", {
          type: "string",
          describe: "Management API key of Kontent.ai environmnent containing source content model.",
          conflicts: "folderName",
          implies: ["sourceEnvironmentId"],
          alias: "sk",
        })
        .option("advanced", {
          type: "boolean",
          describe: "Generate a detailed diff to an HTML file.",
          alias: "a",
          implies: ["outPath"],
        })
        .option("entities", {
          type: "array",
          string: true,
          choices: syncEntityChoices,
          describe: `Diff specified entties. Allowed entities are: ${syncEntityChoices.join(", ")}`,
          demandOption: "You need to provide the what entities to diff.",
        })
        .option("outPath", {
          type: "string",
          describe: "Path to the directory or file the diff will be generated into.",
          alias: "o",
          implies: ["advanced"],
        })
        .option("noOpen", {
          type: "boolean",
          describe: "Don't open the diff file automatically upon creation.",
          alias: "n",
          implies: ["advanced"],
        }),
    handler: args => diffEnvironmentsCli(args).catch(simplifyErrors),
  });

type DiffEnvironmentsCliParams =
  & Readonly<{
    targetEnvironmentId: string;
    targetApiKey: string;
    folderName?: string;
    sourceEnvironmentId?: string;
    sourceApiKey?: string;
    entities: ReadonlyArray<SyncEntityName>;
    advanced?: boolean;
    outPath?: string;
    noOpen?: boolean;
  }>
  & LogOptions;

const diffEnvironmentsCli = async (params: DiffEnvironmentsCliParams) => {
  const resolvedParams = resolveParams(params);

  const diffModel = await syncDiffInternal(resolvedParams, commandName);

  return "advanced" in params
    ? createAdvancedDiffFile({ ...diffModel, ...params })
    : printDiff(diffModel, new Set(params.entities), params);
};

const resolveParams = (params: DiffEnvironmentsCliParams): SyncDiffParams => ({
  ...match(params)
    .with(
      { sourceEnvironmentId: P.nonNullable, sourceApiKey: P.nonNullable },
      ({ sourceEnvironmentId, sourceApiKey }) => ({ ...params, sourceEnvironmentId, sourceApiKey }),
    )
    .with({ folderName: P.nonNullable }, ({ folderName }) => ({ ...params, folderName }))
    .otherwise(() => {
      logError(
        params,
        "You need to provide either 'folderName' or 'sourceEnvironmentId' with 'sourceApiKey' parameters",
      );
      process.exit(1);
    }),
});