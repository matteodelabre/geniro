import rdf from "@rdfjs/data-model";
import * as builder from "rdf-sparql-builder";
import { foaf, geniro, owl, rdf as rdfns } from "../data/model.ts";
import * as sparql from "../data/sparql.ts";
import { databaseEndpoint, mainRdfNamespace } from "../config.ts";
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

export const personPrefix = `${mainRdfNamespace}/person/`;
export const orgPrefix = `${mainRdfNamespace}/org/`;
export const projectPrefix = `${mainRdfNamespace}/project/`;

const makeEntityUri = async (prefix, item, index) => {
    const firstName = rdf.variable("firstName");
    const lastName = rdf.variable("lastName");
    const name = rdf.variable("name");

    const rows = await sparql.query(
        databaseEndpoint,
        builder.select([firstName, lastName, name])
            .from(sparql.onto["disable-sameAs"])
            .where([
                builder.optional([[item, foaf.firstName, firstName]]),
                builder.optional([[item, foaf.lastName, lastName]]),
                builder.optional([[item, foaf.name, name]]),
            ]),
    );

    if (rows.length === 0) {
        throw new Error("no such entity");
    }

    const row = rows[0];
    const entityName = row.name
        ? row.name.value
        : `${row.firstName.value} ${row.lastName.value}`;

    let suffix = names.normalize(name);

    if (index !== 0) {
        suffix = `${suffix}-${index}`;
    }

    return rdf.namedNode(`${prefix}${suffix}`);
};

const makeProjectUri = async (item, index) => {
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
                [item, geniro.dateEnd, dateEnd],
                builder.optional([[student, foaf.firstName, firstName]]),
                builder.optional([[student, foaf.lastName, lastName]]),
                builder.optional([[student, foaf.name, name]]),
            ]),
    );

    if (rows.length === 0) {
        throw new Error("no such project");
    }

    const row = rows[0];
    const studentName = row.name
        ? row.name.value
        : `${row.firstName.value} ${row.lastName.value}`;
    const year = new Date(row.dateEnd.value).getFullYear();

    let suffix = `${names.normalize(studentName)}-${year}`;

    if (index !== 0) {
        suffix = `${suffix}-${index}`;
    }

    return rdf.namedNode(`${projectPrefix}${suffix}`);
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
            return await makeEntityUri(personPrefix, item, index);

        case geniro.Project:
            return await makeProjectUri(item, index);

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
        (await sparql.getObjects(databaseEndpoint, item, geniro.preferredUri))?.[0];
    let index = 0;

    while (!preferredUri) {
        preferredUri = await makeUri(type, item, index);
        const preferredUriLiteral = rdf.literal(preferredUri.value);

        const subject = rdf.variable("subject");
        const object = rdf.variable("object");

        // Use the minted URI as the preferred URI, unless it is already used by another
        // entity or if the item received a preferred URI in the mean time
        await sparql.update(
            databaseEndpoint,
            builder.insert([
                [preferredUri, owl.sameAs, item],
                [preferredUri, geniro.preferredUri, preferredUriLiteral],
            ])
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
            preferredUri,
            geniro.preferredUri,
        ))?.[0];
        ++index;
    }

    return preferredUri;
};
