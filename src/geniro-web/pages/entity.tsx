import { Router } from "@oak/oak";
import { uriToUrl } from "./util.tsx";
import render from "../render.tsx";
import * as query from "../data/query.ts";
import { webRoot } from "../config.ts";
import { getOrganizationURI, getProjectURI } from "../data/model.ts";

const renderNode = (node) => {
    if (node.termType === "NamedNode") {
        return <a href={uriToUrl(node.value)}>{node.value}</a>;
    } else {
        return node.value;
    }
};

const renderTriples = (triples) => (
    <table>
        {triples.map((triple) => (
            <tr>{triple.map((item) => <td>{renderNode(item)}</td>)}</tr>
        ))}
    </table>
);

const renderPage = (data) => (
    <>
        <h2>Sources</h2>
        <ul>
            {Object.keys(data).map((alias) => (
                <li>
                    <a href={uriToUrl(alias)}>{alias}</a>
                </li>
            ))}
        </ul>
        {Object.entries(data).map(([alias, triples]) => (
            <>
                <h2>{alias}</h2>
                {renderTriples(triples)}
            </>
        ))}
    </>
);

export const entity = new Router();

entity.get("/project/:project", async (ctx) => {
    const { project } = ctx.params;
    const uri = getProjectURI(project);
    render(ctx, {
        title: <>Projet · {project}</>,
        content: renderPage(await query.triplesByAlias(uri)),
    });
});

entity.get("/org/:org", async (ctx) => {
    const { org } = ctx.params;
    const uri = getOrganizationURI(org);
    render(ctx, {
        title: <>Organisation · {org}</>,
        content: (
            <>
                <p>
                    <a href={`${webRoot}/timeline/${org}`}>Voir la chronologie</a>
                </p>
                {renderPage(await query.triplesByAlias(uri))}
            </>
        ),
    });
});
