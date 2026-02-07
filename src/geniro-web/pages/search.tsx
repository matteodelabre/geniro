import { Router } from "@oak/oak";
import { uriToUrl } from "./util.tsx";
import * as query from "../data/query.ts";
import render from "../render.tsx";

export const search = new Router();

const renderSearch = (terms, results) => ({
    title: "Recherche",
    content: (
        <>
            <form method="GET" class="search">
                <input
                    type="search"
                    value={terms}
                    name="q"
                    autofocus
                    placeholder="Rechercher une personne ou un projet…"
                />
                <button type="submit">Rechercher</button>
            </form>
            {results &&
                (results.length === 0
                    ? (
                        <p>
                            <em>Aucun résultat</em>
                        </p>
                    )
                    : (
                        <ul>
                            {results.map(({ uri, label }) => (
                                <li>
                                    <a href={uriToUrl(uri)}>{label}</a>
                                </li>
                            ))}
                        </ul>
                    ))}
        </>
    ),
});

search.get("/", async (ctx) => {
    const terms = ctx.request.url.searchParams.get("q");
    const results = terms !== null ? await query.search(terms) : null;

    switch (ctx.request.accepts("text/html", "application/json")) {
        case "text/html":
            render(ctx, renderSearch(terms, results));
            break;

        case "application/json":
            ctx.response.type = "json";
            ctx.response.body = results;
            ctx.response.headers.set("access-control-allow-origin", "*");
            break;
    }
});
