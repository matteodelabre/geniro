import rdf from "@rdfjs/data-model";
import * as builder from "rdf-sparql-builder";
import { foaf, geniro, owl, rdf as rdfns } from "./model.ts";
import { onto, query } from "./sparql.ts";
import { databaseEndpoint } from "../config.ts";

const sameAsClosure = builder.zeroOrMore(
    builder.alternative([
        owl.sameAs,
        builder.inverse(owl.sameAs),
    ]),
);

export const triplesByAlias = async (entity: rdf.NamedNode) => {
    const alias = rdf.variable("alias");
    const subject = rdf.variable("subject");
    const predicate = rdf.variable("predicate");
    const object = rdf.variable("object");

    const bindings = await query(
        databaseEndpoint,
        builder.select([subject, predicate, object, alias])
            .from(onto.explicit)
            .where([
                builder.union([
                    [
                        [subject, predicate, alias],
                        [entity, sameAsClosure, alias],
                    ],
                    [
                        [alias, predicate, object],
                        [entity, sameAsClosure, alias],
                    ],
                ]),
                builder.filter([builder.ne(predicate, owl.sameAs)]),
            ]),
    );

    const aliases = {};

    for (const binding of bindings) {
        const alias = binding.alias.value;

        if (!(alias in aliases)) {
            aliases[alias] = [];
        }

        if ("subject" in binding) {
            aliases[alias].push([
                binding.subject,
                binding.predicate,
                binding.alias,
            ]);
        } else {
            aliases[alias].push([
                binding.alias,
                binding.predicate,
                binding.object,
            ]);
        }
    }

    return aliases;
};

export const descendants = async (person: rdf.NamedNode) => {
    const descendant = rdf.variable("descendant");
    const project = rdf.variable("project");
    const student = rdf.variable("student");
    const projectEndDate = rdf.variable("projectEndDate");

    return await query(
        databaseEndpoint,
        builder.select([descendant, student, projectEndDate])
            .distinct()
            .from(onto["disable-sameAs"])
            .where([
                [
                    person,
                    `(^<${geniro.advisor.value}>/<${geniro.student.value}>)*`,
                    descendant,
                ],
                [project, geniro.advisor, descendant],
                [project, geniro.student, student],
                [project, geniro.dateEnd, projectEndDate],
            ])
            .orderBy([projectEndDate]),
    );
};

export const search = async (terms: string) => {
    const uri = rdf.variable("uri");
    const match = rdf.variable("match");
    const termsLiteral = rdf.literal(terms);

    const results = await query(
        databaseEndpoint,
        builder.select([uri])
            .distinct()
            .from(onto["disable-sameAs"])
            .where([
                [uri, foaf.name, match],
                [uri, rdfns.type, foaf.Person],
                [match, onto.fts, termsLiteral],
            ]),
    );

    return results.map((binding) => binding.uri);
};
