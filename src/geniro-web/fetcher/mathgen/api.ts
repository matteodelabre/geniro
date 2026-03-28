import rdf from "@rdfjs/data-model";
import { mainRdfNamespace, mathgenRefreshDelay, mathgenRefreshDelaySpread } from "../../config.ts";
import { dcterms, foaf, geniro, org, owl, rdf as rdfns, skos, time, xsd } from "../../data/model.ts";
import * as requests from "../requests.ts";

const apiRoot = "https://mathgenealogy.org:8000/";

export const mathscinetNamespace = "http://mathscinet.ams.org/mathscinet";

export const mathgenNamespace = "http://mathgenealogy.org";

export const externalMathgenNamespace = `${mainRdfNamespace}/external/mathgenealogy.org`;

export const makePersonUri = (personId: string) => {
    return rdf.namedNode(`${mathgenNamespace}/id.php?id=${personId}`);
};

export const extractPersonId = (person: NamedNode) => {
    const prefix = `${mathgenNamespace}/id.php?id=`;

    if (person.value.startsWith(prefix)) {
        return person.value.slice(prefix.length);
    }

    throw new Error(`URI is not a valid MathGenealogy person: '${person.value}'`);
};

const makeMathscinetUri = (mrauthId: string) => {
    return rdf.namedNode(`${mathscinetNamespace}/author?authorId=${mrauthId}`);
};

const makeRefreshUri = (personId: string) => {
    return rdf.namedNode(`${externalMathgenNamespace}/refresh/${personId}`);
};

const makeProjectUri = (studentId: string, projectYear: string) => {
    if (isNaN(projectYear)) {
        projectYear = "unknown";
    }

    return rdf.namedNode(`${externalMathgenNamespace}/project/${studentId}-${projectYear}`);
};

const makeSchoolUri = (schoolId: string) => {
    return rdf.namedNode(`${externalMathgenNamespace}/school/${schoolId}`);
};


export const getToken = async (email: string, password: string): Promise<string> => {
    const res = await requests.query("POST", apiRoot + "login", {email, password});

    if (res.status !== 201) {
        throw new Error(res.statusText);
    }

    return (await res.json()).token;
};

export const queryPerson = async (token: string, person: NamedNode) => {
    const id = extractPersonId(person);
    const res = await requests.query(
        "GET", apiRoot + "api/v2/MGP/acad", {id},
        {"x-access-token": token}
    );

    if (res.status !== 200) {
        throw new Error(res.statusText);
    }

    return (await res.json()).MGP_academic;
};

export const querySchools = async (token: string) => {
    const res = await requests.query(
        "GET", apiRoot + "api/v2/MGP/schoolnames_by_id", {},
        {"x-access-token": token}
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

export const processRecord = function* (data, schoolIds) {
    // Extract student data
    const studentId = data.ID;
    const studentNode = makePersonUri(studentId);
    const firstName = data.given_name;
    const lastName = data.family_name;

    yield [studentNode, rdfns.type, foaf.Person];
    yield [studentNode, foaf.firstName, rdf.literal(firstName)];
    yield [studentNode, foaf.lastName, rdf.literal(lastName)];

    if (data.mrauth_id) {
        yield [studentNode, owl.sameAs, makeMathscinetUri(data.mrauth_id)];
    }

    // Generate refresh time
    const expires = Temporal.Now.instant().
        add(mathgenRefreshDelay).
        add({
            seconds: Math.floor(
                (Math.random() * 2 - 1) *
                mathgenRefreshDelaySpread.total("seconds")
            )
        }).
        toString();

    const refreshNode = makeRefreshUri(studentId);
    yield [refreshNode, geniro.preferredUri, rdf.literal(studentNode.value)];
    yield [refreshNode, geniro.expires, rdf.literal(expires, xsd.dateTime)];

    for (const degree of data.student_data.degrees) {
        let projectYear = degree.degree_year;

        if (projectYear.indexOf(",") !== -1) {
            const parts = projectYear.split(",");
            projectYear = parts[parts.length - 1].trim();
        }

        const projectNode = makeProjectUri(studentId, projectYear);

        yield [projectNode, geniro.student, studentNode];

        // Degree type is always assumed to be doctoral in MathGenealogy
        yield [projectNode, rdfns.type, geniro.PhDProject];

        // Extract title
        yield [projectNode, dcterms.title, rdf.literal(degree.thesis_title)];

        // Extract grantors
        for (const schoolLabel of degree.schools) {
            if (!(schoolLabel in schoolIds)) {
                console.warn(`${studentId} profile contains unknown school: '${schoolLabel}'`);
                continue;
            }

            const grantorNode = makeSchoolUri(schoolIds[schoolLabel]);
            yield [projectNode, geniro.grantedBy, grantorNode];
            yield [grantorNode, rdfns.type, org.Organization];

            // Split school name from country if possible
            if (schoolLabel.indexOf(",") !== 0) {
                const schoolName = schoolLabel.substring(0, schoolLabel.indexOf(",")).trim();
                yield [grantorNode, skos.prefLabel, rdf.literal(schoolName)];
            } else {
                yield [grantorNode, skos.prefLabel, rdf.literal(schoolLabel)];
            }
        }

        // Extract advisors
        for (const advisorId of Object.keys(degree["advised by"])) {
            if (advisorId !== "0") {
                const advisorNode = makePersonUri(advisorId);
                yield [projectNode, geniro.advisor, advisorNode];
                yield [advisorNode, rdfns.type, foaf.Person];
            }
        }

        // Extract end date
        if (!isNaN(projectYear)) {
            const interval = rdf.namedNode(projectNode.value + "#timePeriod");
            const end = rdf.namedNode(interval.value + "/end");
            yield [projectNode, geniro.timePeriod, interval];
            yield [interval, time.hasEnd, end];
            yield [
                end,
                time.inXSDDate,
                rdf.literal(new Temporal.PlainDate(projectYear, 1, 1).toString(), xsd.date)
            ];
        }
    }
};
