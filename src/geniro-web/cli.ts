import rdf from "@rdfjs/data-model";
import { parseArgs } from "@std/cli/parse-args";
import * as builder from "rdf-sparql-builder";
import * as oaiPmh from "./fetcher/oai-pmh.ts";
import * as link from "./fetcher/link.ts";
import { databaseEndpoint, mainRdfNamespace } from "./config.ts";
import * as sparql from "./data/sparql.ts";
import { foaf, geniro, org, rdf as rdfns } from "./data/model.ts";

const fetchOaiPmh = async (baseUrl, baseSet, grantorName, grantorUri) => {
    const records = await Array.fromAsync(
        oaiPmh.fetchRecords(baseUrl, baseSet, grantorUri),
    );
    records.push([grantorUri, rdfns.type, org.Organization]);
    records.push([grantorUri, foaf.name, grantorName]);

    await sparql.update(
        databaseEndpoint,
        builder.insertData(records),
    );
};

const fixUnidentified = async () => {
    for (const type of [foaf.Person, geniro.Project]) {
        for (const item of await link.findUnidentified(type)) {
            const preferredUri = await link.addPreferredUri(type, item);
            console.log(`Added preferred URI ${preferredUri.value} to ${item.value}`);
        }
    }
};

const main = async () => {
    if (Deno.args.length < 1) {
        console.error("available commands: fetch, fix-unidentified");
        return;
    }

    switch (Deno.args[0]) {
        case "fetch":
            await fetchOaiPmh(
                new URL("https://umontreal.scholaris.ca/server/oai/request"),
                "col_1866_3001",
                rdf.literal("Département d’informatique et de recherche opérationnelle"),
                rdf.namedNode(`${mainRdfNamespace}/org/diro`),
            );
            break;

        case "fix-unidentified":
            await fixUnidentified();
            break;

        default:
            console.error(`unknown command ${Deno.args[0]}`);
    }
};

await main();
