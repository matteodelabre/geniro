import rdf from "@rdfjs/data-model";
import { Router } from "@oak/oak/router";
import { uriToUrl } from "./util.ts";
import * as query from "../data/query.ts";
import { geniro, getOrganizationURI } from "../data/model.ts";

export const timeline = new Router();

const roleLabel = (role) => {
    switch (role) {
        case geniro.professorRole.value:
            return "Professeur.e";

        case geniro.directorRole.value:
            return "Directeur.ice";

        default:
            return role.substring(geniro.$().value.length);
    }
};

const timelineToHtml = (data) => {
    const parts = [
        "<table>",
        "<thead><tr><th>Nom complet</th><th>Rôle</th><th>Date de début</th><th>Date de fin</th></tr></thead>",
    ];

    for (const row of data) {
        parts.push("<tr>");
        parts.push(
            '<td><a href="',
            uriToUrl(row.personUri),
            '">',
            row.firstName,
            " ",
            row.lastName,
            "</a></td>",
        );
        parts.push("<td>", roleLabel(row.role), "</td>");
        parts.push("<td>", row.dateStart, "</td>");
        parts.push("<td>", row.dateEnd, "</td>");
        parts.push("</tr>");
    }

    parts.push("</tr></table>");
    return parts.join("");
};

timeline.get("/timeline/:org", async (ctx) => {
    const { org } = ctx.params;
    const uri = getOrganizationURI(org);
    const data = await Array.fromAsync(query.timeline(uri));

    switch (ctx.request.accepts("text/html", "application/json")) {
        case "text/html":
            ctx.response.body = timelineToHtml(data);
            ctx.response.type = "text/html";
            break;

        case "application/json":
            ctx.response.headers.set("access-control-allow-origin", "*");
            ctx.response.body = JSON.stringify(data);
            ctx.response.type = "application/json";
            break;
    }
});
