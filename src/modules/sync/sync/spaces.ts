import { ManagementClient, SpaceModels } from "@kontent-ai/management-sdk";
import { match, P } from "ts-pattern";

import { logInfo, LogOptions } from "../../../log.js";
import { throwError } from "../../../utils/error.js";
import { serially } from "../../../utils/requests.js";
import { DiffModel } from "../types/diffModel.js";
import { PatchOperation } from "../types/patchOperation.js";

export const syncSpaces = async (
  client: ManagementClient,
  model: DiffModel["spaces"],
  logOptions: LogOptions,
) => {
  logInfo(logOptions, "standard", "Adding new spaces");

  await serially(model.added.map(space => () =>
    client
      .addSpace()
      .withData(space as SpaceModels.IAddSpaceData)
      .toPromise()
  ));

  logInfo(logOptions, "standard", "Updating spaces");

  await serially([...model.updated].map(([spaceCodename, operations]) => () =>
    client
      .modifySpace()
      .bySpaceCodename(spaceCodename)
      .withData(operations.map(convertOperation))
      .toPromise()
  ));

  logInfo(logOptions, "standard", "Removing spaces");

  await serially([...model.deleted].map(spaceCodename => () =>
    client
      .deleteSpace()
      .bySpaceCodename(spaceCodename)
      .toPromise()
  ));
};

const convertOperation = (operation: PatchOperation): SpaceModels.IModifySpaceData =>
  match(operation)
    .with({ op: "replace" }, op =>
      match(op.path.split("/").pop())
        .with(
          P.union("name", "web_spotlight_root_item", "collections"),
          pName => ({ op: "replace", property_name: pName, value: op.value as any }) as const,
        )
        .otherwise(() =>
          throwError(`Patch operation "${JSON.stringify(op)}" has missing or invalid property name in path.`)
        ))
    .with({ op: P.union("addInto", "remove", "move") }, () =>
      throwError(`Patch operation "${operation.op}" is not supported for spaces.`))
    .exhaustive();