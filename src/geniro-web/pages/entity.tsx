import rdf from "@rdfjs/data-model";
import { Router } from "@oak/oak";
import { uriToUrl } from "./util.ts";
import render from "../render.tsx";
import * as query from "../data/query.ts";
import * as update from "../data/update.ts";
import { webRoot } from "../config.ts";
import { getOrganizationURI, getPersonURI, getProjectURI } from "../data/model.ts";

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

const form = {
    merge: {
        source: "merge-source",
        submit: "merge-submit",
    },
};

const renderPerson = async (ctx, person, uri) => {
    render(ctx, {
        title: <>Personne · {person}</>,
        content: (
            <>
                <p>
                    <a href={`${webRoot}/tree/${person}`}>Voir la descendance</a>
                </p>
                <h2>Fusion</h2>
                <form method="POST">
                    <label for={form.merge.source}>Source</label>
                    <input type="url" name={form.merge.source} id={form.merge.source} />
                    <input
                        type="submit"
                        name={form.merge.submit}
                        value="Fusionner avec la personne actuelle"
                    />
                </form>
                {renderPage(await query.triplesByAlias(uri))}
            </>
        ),
    });
};

export const entity = new Router();

entity.get("/person/:person", async (ctx) => {
    console.log("here");
    const { person } = ctx.params;
    const uri = getPersonURI(person);
    await renderPerson(ctx, person, uri);
});

entity.post("/person/:person", async (ctx) => {
    const { person } = ctx.params;
    const data = await ctx.request.body.formData();
    const uri = getPersonURI(person);

    if (data.has(form.merge.submit)) {
        const source = rdf.namedNode(data.get(form.merge.source));
        await update.merge(uri, source);
    }

    await renderPerson(ctx, person, uri);
});

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
