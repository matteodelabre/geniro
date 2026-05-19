import { query, update } from "../data/sparql.ts";
import { databaseEndpoint } from "../config.ts";
import * as builder from "../data/builder.ts";
import { foaf, geniro, rdf as rdfns, owl } from "../data/model.ts";
import rdf from "@rdfjs/data-model";

/** Remove all triples whose object is marked as expired in the given namespace. */
export const clearExpiredMirrors = async (namespace: string) => {
    const mirror = rdf.variable("mirror");
    const subject = rdf.variable("subject");
    const subjectUri = rdf.variable("subjectUri");
    const predicate = rdf.variable("predicate");
    const object = rdf.variable("object");
    const expires = rdf.variable("expires");

    await update(
        databaseEndpoint,
        builder.delete([[subject, predicate, object]])
            .where([
                [mirror, rdfns.type, geniro.Mirror],
                [mirror, geniro.entity, subjectUri],
                [mirror, geniro.expires, expires],
                builder.bind(subject, `URI(?${subjectUri.value})`),
                builder.filter([
                    builder.lt(expires, "NOW()"),
                    `STRSTARTS(STR(?${mirror.value}), "${namespace}")`,
                ]),
            ]),
    );
};

/** Find all mirrors that have expired or not been populated in the given namespace. */
export const findExpiredMirrors = async (namespace: string) => {
    const mirror = rdf.variable("mirror");
    const expires = rdf.variable("expires");

    const results = await query(
        databaseEndpoint,
        builder
            .select([mirror])
            .distinct()
            .where([
                [mirror, rdfns.type, geniro.Mirror],
                builder.optional([[mirror, geniro.expires, expires]]),
                builder.filter([
                    builder.lt(
                        `
                        COALESCE(
                            ?${expires.value},
                            "1970-01-01T00:00:00Z"^^xsd:dateTime
                        )
                        `,
                        "NOW()",
                    ),
                    `STRSTARTS(STR(?${mirror.value}), "${namespace}")`,
                ]),
            ]),
    );

    return results.map(({ mirror }) => mirror);
};

/** Find all entities under a given namespace that lack a mirror. */
export const findUnmirrored = async (namespace: string) => {
    const subject = rdf.variable("subject");
    const entity = rdf.variable("entity");
    const entityUri = rdf.variable("entityUri");
    const mirror = rdf.variable("mirror");

    const results = await query(
        databaseEndpoint,
        builder
            .select([entity])
            .distinct()
            .where([
                [subject, owl.sameAs, entity],
                builder.bind(entityUri, `STR(?${entity.value})`),
                builder.filter([
                    `STRSTARTS(?${entityUri.value}, "${namespace}")`,
                    builder.notExists([
                        [mirror, geniro.entity, entityUri],
                        [mirror, rdfns.type, geniro.Mirror],
                    ])
                ]),
            ])
    );

    return results.map(({ entity }) => entity);
};
