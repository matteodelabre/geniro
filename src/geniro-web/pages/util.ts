import { mainRdfNamespace, webRoot } from "../config.ts";

export const uriToHTML = (uri) => {
    let target = uri;
    let label = uri;

    if (uri.startsWith(mainRdfNamespace)) {
        const stem = uri.slice(mainRdfNamespace.length);
        target = webRoot + stem;
        label = "geniro:" + stem;
    }

    return `<a href="${target}">${label}</a>`;
};

export const nodeToHTML = (node) => {
    if (node.termType === "NamedNode") {
        return uriToHTML(node.value);
    } else {
        return node.value;
    }
};
