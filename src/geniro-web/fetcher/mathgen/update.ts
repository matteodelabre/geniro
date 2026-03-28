import rdf from "@rdfjs/data-model";
import { foaf, geniro, rdf as rdfns } from "../../data/model.ts";
import { onto, ofn, query, update } from "../../data/sparql.ts";
import * as builder from "../../data/builder.ts";
import { databaseEndpoint, mathgenRefreshDelay } from "../../config.ts";
import { mathgenNamespace, queryPerson, processRecord } from "./api.ts";

const mergeTriples = async function* (token: string, schoolIds, persons: NamedNode[]) {
    for (const person of persons) {
        const data = await queryPerson(token, person);
        yield* processRecord(schoolIds, data);
    }
};

// TODO: clear out old records for persons to refresh
export const refresh = async (token: string, schoolIds, persons: NamedNode[]) => {
    await update(
        databaseEndpoint,
        builder.insertData(
            await Array.fromAsync(mergeTriples(token, schoolIds, persons))
        ),
    );
};

export const findExpiredPersons = async () => {
    const person = rdf.variable("person");
    const lastUpdate = rdf.variable("lastUpdate");
    const elapsedSecs = rdf.variable("elapsedSecs");

    const results = await query(
        databaseEndpoint,
        builder.select([person])
            .where([
                [person, rdfns.type, foaf.Person],
                builder.filter([
                    `strstarts(str(?${person.value}), "${mathgenNamespace}")`
                ]),
                builder.optional([[
                    person, geniro.lastUpdate, lastUpdate
                ]]),
                builder.filter([
                    `<${ofn.secondsBetween.value}>(
                        coalesce(
                            ?${lastUpdate.value},
                            "1970-01-01T00:00:00Z"^^xsd:dateTime
                        ),
                        now()
                    ) > ${mathgenRefreshDelay}`
                ])
            ]),
    );

    return results.map(({person}) => person);
};
