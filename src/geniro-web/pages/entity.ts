import rdf from "@rdfjs/data-model";
import { Router } from "@oak/oak/router";
import { nodeToHTML, uriToUrl } from "./util.ts";
import * as query from "../data/query.ts";
import { webRoot } from "../config.ts";
import { getOrganizationURI, getPersonURI, getProjectURI } from "../data/model.ts";

const triplesToTable = (triples) => {
    const parts = ["<table>"];

    for (const triple of triples) {
        parts.push("<tr>");

        for (const item of triple) {
            parts.push("<td>", nodeToHTML(item), "</td>");
        }

        parts.push("</tr>");
    }

    parts.push("</tr></table>");
    return parts.join("");
};

const makeEntityPage = async (uri) => {
    const data = await query.triplesByAlias(uri);
    const parts = [];

    parts.push("<h2>Alias</h2>");
    parts.push("<ul>");

    for (const alias in data) {
        const url = uriToUrl(alias);
        parts.push(`<li><a href="${url}">${alias}</a></li>`);
    }

    parts.push("</ul>");

    for (const alias in data) {
        parts.push("<h2>", alias, "</h2>");
        parts.push(triplesToTable(data[alias]));
    }

    return parts.join("");
};

export const entity = new Router();

entity.get("/person/:person", async (ctx) => {
    const { person } = ctx.params;
    const uri = getPersonURI(person);
    const parts = [
        `<p><a href="${webRoot}/tree/${person}">Voir la descendance</a></p>`,
        await makeEntityPage(uri),
    ];

    ctx.response.body = parts.join("");
    ctx.response.type = "text/html";
});

entity.get("/project/:project", async (ctx) => {
    const { project } = ctx.params;
    const uri = getProjectURI(project);
    ctx.response.body = await makeEntityPage(uri);
    ctx.response.type = "text/html";
});

entity.get("/org/:org", async (ctx) => {
    const { org } = ctx.params;
    const uri = getOrganizationURI(org);
    ctx.response.body = await makeEntityPage(uri);
    ctx.response.type = "text/html";
});
