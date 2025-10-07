import { mainRdfNamespace, webRoot } from "../config.ts";

export const uriToUrl = (uri) => {
    let url = uri;

    if (uri.startsWith(mainRdfNamespace)) {
        const stem = uri.slice(mainRdfNamespace.length);
        url = webRoot + stem;
    }

    return url;
};

export const nodeToHTML = (node) => {
    if (node.termType === "NamedNode") {
        const url = uriToUrl(node.value);
        return `<a href="${url}">${node.value}</a>`;
    } else {
        return node.value;
    }
};
