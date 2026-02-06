import rdf from "@rdfjs/data-model";
import * as builder from "./builder.ts";
import { dcterms, foaf, geniro, org, owl, rdf as rdfns, skos, time } from "./model.ts";
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

    const type = rdf.variable("projectType");
    const dateStart = rdf.variable("dateStart");
    const dateEnd = rdf.variable("dateEnd");

    const student = rdf.variable("student");
    const studentUri = rdf.variable("studentUri");

    const advisor = rdf.variable("advisor");
    const advisorUri = rdf.variable("advisorUri");

    const conditions = [
        [project, geniro.student, student],
        [project, geniro.advisor, advisor],
        [project, rdfns.type, type],
        builder.filter([
            builder.in(
                type,
                [geniro.PhDProject, geniro.MScProject],
            ),
        ]),
        builder.optional([
            [project, [
                geniro.timePeriod,
                time.hasBeginning,
                time.inXSDDate,
            ], dateStart],
        ]),
        builder.optional([
            [project, [
                geniro.timePeriod,
                time.hasEnd,
                time.inXSDDate,
            ], dateEnd],
        ]),
        [project, geniro.preferredUri, projectUri],
        [advisor, geniro.preferredUri, advisorUri],
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
            builder.sample(type, type),
            builder.sample(dateStart, dateStart),
            builder.sample(dateEnd, dateEnd),
            advisorUri,
            studentUri,
        ])
            .where(conditions)
            .groupBy([projectUri, advisorUri, studentUri])
            .orderBy([dateEnd]),
    );

    const index = {};

    for (const edge of edges) {
        const projectKey = edge[projectUri.value].value;
        const studentKey = edge[studentUri.value].value;
        const advisorKey = edge[advisorUri.value].value;

        if (!(studentKey in index)) {
            index[studentKey] = {};
        }

        if (!(projectKey in index[studentKey])) {
            index[studentKey][projectKey] = {
                "type": edge[type.value].value,
                "dateStart": edge[dateStart.value]?.value,
                "dateEnd": edge[dateEnd.value]?.value,
                "advisors": [],
            };
        }

        index[studentKey][projectKey].advisors.push(advisorKey);
    }

    return index;
};

/**
 * Retrieve information about a set of persons.
 *
 * @param persons - Array of URIs for the persons to query.
 * @return Object indexed by the requested URIs, each entry contains the first name,
 * last name, preferred URI and affiliation list of the corresponding person.
 */
export const persons = async (persons: rdf.NamedNode[]): Promise<> => {
    const person = rdf.variable("person");
    const preferredUri = rdf.variable("preferredUri");
    const firstName = rdf.variable("firstName");
    const lastName = rdf.variable("lastName");
    const affiliation = rdf.variable("affiliation");
    const role = rdf.variable("role");
    const organization = rdf.variable("organization");
    const dateStart = rdf.variable("dateStart");
    const dateEnd = rdf.variable("dateEnd");

    const rows = await query(
        databaseEndpoint,
        builder.select([
            person,
            preferredUri,
            builder.sample(firstName, firstName),
            builder.sample(lastName, lastName),
            role,
            organization,
            dateStart,
            dateEnd,
        ])
            .where([
                builder.filter([builder.in(person, persons)]),
                [person, geniro.preferredUri, preferredUri],
                [person, foaf.firstName, firstName],
                [person, foaf.lastName, lastName],
                builder.optional([
                    [affiliation, org.member, person],
                    [affiliation, org.role, role],
                    [affiliation, org.organization, organization],
                    builder.optional([
                        [affiliation, [
                            org.memberDuring,
                            time.hasBeginning,
                            time.inXSDDate,
                        ], dateStart],
                    ]),
                    builder.optional([
                        [affiliation, [
                            org.memberDuring,
                            time.hasEnd,
                            time.inXSDDate,
                        ], dateEnd],
                    ]),
                ]),
            ])
            .groupBy([person, preferredUri, role, organization, dateStart, dateEnd]),
    );

    const results = {};

    for (const row of rows) {
        const key = row[person.value].value;

        if (!(key in results)) {
            results[key] = {
                preferredUri: row[preferredUri.value].value,
                firstName: row[firstName.value].value,
                lastName: row[lastName.value].value,
                affiliations: [],
            };
        }

        if (role.value in row && organization.value in row) {
            results[key].affiliations.push({
                role: row[role.value].value,
                organization: row[organization.value].value,
                dateStart: row[dateStart.value]?.value,
                dateEnd: row[dateEnd.value]?.value,
            });
        }
    }

    return results;
};

