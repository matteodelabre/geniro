import { Router } from "@oak/oak";
import { uriToUrl } from "./util.tsx";
import * as query from "../data/query.ts";
import render from "../render.tsx";

export const search = new Router();

const renderResults = (results) => {
    if (results.length === 0) {
        return null;
    }

    return (
        <ul>
            {results.map(({ uri, label }) => (
                <li>
                    <a href={uriToUrl(uri)}>{label}</a>
                </li>
            ))}
        </ul>
    );
};

search.get("/", async (ctx) => {
    const terms = ctx.request.url.searchParams.get("q") || "";
    const results = terms !== "" ? await query.search(terms) : [];

    render(ctx, {
        title: "Recherche",
        content: (
            <>
                <form method="GET">
                    <input type="search" value={terms} name="q" autofocus />
                    <button type="submit">Rechercher</button>
                </form>
                {renderResults(results)}
            </>
        ),
    });
});
