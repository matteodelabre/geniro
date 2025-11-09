import rdf from "@rdfjs/data-model";
import * as builder from "rdf-sparql-builder";
import Aggregate from "rdf-sparql-builder/lib/Aggregate.js";
import { dcterms, foaf, geniro, owl, rdf as rdfns } from "./model.ts";
import { onto, query } from "./sparql.ts";
import { databaseEndpoint, mainRdfNamespace } from "../config.ts";

const builderSample = (variable, as) => new Aggregate("SAMPLE", variable, as);

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

/**
 * Retrieve information about the descendants of a given person.
 *
 * A child of a person A is a person B who was a student in at least one project that A
 * advised. The descendance relation is the reflexive transitive closure of this child
 * relation, i.e., the descendants of A are A, the children of A, the children of its
 * children, etc.
 *
 * @param person - URI for the person whose descendance is to be retrieved
 */
export const descendants = async (person: rdf.NamedNode): Promise<> => {
    const advisor = rdf.variable("advisor");
    const student = rdf.variable("student");
    const advisorName = rdf.variable("advisorName");
    const advisorNameUnique = rdf.variable("advisorNameUnique");
    const studentName = rdf.variable("studentName");
    const studentNameUnique = rdf.variable("studentNameUnique");
    const project = rdf.variable("project");
    const degree = rdf.variable("degree");
    const projectEndDate = rdf.variable("projectEndDate");

    const edges = await query(
        databaseEndpoint,
        builder.select([
            project,
            advisor,
            student,
            degree,
            projectEndDate,
            builderSample(advisorName, advisorNameUnique),
            builderSample(studentName, studentNameUnique),
        ])
            .where([
                builder.filter([
                    `STRSTARTS(STR(?advisor), "${mainRdfNamespace}/person/")`,
                    `STRSTARTS(STR(?student), "${mainRdfNamespace}/person/")`,
                ]),
                [
                    person,
                    `(^<${geniro.advisor.value}>/<${geniro.student.value}>)*`,
                    student,
                ],
                [project, geniro.advisor, advisor],
                [project, geniro.student, student],
                [advisor, foaf.name, advisorName],
                [student, foaf.name, studentName],
                [project, geniro.degree, degree],
                [project, geniro.dateEnd, projectEndDate],
            ])
            .groupBy([project, advisor, student, degree, projectEndDate])
            .orderBy([projectEndDate]),
    );

    const index = {};

    for (const edge of edges) {
        const studentKey = edge.student.value;
        const advisorKey = edge.advisor.value;
        const projectKey = edge.project.value;

        for (
            const [key, name] of [
                [studentKey, edge.studentNameUnique.value],
                [advisorKey, edge.advisorNameUnique.value],
            ]
        ) {
            if (!(key in index)) {
                index[key] = {
                    "name": name,
                    "projects": {},
                };
            }
        }

        if (!(projectKey in index[studentKey].projects)) {
            index[studentKey].projects[projectKey] = {
                "degree": edge.degree.value,
                "dateEnd": edge.projectEndDate.value,
                "advisors": [],
            };
        }

        index[studentKey].projects[projectKey].advisors.push(advisorKey);
    }

    return index;
};

/**
 * Search for persons or projects whose name or title match a given set of terms.
 *
 * @param terms - Search terms
 */
export const search = async (terms: string): Promise<array> => {
    const entity = rdf.variable("entity");
    const label = rdf.variable("label");
    const firstName = rdf.variable("firstName");
    const lastName = rdf.variable("lastName");
    const title = rdf.variable("title");
    const uri = rdf.variable("uri");
    const termsLiteral = rdf.literal(terms);

    const triples = await query(
        databaseEndpoint,
        builder.select([uri, label])
            .distinct()
            .where([
                builder.union([
                    // Search for persons
                    [
                        [entity, rdfns.type, foaf.Person],
                        builder.optional([[entity, foaf.firstName, firstName]]),
                        builder.optional([[entity, foaf.lastName, lastName]]),
                        builder.union([
                            [
                                [entity, foaf.firstName, firstName],
                                [firstName, onto.fts, termsLiteral],
                            ],
                            [
                                [entity, foaf.lastName, lastName],
                                [lastName, onto.fts, termsLiteral],
                            ],
                        ]),
                        builder.bind(label, "CONCAT(?firstName, ' ', ?lastName)"),
                    ],

                    // Search for projects
                    [
                        [entity, rdfns.type, geniro.Project],
                        [entity, dcterms.title, title],
                        [title, onto.fts, termsLiteral],
                        builder.bind(label, "?title"),
                    ],
                ]),
                [entity, geniro.preferredUri, uri],
            ]),
    );

    return triples.map(({ uri, label }) => ({
        uri: uri.value,
        label: label.value,
    }));
};
