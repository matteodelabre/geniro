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

export const xsd = makeClosedNamespace(
    namespace("http://www.w3.org/2001/XMLSchema#"),
    [
        "date",
    ],
);

export const foaf = makeClosedNamespace(
    namespace("http://xmlns.com/foaf/0.1/"),
    [
        "Person",
        "firstName",
        "lastName",
        "name",
    ],
);

export const org = makeClosedNamespace(
    namespace("http://www.w3.org/ns/org#"),
    [
        "Organization",
    ],
);

export const dcterms = makeClosedNamespace(
    namespace("http://purl.org/dc/terms/"),
    [
        "title",
        "creator",
    ],
);

export const geniro = makeClosedNamespace(
    namespace(`${mainRdfNamespace}#`),
    [
        "MScProject",
        "PhDProject",
        "Project",
        "advisor",
        "grantedBy",
        "preferredUri",
        "student",
        "thesis",
        "timePeriod",
    ],
);

export const time = makeClosedNamespace(
    namespace("http://www.w3.org/2006/time#"),
    [
        "Interval",
        "hasBeginning",
        "hasEnd",
        "inXSDDate",
    ],
);

export const geniroPerson = namespace(`${mainRdfNamespace}/person/`);
export const getPersonURI = (id: string) => sanitizeNamedNode(geniroPerson(id));

export const geniroProject = namespace(`${mainRdfNamespace}/project/`);
export const getProjectURI = (id: string) => sanitizeNamedNode(geniroProject(id));
