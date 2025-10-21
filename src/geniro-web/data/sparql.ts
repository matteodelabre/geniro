import rdf from "@rdfjs/data-model";
import namespace from "@rdfjs/namespace";
import { SparqlJsonParser } from "sparqljson-parse";
import { Node } from "rdf-sparql-builder/lib/Node";
import { makeClosedNamespace } from "./util.ts";

export const onto = makeClosedNamespace(
    namespace("http://www.ontotext.com/"),
    [
        "fts",
        "explicit",
        "disable-sameAs",
    ],
);

const parser = new SparqlJsonParser();
const iriDisallowedChars = /[<>\"{}|^`\\\][\x00-\x20]/g;

export const sanitizeNamedNode = (node: rdf.NamedNode) => {
    return rdf.namedNode(node.value.replace(iriDisallowedChars, ""));
};

export const query = async (
    endpoint: string,
    queryObject: Node,
): Promise<unknown> => {
    console.log("running query:", queryObject.toString());

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
    console.log("running update:", updateObject.toString());

    const res = await fetch(endpoint + "/statements", {
        method: "POST",
        headers: { "content-type": "application/sparql-update" },
        body: updateObject.toString(),
    });

    if (!res.ok) {
        throw new Error(`Invalid server response: ${res.statusText} (${res.status})`);
    }
};
