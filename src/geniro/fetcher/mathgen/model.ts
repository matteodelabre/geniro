import rdf from "@rdfjs/data-model";
import { mainRdfNamespace } from "../../config.ts";

export const mathgenNamespace = "http://mathgenealogy.org";
export const mathscinetNamespace = "http://mathscinet.ams.org/mathscinet";
export const mathgenExternalNamespace = `${mainRdfNamespace}/external/mathgenealogy.org`;
export const mathgenMirrorNamespace = `${mathgenExternalNamespace}/mirror`;
export const mathgenProjectNamespace = `${mathgenExternalNamespace}/project`;
export const mathgenSchoolNamespace = `${mathgenExternalNamespace}/school`;

export const makeMathscinetUri = (mrauthId: string) => {
    return rdf.namedNode(`${mathscinetNamespace}/author?authorId=${mrauthId}`);
};

export const makePersonUri = (personId: string) => {
    return rdf.namedNode(`${mathgenNamespace}/id.php?id=${personId}`);
};

export const extractPersonId = (mirror: rdf.NamedNode) => {
    const prefix = `${mathgenNamespace}/id.php?id=`;

    if (mirror.value.startsWith(prefix)) {
        return mirror.value.slice(prefix.length);
    }

    throw new Error(`URI is not a valid MathGenealogy person: '${mirror.value}'`);
};

export const makeMirrorUri = (personId: string) => {
    return rdf.namedNode(`${mathgenMirrorNamespace}/${personId}`);
};

export const extractMirrorId = (mirror: rdf.NamedNode) => {
    if (mirror.value.startsWith(mathgenMirrorNamespace)) {
        return mirror.value.slice(mathgenMirrorNamespace.length + 1);
    }

    throw new Error(`URI is not a valid MathGenealogy mirror: '${mirror.value}'`);
};

export const makeProjectUri = (studentId: string, projectYear: string) => {
    if (isNaN(projectYear)) {
        projectYear = "unknown";
    }

    return rdf.namedNode(`${mathgenProjectNamespace}/${studentId}-${projectYear}`);
};

export const makeSchoolUri = (schoolId: string) => {
    return rdf.namedNode(`${mathgenSchoolNamespace}/${schoolId}`);
};
