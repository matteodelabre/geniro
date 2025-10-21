import { Router } from "@oak/oak/router";
import { uriToUrl } from "./util.ts";
import * as query from "../data/query.ts";

export const search = new Router();

search.get("/search", async (ctx) => {
    const terms = ctx.request.url.searchParams.get("q") || "";
    const parts = [];

    parts.push('<form method="GET">');
    parts.push(`<input type="search" value="${terms}" name="q" autofocus> `);
    parts.push(`<button>Rechercher</button>`);
    parts.push("</form>");

    if (terms !== "") {
        const results = await query.search(terms);
        parts.push("<ul>");

        for (const { uri, firstName, lastName } of results) {
            parts.push(
                "<li>",
                `<a href="${uriToUrl(uri)}">`,
                `${firstName} ${lastName}`,
                "</a>",
                "</li>",
            );
        }

        parts.push("</ul>");
    }

    ctx.response.body = parts.join("");
    ctx.response.type = "text/html";
});