/**
 * Retrieve information about a set of projects.
 *
 * @param args.advisors - Persons who advised on this project.
 * @param args.student - Student who worked on this psoject.
 *
 * -- TODO
 * @return Object indexed by the requested URIs, each entry contains the first name,
 * last name, preferred URI and affiliation list of the corresponding person.
 */
export const projects = async ({
    advisors, //: rdf.NamedNode[]?,
    student, //: rdf.NamedNode?,
}): Promise<> => {
    const project = rdf.variable("project");
    const preferredUri = rdf.variable("preferredUri");
    const type = rdf.variable("type");
    const title = rdf.variable("title");
    const grantedBy = rdf.variable("grantedBy");
    const thesis = rdf.variable("thesis");
    const dateStart = rdf.variable("dateStart");
    const dateEnd = rdf.variable("dateEnd");

    const advisorsConditions = advisors !== undefined
        ? advisors.map((advisor) => [project, geniro.advisor, advisor])
        : [];

    const studentConditions = student !== undefined
        ? [[project, geniro.student, student]]
        : [];

    const rows = await query(
        databaseEndpoint,
        builder.select([
            preferredUri,
            type,
            title,
            grantedBy,
            thesis,
            dateStart,
            dateEnd,
        ])
            .where([
                ...advisorsConditions,
                ...studentConditions,
                [project, rdfns.type, type],
                [project, geniro.preferredUri, preferredUri],
                builder.filter([
                    builder.in(
                        type,
                        [geniro.PhDProject, geniro.MScProject],
                    ),
                ]),
                [project, dcterms.title, title],
                [project, geniro.grantedBy, grantedBy],
                [project, geniro.thesis, thesis],
                builder.optional([
                    [project, [
                        geniro.timePeriod,
                        time.hasBeginning,
                        time.inXSDDate,
                    ], dateStart],
                ]),
                builder.optional([
                    [project, [
                        geniro.timePeriod,
                        time.hasEnd,
                        time.inXSDDate,
                    ], dateEnd],
                ]),
            ])
            .groupBy([preferredUri, type, title, grantedBy, thesis, dateStart, dateEnd])
            .orderBy([[dateEnd, "DESC"]]),
    );

    const results = {};

    for (const row of rows) {
        const key = row[preferredUri.value].value;

        if (!(key in results)) {
            results[key] = {
                preferredUri: row[preferredUri.value].value,
                type: row[type.value].value,
                title: row[title.value].value,
                grantedBy: row[grantedBy.value].value,
                thesis: row[thesis.value].value,
                dateStart: row[dateStart.value]?.value,
                dateEnd: row[dateEnd.value]?.value,
            };
        }
    }

    return results;
};

/**
 * Extract membership information for a given organization.
 *
 * @param item - URI of the organization to query
 */
export const timeline = async function* (item: rdf.NamedNode): Promise<> {
    const person = rdf.variable("person");
    const membership = rdf.variable("membership");
    const personUri = rdf.variable("personUri");
    const firstName = rdf.variable("firstName");
    const lastName = rdf.variable("lastName");
    const role = rdf.variable("role");
    const dateStart = rdf.variable("dateStart");
    const dateEnd = rdf.variable("dateEnd");

    const rows = await query(
        databaseEndpoint,
        builder.select([
            personUri,
            builder.sample(firstName),
            builder.sample(lastName),
            role,
            dateStart,
            dateEnd,
        ])
            .where([
                [membership, org.organization, item],
                [membership, org.member, person],
                [person, geniro.preferredUri, personUri],
                [person, foaf.firstName, firstName],
                [person, foaf.lastName, lastName],
                [membership, org.role, role],
                builder.optional([
                    [membership, [
                        org.memberDuring,
                        time.hasBeginning,
                        time.inXSDDate,
                    ], dateStart],
                ]),
                builder.optional([
                    [membership, [
                        org.memberDuring,
                        time.hasEnd,
                        time.inXSDDate,
                    ], dateEnd],
                ]),
            ])
            .groupBy([personUri, role, dateStart, dateEnd])
            .orderBy([role, dateStart]),
    );

    for (const row of rows) {
        yield {
            personUri: row.personUri.value,
            firstName: row.firstName.value,
            lastName: row.lastName.value,
            role: row.role.value,
            dateStart: row.dateStart?.value,
            dateEnd: row.dateEnd?.value,
        };
    }
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
        builder.select([uri, builder.sample(label, label)])
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
            .groupBy([uri]),
    );

    return triples.map(({ uri, label }) => ({
        uri: uri.value,
        label: label.value,
    }));
};
