import rdf from "@rdfjs/data-model";
import NamedNode from "@rdfjs/data-model/lib/NamedNode.js";
import { dcterms, foaf, geniro, owl, rdf as rdfns, time, xsd } from "../data/model.ts";
import * as names from "./names.ts";
import { mainRdfNamespace } from "../config.ts";
import * as requests from "./requests.ts";
import * as xml from "./xml.ts";

const namespaces = {
    oai: "http://www.openarchives.org/OAI/2.0/",
    etdms: [
        "http://www.ndltd.org/standards/metadata/etdms/1.0/",
        "http://www.ndltd.org/standards/metadata/etdms/1.1/",
    ],
};

const makePersonUri = (origin: string, name: string) => {
    return rdf.namedNode(
        `${mainRdfNamespace}/external/${origin}/person/${names.normalize(name)}`,
    );
};

const makeDate = (repr: string) => {
    const date = new Date(repr);
    const iso = date.toISOString().split("T")[0];
    return rdf.literal(iso, xsd.date);
};

const queryPaged = async function* (
    url: URL,
    verb: string,
    args: any,
    maxResults: number = Infinity,
) {
    let totalResults = 0;
    let resumptionToken = null;

    do {
        const localArgs = resumptionToken
            ? {
                verb,
                resumptionToken,
            }
            : {
                verb,
                ...args,
            };

        const data = await requests.query("GET", url, localArgs);
        const tree = xml.parse(await data.text());
        const error = xml.findOne(tree, namespaces.oai, "error")?.textContent;

        if (error) {
            throw new Error(error);
        }

        const batch = xml.findAll(tree, namespaces.oai, "record");

        if (totalResults + batch.length > maxResults) {
            yield* batch.slice(0, maxResults - totalResults);
            return;
        }

        yield* batch;
        totalResults += batch.length;

        resumptionToken = xml.findOne(tree, namespaces.oai, "resumptionToken")
            ?.textContent;
    } while (resumptionToken);
};

export const processRecord = function* (
    tree: any,
    origin: string,
    grantor: NamedNode,
) {
    const header = xml.findOne(tree, namespaces.oai, "header");
    const projectUri = xml.findOne(header, namespaces.oai, "identifier")?.textContent;

    if (!projectUri) {
        throw new Error("missing OAI-PMH identifier");
    }

    const projectNode = rdf.namedNode(projectUri);
    yield [projectNode, geniro.grantedBy, grantor];

    const thesis = xml.findOne(tree, namespaces.etdms, "thesis");

    // Extract degree type
    const degree = xml.findOne(
        xml.findOne(thesis, namespaces.etdms, "degree"),
        namespaces.etdms,
        "name",
    )?.textContent;

    switch (degree) {
        case "D. Th.":
        case "Ph. D.":
            yield [projectNode, rdfns.type, geniro.PhDProject];
            break;

        case "M. Sc.":
        case "M. Sc. A.":
        case "M.A.":
        case "M.S.I.":
            yield [projectNode, rdfns.type, geniro.MScProject];
            break;

        default:
            yield [projectNode, rdfns.type, geniro.Project];
    }

    // Extract title
    const title = xml.findOne(thesis, namespaces.etdms, "title")?.textContent;

    if (title) {
        yield [projectNode, dcterms.title, rdf.literal(title.trim())];
    }

    // Extract end date
    const dateEnd = xml.findOne(thesis, namespaces.etdms, "date")?.textContent;

    if (dateEnd) {
        const interval = rdf.blankNode();
        const end = rdf.blankNode();
        yield [projectNode, geniro.timePeriod, interval];
        yield [interval, time.hasEnd, end];
        yield [end, time.inXSDDate, makeDate(dateEnd)];
    }

    // Extract student and advisors
    const students = xml.findAll(thesis, namespaces.etdms, "creator").map(
        (item) => ["student", item],
    );
    const advisors = xml.findAll(thesis, namespaces.etdms, "contributor").map(
        (item) => ["advisor", item],
    );

    for (let [status, person] of students.concat(advisors)) {
        const personName = person.textContent;
        const personNode = makePersonUri(origin, personName);

        yield [personNode, rdfns.type, foaf.Person];
        yield [
            projectNode,
            status === "student" ? geniro.student : geniro.advisor,
            personNode,
        ];

        const [firstName, lastName] = names.decompose(personName);

        yield [personNode, foaf.firstName, rdf.literal(firstName)];
        yield [personNode, foaf.lastName, rdf.literal(lastName)];

        const resourceUri = person?.getAttribute("resource");

        if (resourceUri) {
            yield [personNode, owl.sameAs, rdf.namedNode(resourceUri)];
        }
    }

    // Extract thesis URI
    const thesisUri = xml.findOne(thesis, namespaces.etdms, "identifier")?.textContent;

    if (thesisUri) {
        yield [projectNode, geniro.thesis, rdf.namedNode(thesisUri)];
    }
};

export const fetchRecords = async function* (
    baseUrl: URL,
    baseSet: string,
    organization: NamedNode,
    maxRecords: number = Infinity,
) {
    for await (
        const record of queryPaged(
            baseUrl,
            "ListRecords",
            {
                metadataPrefix: "etdms",
                set: baseSet,
            },
            maxRecords,
        )
    ) {
        yield* processRecord(record, baseUrl.host, organization);
    }
};
