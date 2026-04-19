import rdf from "@rdfjs/data-model";
import { databaseEndpoint } from "../../config.ts";
import { clearExpiredMirrors, findExpiredMirrors, findUnmirrored } from "../mirrors.ts";
import { extractMirrorId, makePersonUri, mathgenNamespace, mathgenMirrorNamespace } from "./model.ts";
import { processRecord, queryPerson } from "./api.ts";
import { update } from "../../data/sparql.ts";
import * as builder from "../../data/builder.ts";

export const refresh = async (token: string, schoolIds) => {
    let updated = true;

    // Repeat until stability since each data pull may create new unmirrored persons
    while (updated) {
        updated = false;

        // Find entities that still lack a mirror.
        const missing = await findUnmirrored(mathgenNamespace);

        if (missing.length > 0) {
            let allTriples = [];

            for (const person of missing) {
                const data = await queryPerson(token, person);
                const triples = await Array.fromAsync(processRecord(schoolIds, data));
                allTriples = allTriples.concat(triples);
            }

            await update(databaseEndpoint, builder.insertData(allTriples));
            updated = true;
        }

        // Refresh existing mirrors
        const pending = await findExpiredMirrors(mathgenMirrorNamespace);

        if (pending.length > 0) {
            // Retrieve updated triples first
            let allTriples = [];

            for (const mirror of pending) {
                const id = extractMirrorId(mirror);
                const person = makePersonUri(id);
                const data = await queryPerson(token, person);
                const triples = await Array.fromAsync(processRecord(schoolIds, data));
                allTriples = allTriples.concat(triples);
            }

            // Clear out old triples only after the new triples have been retrieved
            await clearExpiredMirrors(mathgenMirrorNamespace);

            // Commit updated triples
            await update(databaseEndpoint, builder.insertData(allTriples));
            updated = true;
        }
    }
};
