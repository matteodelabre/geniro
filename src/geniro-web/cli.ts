import rdfModel from "@rdfjs/data-model";
import * as builder from "rdf-sparql-builder";
import * as oaiPmh from "./fetcher/oai-pmh.ts";
import { databaseEndpoint, mainRdfNamespace } from "./config.ts";
import * as sparql from "./data/sparql.ts";
import { foaf, org, rdf } from "./data/model.ts";

const baseUrl = new URL("https://umontreal.scholaris.ca/server/oai/request");
const baseSet = "col_1866_3001";

const diroUri = rdfModel.namedNode(`${mainRdfNamespace}/org/diro`);
const records = await Array.fromAsync(oaiPmh.fetchRecords(baseUrl, baseSet, diroUri));

records.push([diroUri, rdf.type, org.Organization]);
records.push([
    diroUri,
    foaf.name,
    rdfModel.literal("Département d’informatique et de recherche opérationnelle"),
]);

await sparql.update(
    databaseEndpoint,
    builder.insertData(records),
);
