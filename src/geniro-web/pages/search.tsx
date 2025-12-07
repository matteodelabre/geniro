import { App } from "@fresh/core";
import { uriToUrl } from "./util.ts";
import * as query from "../data/query.ts";

export const search = new App();

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
    const terms = new URL(ctx.req.url).searchParams.get("q") || "";
    const results = terms !== "" ? await query.search(terms) : [];

    ctx.state.title = "Recherche";
    return ctx.render(
        <>
            <form method="GET">
                <input type="search" value={terms} name="q" autofocus />
                <button type="submit">Rechercher</button>
            </form>
            {renderResults(results)}
        </>,
    );
});
