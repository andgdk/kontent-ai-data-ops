import dotenv from 'dotenv';
import * as childProcess from "child_process";
import minimist from 'minimist';

dotenv.config();

const resolveParams = (params) => {
  const { i, s, t } = params;

  return !i && !s && !t ? { i: true, s: true, t: true } : { i, s, t };
}

const { i, s, t } = resolveParams(minimist(process.argv.slice(2)));

const { API_KEY, SYNC_SOURCE_TEST_ENVIRONMENT_ID, SYNC_TARGET_TEST_ENVIRONMENT_ID, EXPORT_IMPORT_TEST_DATA_ENVIRONMENT_ID } = process.env;

if (!EXPORT_IMPORT_TEST_DATA_ENVIRONMENT_ID) {
  throw new Error("EXPORT_IMPORT_TEST_DATA_ENVIRONMENT_ID environment variable is not defined.");
}

if (!SYNC_SOURCE_TEST_ENVIRONMENT_ID) {
  throw new Error("SYNC_SOURCE_TEST_ENVIRONMENT_ID environment variable is not defined.");
}
if (!SYNC_TARGET_TEST_ENVIRONMENT_ID) {
  throw new Error("SYNC_TARGET_TEST_ENVIRONMENT_ID environment variable is not defined.");
}

if (!API_KEY) {
  throw new Error("API_KEY environment variable is not defined.");
}

const runCommand = (command, props) => {
  return new Promise((resolve, reject) => {
    const { title, environmentId, path } = props;
    console.log(`Exporting ${title} environment ${environmentId} to ${path}`);
    childProcess.exec(`node ./build/src/index.js ${command}`, (error, stdout, stderr) => {
      if (error) {
        reject({ error, stdout, stderr });
      }

      console.log(`${title} successfully exported`);
      resolve({ stdout, stderr });
    });
  });
};
const syncSourcePath = "tests/integration/sync/data/sync_test_source.zip";
const syncTargetPath = "tests/integration/sync/data/sync_test_target.zip";
const importPath = "tests/integration/importExport/data/exportedData.zip"

const syncSourceExportCommand = `export -e=${SYNC_SOURCE_TEST_ENVIRONMENT_ID} -f=${syncSourcePath} -k=${API_KEY}`;
const syncTargetExportCommand = `export -e=${SYNC_TARGET_TEST_ENVIRONMENT_ID} -f=${syncTargetPath} -k=${API_KEY}`;
const importExportCommand = `export -e=${EXPORT_IMPORT_TEST_DATA_ENVIRONMENT_ID} -f=${importPath} -k=${API_KEY}`;

const exportCommands = [
  ...s ? [runCommand(syncSourceExportCommand, { title: "Sync Source Template test environment", environmentId: SYNC_SOURCE_TEST_ENVIRONMENT_ID, path: syncSourcePath })] : [],
  ...t ? [runCommand(syncTargetExportCommand, { title: "Sync Target Template test environment", environmentId: SYNC_TARGET_TEST_ENVIRONMENT_ID, path: syncTargetPath })] : [],
  ...i ? [runCommand(importExportCommand, { title: "Import Export test environment", environmentId: EXPORT_IMPORT_TEST_DATA_ENVIRONMENT_ID, path: importPath })] : []
]

await Promise.all(exportCommands);