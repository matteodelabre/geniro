import rdf from "@rdfjs/data-model";
import * as builder from "rdf-sparql-builder";
import Aggregate from "rdf-sparql-builder/lib/Aggregate.js";
import { foaf, geniro, owl, rdf as rdfns } from "./model.ts";
import { onto, query } from "./sparql.ts";
import { mainRdfNamespace, databaseEndpoint } from "../config.ts";

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

        for (const [key, name] of [
            [studentKey, edge.studentNameUnique.value],
            [advisorKey, edge.advisorNameUnique.value],
        ]) {
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
