import namespace from "@rdfjs/namespace";
import { sanitizeNamedNode } from "./sparql.ts";
import { mainRdfNamespace } from "../config.ts";
import { makeClosedNamespace } from "./util.ts";

export const rdf = makeClosedNamespace(
    namespace("http://www.w3.org/1999/02/22-rdf-syntax-ns#"),
    [
        "type",
    ],
);

export const owl = makeClosedNamespace(
    namespace("http://www.w3.org/2002/07/owl#"),
    [
        "sameAs",
    ],
);

export const foaf = makeClosedNamespace(
    namespace("http://xmlns.com/foaf/0.1/"),
    [
        "Person",
        "name",
    ],
);

export const org = makeClosedNamespace(
    namespace("http://www.w3.org/ns/org#"),
    [
        "Organization",
    ],
);

export const geniro = makeClosedNamespace(
    namespace(`${mainRdfNamespace}#`),
    [
        "Project",
        "advisor",
        "awardedBy",
        "dateEnd",
        "dateStart",
        "degree",
        "student",
        "thesisTitle",
        "thesisUri",
    ],
);

export const geniroPerson = namespace(`${mainRdfNamespace}/person/`);
export const getPersonURI = (id: string) => sanitizeNamedNode(geniroPerson(id));
