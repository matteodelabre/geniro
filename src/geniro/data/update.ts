import rdf from "@rdfjs/data-model";
import * as builder from "./builder.ts";
import * as sparql from "./sparql.ts";
import { geniro, owl, rdf as rdfns } from "./model.ts";
import { databaseEndpoint } from "../config.ts";

/**
 * Merge the triples relating two entities together.
 *
 * All triples where `source` is the object are transformed into to triples where
 * `target` is the object. Triples for the `preferredUri` predicate are not copied over
 * and are deleted.
 *
 * This operation only works if `source` and `target` share a common type.
 *
 * @param target - Entity into which to merge the triples.
 * @param source - Entity from which to move the triples.
 */
export const merge = async (target: rdf.NamedNode, source: rdf.NamedNode) => {
    const pred = rdf.variable("pred");
    const object = rdf.variable("object");
    const type = rdf.variable("type");

    await sparql.update(
        databaseEndpoint,
        builder.delete([[source, pred, object]])
            .insert([[target, pred, object]])
            .where([
                [source, pred, object],

                // require that both entities have the same type
                [source, rdfns.type, type],
                [target, rdfns.type, type],
            ])
            .filter([
                // do not transfer the preferredUri triple
                builder.ne(pred, geniro.preferredUri),

                // do not transfer old sameAs relations
                `!(?pred = <${owl.sameAs.value}> && ?object = <${source.value}>)`,
            ]),
    );

    // remove any leftover triples in the source
    await sparql.update(
        databaseEndpoint,
        builder.delete([[source, pred, object]])
            .where([[source, pred, object]]),
    );
};

/**
 * Add aliases to a given entity.
 *
 * @param entity - Entity to which the aliases should be added.
 * @param aliases - Aliases to add.
 */
export const addAliases = async (entity: rdf.NamedNode, aliases: rdf.NamedNode[]) => {
    await sparql.update(
        databaseEndpoint,
        builder.insertData(aliases.map((alias) => [entity, owl.sameAs, alias])),
    );
};

/**
 * Remove aliases from a given entity.
 *
 * @param entity - Entity from which the aliases should be removed.
 * @param aliases - Aliases to remove.
 */
export const removeAliases = async (entity: rdf.NamedNode, aliases: rdf.NamedNode[]) => {
    await sparql.update(
        databaseEndpoint,
        builder.deleteData(
            aliases.flatMap((alias) => [
                [entity, owl.sameAs, alias],
                [alias, owl.sameAs, entity],
            ]),
        ),
    );
};
