#!/usr/bin/env node

import type Dataset from "@triply/triplydb/Dataset.js";
import * as dotenv from "dotenv";
import fs from "node:fs/promises";
import { inspect } from "node:util";
import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import { AppProxy, TRIPLYDB_TOKEN } from "./app.js";
dotenv.config();

async function cli() {
  await yargs(hideBin(process.argv))
    .scriptName("triplydb-update")
    .option("token", {
      alias: "t",
      desc: `TriplyDB token (default: $${TRIPLYDB_TOKEN})`,
      type: "string",
    })
    .command(
      "dataset <DATASET> update <FILES...>",
      "Update graph contents of a dataset",
      (yargs) =>
        yargs
          .positional("DATASET", { type: "string", desc: "[account/]dataset" })
          .positional("FILES", { type: "string", desc: "Input files" })
          .array("FILES")
          .option("create", { type: "boolean", desc: "Create dataset if not existent" })
          .option("base", { type: "string", desc: "Base IRI" })
          .option("default-graph", { type: "string", desc: "Use e.g. with NTriples" })
          .option("mode", {
            type: "string",
            choices: ["overwrite", "rename", "merge"],
            default: "rename",
            desc: "Resolve when graph name already exists",
          })
          .option("update-services", {
            type: "boolean",
            desc: "Update dependent services",
            default: true,
          }),
      async (argv) => {
        const proxy = new AppProxy(argv.token);
        let dataset: Dataset;
        const [account, datasetName] = await proxy.qualifiedName(argv.DATASET);
        if (argv.create)
          dataset = await account.ensureDataset(datasetName, { accessLevel: "private" });
        else dataset = await account.getDataset(datasetName);

        console.info(`Uploading...`);
        await dataset.importFromFiles(argv.FILES, {
          baseIRI: argv.base,
          defaultGraphName: argv.defaultGraph,
          overwriteAll: argv.mode === "overwrite",
          mergeGraphs: argv.mode === "merge",
        });

        const appInfo = await proxy.triplyApp.getInfo();
        const info = await dataset.getInfo();
        console.info(`Upload DONE: <${appInfo.consoleUrl}/${info.owner.accountName}/${info.name}>`);

        if (argv.updateServices)
          for await (const service of dataset.getServices()) {
            const serviceInfo = await service.getInfo();
            if (!(await service.isUpToDate())) await service.update();
            console.log(`Service UPDATED: ${serviceInfo.name}`);
          }
      },
    )
    .command(
      "query <QUERY> update <FILE>",
      "Replace a prepared query",
      (yargs) =>
        yargs
          .positional("QUERY", { type: "string", desc: "SPARQL query" })
          .positional("FILE", { type: "string", desc: "Input file" })
          .option("create", { type: "boolean", desc: "Create if not existent" }),
      async (argv) => {
        const proxy = new AppProxy(argv.token);
        const [account, queryName] = await proxy.qualifiedName(argv.QUERY);
        const query = await account.getQuery(queryName);

        const queryString = await fs.readFile(argv.FILE, { encoding: "utf-8" });
        await query.addVersion({ queryString });

        const appInfo = await proxy.triplyApp.getInfo();
        const info = await query.getInfo();
        console.info(
          `Updated query string: <${appInfo.consoleUrl}/${info.owner.accountName}/-/queries/${info.name}>`,
        );
      },
    )
    .command(
      "info",
      "About the current instance",
      (yargs) => yargs.option("verbose", { alias: "v", desc: "Report more information" }),
      async (yargs) => {
        const app = new AppProxy(yargs.token).triplyApp;
        const info = await app.getInfo();
        if (yargs.verbose) console.log(inspect(info));
        else
          console.log(
            `Access '${info.branding.name}' at <${info.consoleUrl}>\n` +
              `Endpoint: <${info.apiUrl}>.`,
          );
      },
    )
    .demandCommand()
    .help()
    .usage("Interact with the TriplyDB API")
    .parse();
}

void cli();
