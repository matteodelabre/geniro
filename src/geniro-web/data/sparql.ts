import rdf from "@rdfjs/data-model";
import toNT from "@rdfjs/to-ntriples";
import namespace from "@rdfjs/namespace";
import { SparqlJsonParser } from "sparqljson-parse";
import { makeClosedNamespace } from "./util.ts";

export const onto = makeClosedNamespace(
    namespace("http://www.ontotext.com/"),
    [
        "fts",
        "explicit",
        "disable-sameAs",
    ],
);

const iriDisallowedChars = /[<>\"{}|^`\\\][\x00-\x20]/g;
const iriPattern = /^.+:.*$/;

export const sanitizeNamedNode = (node: rdf.NamedNode | string) => {
    const value = typeof node === "string" ? node : node.value;
    const cleaned = value.replace(iriDisallowedChars, "");

    if (!iriPattern.test(cleaned)) {
        throw new Error("invalid IRI pattern");
    }

    return rdf.namedNode(cleaned);
};

const logQuery = (kind: string, endpoint: string, queryObject: Node) => {
    const maxLength = 2500;
    let query = queryObject.toString();

    if (query.length > maxLength) {
        const trunc = query.substring(0, maxLength);
        const remain = query.length - maxLength;
        query = `${trunc}... (${remain} more chars)`;
    }

    console.info(`[${kind}] to ${endpoint}\n${query}`);
};

const parser = new SparqlJsonParser();

export const query = async (
    endpoint: string,
    queryObject: Node,
): Promise<unknown> => {
    logQuery("query", endpoint, queryObject);

    const res = await fetch(endpoint, {
        method: "POST",
        headers: {
            "content-type": "application/sparql-query",
            "accept": "application/sparql-results+json",
        },
        body: queryObject.toString(),
    });

    const data = await res.text();

    try {
        const parsed = JSON.parse(data);
        return parser.parseJsonResults(parsed);
    } catch (_) {
        throw new Error("Invalid server response: " + data);
    }
};

export const update = async (
    endpoint: string,
    updateObject: Node,
): Promise<void> => {
    logQuery("update", endpoint, updateObject);

    const res = await fetch(endpoint + "/statements", {
        method: "POST",
        headers: { "content-type": "application/sparql-update" },
        body: updateObject.toString(),
    });

    if (!res.ok) {
        throw new Error(`Invalid server response: ${res.statusText} (${res.status})`);
    }
};

export const getObjects = async (
    endpoint: string,
    subject: Node,
    predicate: Node,
): Promise<any[]> => {
    console.log("getting object:", toNT(subject), toNT(predicate));

    const url = new URL(endpoint + "/statements");
    url.search = new URLSearchParams({
        "subj": toNT(subject),
        "pred": toNT(predicate),
    });

    const res = await fetch(url, {
        method: "GET",
        headers: { "accept": "application/rdf+json" },
    });

    if (!res.ok) {
        throw new Error(`Invalid server response: ${res.statusText} (${res.status})`);
    }

    const data = await res.text();

    try {
        const parsed = JSON.parse(data);
        return parsed[subject.value]?.[predicate.value] || [];
    } catch (_) {
        throw new Error("Invalid server response: " + data);
    }
};
