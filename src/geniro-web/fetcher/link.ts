import rdf from "@rdfjs/data-model";
import * as builder from "../data/builder.ts";
import {
    foaf,
    geniro,
    getOrganizationURI,
    getPersonURI,
    getProjectURI,
    org,
    owl,
    rdf as rdfns,
    skos,
    time,
} from "../data/model.ts";
import * as sparql from "../data/sparql.ts";
import { databaseEndpoint } from "../config.ts";
import * as names from "./names.ts";

/**
 * Retrieve all entities of a given type without preferred URIs.
 *
 * @param type - entity class
 * @returns list of unidentified entities
 */
export const findUnidentified = async (type) => {
    const item = rdf.variable("item");
    const uri = rdf.variable("uri");

    const rows = await sparql.query(
        databaseEndpoint,
        builder.select([item])
            .from(sparql.onto["disable-sameAs"])
            .where([
                [item, rdfns.type, type],
                "filter not exists {",
                [item, geniro.preferredUri, uri],
                "}",
            ]),
    );

    return rows.map((row) => row.item);
};

const makePersonId = async (item, index) => {
    const firstName = rdf.variable("firstName");
    const lastName = rdf.variable("lastName");
    const name = rdf.variable("name");

    const rows = await sparql.query(
        databaseEndpoint,
        builder.select([firstName, lastName, name])
            .from(sparql.onto["disable-sameAs"])
            .where([
                builder.union([
                    [
                        [item, foaf.firstName, firstName],
                        [item, foaf.lastName, lastName],
                    ],
                    [[item, foaf.name, name]],
                ]),
            ]),
    );

    if (rows.length === 0) {
        throw new Error("no such person");
    }

    const row = rows[0];
    const personName = row.name
        ? row.name.value
        : `${row.firstName.value} ${row.lastName.value}`;

    const stem = names.normalize(personName);

    if (index !== 0) {
        return `${stem}-${index}`;
    }

    return stem;
};

const makeProjectId = async (item, index) => {
    const student = rdf.variable("student");
    const dateEnd = rdf.variable("dateEnd");
    const firstName = rdf.variable("firstName");
    const lastName = rdf.variable("lastName");
    const name = rdf.variable("name");

    const rows = await sparql.query(
        databaseEndpoint,
        builder.select([student, dateEnd, firstName, lastName, name])
            .from(sparql.onto["disable-sameAs"])
            .where([
                [item, geniro.student, student],
                builder.optional([
                    [item, [geniro.timePeriod, time.hasEnd, time.inXSDDate], dateEnd],
                ]),
                builder.union([
                    [
                        [student, foaf.firstName, firstName],
                        [student, foaf.lastName, lastName],
                    ],
                    [[student, foaf.name, name]],
                ]),
            ]),
    );

    if (rows.length === 0) {
        throw new Error("no such project");
    }

    const row = rows[0];
    const studentName = row.name
        ? row.name.value
        : `${row.firstName.value} ${row.lastName.value}`;

    const year = "dateEnd" in row
        ? new Date(row.dateEnd.value).getUTCFullYear().toString()
        : "unknown"

    const stem = `${names.normalize(studentName)}-${year}`;

    if (index !== 0) {
        return `${stem}-${index}`;
    }

    return stem;
};

const makeOrganizationId = async (item, index) => {
    const label = rdf.variable("label");

    const rows = await sparql.query(
        databaseEndpoint,
        builder.select([label])
            .from(sparql.onto["disable-sameAs"])
            .where([
                builder.union([
                    [[item, skos.altLabel, label]],
                    [[item, skos.prefLabel, label]],
                ]),
            ]),
    );

    if (rows.length === 0) {
        throw new Error("no such organization");
    }

    const row = rows[0];
    const stem = names.normalize(row.label.value);

    if (index !== 0) {
        return `${stem}-${index}`;
    }

    return stem;
};

/**
 * Create a preferred URI.
 *
 * Note: The created URI may already be in use in case of homonyms. The caller must
 * ensure that this is not the case before using it to identify a new object.
 *
 * @param type - object class
 * @param item - one of the URIs of the object
 * @param index - serial identifier to distinguish homonyms
 * @returns minted URI
 */
export const makeUri = async (type, item, index: number) => {
    switch (type) {
        case foaf.Person:
            return getPersonURI(await makePersonId(item, index));

        case geniro.Project:
            return getProjectURI(await makeProjectId(item, index));

        case org.Organization:
            return getOrganizationURI(await makeOrganizationId(item, index));

        default:
            throw new Error("unknown object type");
    }
};

/**
 * Add a preferred URI to an object if it is missing one.
 *
 * @param type - object class
 * @param item - one of the URIs of the object
 * @returns new or existing preferred URI
 */
export const addPreferredUri = async (type, item) => {
    let preferredUri =
        (await sparql.getObjects(databaseEndpoint, item, geniro.preferredUri))[0];
    let index = 0;

    while (!preferredUri) {
        preferredUri = await makeUri(type, item, index);
        const preferredUriLiteral = rdf.literal(preferredUri.value);

        const subject = rdf.variable("subject");
        const object = rdf.variable("object");

        const statements = [
            [preferredUri, geniro.preferredUri, preferredUriLiteral],
        ];

        // Add equivalence statement to the preferred URI when it is different
        if (preferredUri.value !== item.value) {
            statements.push([preferredUri, owl.sameAs, item]);
        }

        // Use the minted URI as the preferred URI, unless it is already used by another
        // entity or if the item received a preferred URI in the mean time
        await sparql.update(
            databaseEndpoint,
            builder.insert(statements)
                .where([
                    "filter not exists {",
                    [subject, geniro.preferredUri, preferredUriLiteral],
                    "}",
                    "filter not exists {",
                    [item, geniro.preferredUri, object],
                    "}",
                ]),
        );

        // Check whether the previous request succeeded in attributing a preferred URI
        preferredUri = (await sparql.getObjects(
            databaseEndpoint,
            item,
            geniro.preferredUri,
        ))?.[0];
        ++index;
    }

    return preferredUri;
};
