import { DOMParser } from "@xmldom/xmldom";
import { Document, Node } from "@xmldom/xmldom/lib/dom.js";

const parser = new DOMParser();

export const findAll = (
    node: Node,
    namespaces: string | string[],
    name: string,
): Node[] => {
    if (!node) {
        return [];
    }

    if (!Array.isArray(namespaces)) {
        namespaces = [namespaces];
    }

    return namespaces.map(
        (namespace) => Array.from(node.getElementsByTagNameNS(namespace, name)),
    ).flat();
};

export const findOne = (
    node: Node,
    namespaces: string | string[],
    name: string,
): Node => {
    return findAll(node, namespaces, name)[0];
};

export const parse = (data: string): Document => parser.parseFromString(data, "text/xml");
