import rdf from "@rdfjs/data-model";
import * as builder from "rdf-sparql-builder";
import Aggregate from "rdf-sparql-builder/lib/Aggregate.js";
import { dcterms, foaf, geniro, org, owl, rdf as rdfns, time, skos } from "./model.ts";
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
 * Retrieve edges of the genealogy graph, optionally starting from a root person.
 *
 * A child of a person A is a person B who was a student in at least one project that A
 * advised. The descendance relation is the reflexive transitive closure of this child
 * relation, i.e., the descendants of A are A, the children of A, the children of its
 * children, etc.
 *
 * @param fromRoot - URI for the person whose descendance is to be retrieved, or null to
 * retrieve edges for the entire graph.
 */
export const graph = async (fromRoot?: rdf.NamedNode = null): Promise<> => {
    const project = rdf.variable("project");
    const projectUri = rdf.variable("projectUri");
    const projectType = rdf.variable("projectType");
    const projectEndDate = rdf.variable("projectEndDate");

    const student = rdf.variable("student");
    const studentUri = rdf.variable("studentUri");
    const studentFirstName = rdf.variable("studentFirstName");
    const studentLastName = rdf.variable("studentLastName");

    const advisor = rdf.variable("advisor");
    const advisorUri = rdf.variable("advisorUri");
    const advisorFirstName = rdf.variable("advisorFirstName");
    const advisorLastName = rdf.variable("advisorLastName");

    const conditions = [
        [project, geniro.student, student],
        [project, geniro.advisor, advisor],
        [project, rdfns.type, projectType],
        builder.filter([
            builder.in(
                projectType,
                [geniro.PhDProject, geniro.MScProject],
            ),
        ]),
        [
            project,
            [geniro.timePeriod, time.hasEnd, time.inXSDDate],
            projectEndDate,
        ],
        [project, geniro.preferredUri, projectUri],

        [advisor, foaf.firstName, advisorFirstName],
        [advisor, foaf.lastName, advisorLastName],
        [advisor, geniro.preferredUri, advisorUri],

        [student, foaf.firstName, studentFirstName],
        [student, foaf.lastName, studentLastName],
        [student, geniro.preferredUri, studentUri],
    ];

    if (fromRoot !== null) {
        conditions.unshift([
            fromRoot,
            `(^<${geniro.advisor.value}>/<${geniro.student.value}>)*`,
            student,
        ]);
    }

    const edges = await query(
        databaseEndpoint,
        builder.select([
            projectUri,
            builderSample(projectType, projectType),
            builderSample(projectEndDate, projectEndDate),

            advisorUri,
            builderSample(advisorFirstName, advisorFirstName),
            builderSample(advisorLastName, advisorLastName),

            studentUri,
            builderSample(studentFirstName, studentFirstName),
            builderSample(studentLastName, studentLastName),
        ])
            .where(conditions)
            .groupBy([
                projectUri,
                advisorUri,
                studentUri,
            ])
            .orderBy([projectEndDate]),
    );

    const index = {};

    for (const edge of edges) {
        const projectKey = edge.projectUri.value;
        const studentKey = edge.studentUri.value;
        const advisorKey = edge.advisorUri.value;

        for (
            const [key, firstName, lastName] of [
                [
                    studentKey,
                    edge.studentFirstName.value,
                    edge.studentLastName.value,
                ],
                [
                    advisorKey,
                    edge.advisorFirstName.value,
                    edge.advisorLastName.value,
                ],
            ]
        ) {
            if (!(key in index)) {
                index[key] = {
                    "firstName": firstName,
                    "lastName": lastName,
                    "projects": {},
                };
            }
        }

        if (!(projectKey in index[studentKey].projects)) {
            index[studentKey].projects[projectKey] = {
                "type": edge.projectType.value,
                "dateEnd": edge.projectEndDate.value,
                "advisors": [],
            };
        }

        index[studentKey].projects[projectKey].advisors.push(advisorKey);
    }

    return index;
};

/**
 * Search for persons, projects, or organizations whose name, title or label
 * match a given set of terms.
 *
 * @param terms - Search terms
 */
export const search = async (terms: string): Promise<array> => {
    const entity = rdf.variable("entity");
    const label = rdf.variable("label");
    const firstName = rdf.variable("firstName");
    const lastName = rdf.variable("lastName");
    const uri = rdf.variable("uri");
    const termsLiteral = rdf.literal(terms);

    const triples = await query(
        databaseEndpoint,
        builder.select([uri, builderSample(label, label)])
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
                        [entity, dcterms.title, label],
                        [label, onto.fts, termsLiteral],
                    ],

                    // Search for organizations
                    [
                        [entity, rdfns.type, org.Organization],
                        [entity, skos.prefLabel, label],
                        [label, onto.fts, termsLiteral],
                    ],
                ]),
                [entity, geniro.preferredUri, uri],
            ])
            .groupBy([uri])
    );

    return triples.map(({ uri, label }) => ({
        uri: uri.value,
        label: label.value,
    }));
};
