import rdf from "@rdfjs/data-model";
import { mathgenRefreshDelay, mathgenRefreshDelaySpread } from "../../config.ts";
import {
    extractPersonId,
    makeMathscinetUri,
    makeMirrorUri,
    makePersonUri,
    makeProjectUri,
    makeSchoolUri,
} from "./model.ts";
import {
    dcterms,
    foaf,
    geniro,
    org,
    owl,
    rdf as rdfns,
    skos,
    time,
    xsd,
} from "../../data/model.ts";
import * as requests from "../requests.ts";

const apiRoot = "https://mathgenealogy.org:8000/";

export const getToken = async (email: string, password: string): Promise<string> => {
    const res = await requests.query("POST", apiRoot + "login", { email, password });

    if (res.status !== 201) {
        throw new Error(res.statusText);
    }

    return (await res.json()).token;
};

export const queryPerson = async (token: string, person: rdf.NamedNode) => {
    const id = extractPersonId(person);
    const res = await requests.query(
        "GET",
        apiRoot + "api/v2/MGP/acad",
        { id },
        { "x-access-token": token },
    );

    if (res.status !== 200) {
        throw new Error(res.statusText);
    }

    return (await res.json()).MGP_academic;
};

export const querySchools = async (token: string) => {
    const res = await requests.query(
        "GET",
        apiRoot + "api/v2/MGP/schoolnames_by_id",
        {},
        { "x-access-token": token },
    );

    if (res.status !== 200) {
        throw new Error(res.statusText);
    }

    const idToName = await res.json();

    // build reverse lookup
    const nameToId = {};

    for (const [id, name] of Object.entries(idToName)) {
        nameToId[name] = id;
    }

    return [idToName, nameToId];
};

export const processRecord = function* (schoolIds, data) {
    const studentId = data.ID;
    const studentNode = makePersonUri(studentId);
    yield [studentNode, rdfns.type, foaf.Person];

    // Generate refresh time
    const updated = Temporal.Now.instant();
    const expires = updated
        .add(mathgenRefreshDelay)
        .add({
            seconds: Math.floor(
                (Math.random() * 2 - 1) *
                    mathgenRefreshDelaySpread.total("seconds"),
            ),
        });

    const mirrorNode = makeMirrorUri(studentId);
    yield [mirrorNode, rdfns.type, geniro.Mirror];
    yield [mirrorNode, geniro.entity, rdf.literal(studentNode.value)];
    yield [mirrorNode, geniro.updated, rdf.literal(updated.toString(), xsd.dateTime)];
    yield [mirrorNode, geniro.expires, rdf.literal(expires.toString(), xsd.dateTime)];

    // Extract student data
    const firstName = data.given_name;
    const lastName = data.family_name;

    yield [studentNode, foaf.firstName, rdf.literal(firstName)];
    yield [studentNode, foaf.lastName, rdf.literal(lastName)];

    if (data.mrauth_id) {
        yield [studentNode, owl.sameAs, makeMathscinetUri(data.mrauth_id)];
    }

    for (const degree of data.student_data.degrees) {
        let projectYear = degree.degree_year;

        if (projectYear.indexOf(",") !== -1) {
            const parts = projectYear.split(",");
            projectYear = parts[parts.length - 1].trim();
        }

        const projectNode = makeProjectUri(studentId, projectYear);

        yield [mirrorNode, geniro.entity, rdf.literal(projectNode.value)];
        yield [projectNode, geniro.student, studentNode];

        // Degree type is always assumed to be doctoral in MathGenealogy
        yield [projectNode, rdfns.type, geniro.PhDProject];

        // Extract title
        yield [projectNode, dcterms.title, rdf.literal(degree.thesis_title)];

        // Extract grantors
        for (const schoolLabel of degree.schools) {
            if (!(schoolLabel in schoolIds)) {
                console.warn(
                    `${studentId} profile contains unknown school: '${schoolLabel}'`,
                );
                continue;
            }

            const grantorNode = makeSchoolUri(schoolIds[schoolLabel]);
            yield [projectNode, geniro.grantedBy, grantorNode];
            yield [grantorNode, rdfns.type, org.Organization];

            // Split school name from country if possible
            if (schoolLabel.indexOf(",") !== 0) {
                const schoolName = schoolLabel.substring(0, schoolLabel.indexOf(","))
                    .trim();
                yield [grantorNode, skos.prefLabel, rdf.literal(schoolName)];
            } else {
                yield [grantorNode, skos.prefLabel, rdf.literal(schoolLabel)];
            }
        }

        // Extract advisors
        for (const advisorId of Object.keys(degree["advised by"])) {
            if (advisorId !== "0") {
                const advisorNode = makePersonUri(advisorId);
                const advisorMirrorNode = makeMirrorUri(advisorId);
                yield [projectNode, geniro.advisor, advisorNode];
                yield [advisorNode, rdfns.type, foaf.Person];
                yield [advisorMirrorNode, rdfns.type, geniro.Mirror];
                yield [advisorMirrorNode, geniro.entity, rdf.literal(advisorNode.value)];
            }
        }

        // Extract end date
        if (!isNaN(projectYear)) {
            const interval = rdf.namedNode(projectNode.value + "#timePeriod");
            const end = rdf.namedNode(interval.value + "/end");
            yield [mirrorNode, geniro.entity, rdf.literal(interval.value)];
            yield [mirrorNode, geniro.entity, rdf.literal(end.value)];
            yield [projectNode, geniro.timePeriod, interval];
            yield [interval, time.hasEnd, end];
            yield [
                end,
                time.inXSDDate,
                rdf.literal(
                    new Temporal.PlainDate(projectYear, 1, 1).toString(),
                    xsd.date,
                ),
            ];
        }
    }
};
