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
        "dateTime",
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
        "organization",
        "member",
        "memberDuring",
        "role",
    ],
);

export const dcterms = makeClosedNamespace(
    namespace("http://purl.org/dc/terms/"),
    [
        "title",
        "creator",
        "description",
    ],
);

export const geniro = makeClosedNamespace(
    namespace(`${mainRdfNamespace}#`),
    [
        "MScProject",
        "PhDProject",
        "Project",
        "advisor",
        "expires",
        "grantedBy",
        "preferredUri",
        "student",
        "thesis",
        "timePeriod",
        "professorRole",
        "directorRole",
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

export const skos = makeClosedNamespace(
    namespace("http://www.w3.org/2004/02/skos/core#"),
    [
        "prefLabel",
        "altLabel",
    ],
);

export const geniroPerson = namespace(`${mainRdfNamespace}/person/`);
export const getPersonURI = (id: string) => sanitizeNamedNode(geniroPerson(id));

export const geniroProject = namespace(`${mainRdfNamespace}/project/`);
export const getProjectURI = (id: string) => sanitizeNamedNode(geniroProject(id));

export const geniroOrganization = namespace(`${mainRdfNamespace}/org/`);
export const getOrganizationURI = (id: string) =>
    sanitizeNamedNode(geniroOrganization(id));

export const geniroAffiliationRoleLabel = (role) => {
    if (!role) {
        return "Rôle inconnu";
    }

    switch (role) {
        case geniro.professorRole.value:
            return "Professeur·e";

        case geniro.directorRole.value:
            return "Directeur·ice";

        default:
            return role.substring(geniro.$().value.length);
    }
};

export const geniroProjectTypeLabel = (type) => {
    if (!type) {
        return "Grade inconnu";
    }

    switch (type) {
        case geniro.MScProject.value:
            return "M.\xA0Sc.";

        case geniro.PhDProject.value:
            return "Ph.\xA0D.";

        default:
            return type.substring(geniro.$().value.length);
    }
};
