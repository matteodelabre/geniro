import { App } from "@fresh/core";
import { accepts } from "@std/http/negotiation";
import { uriToUrl } from "./util.ts";
import * as query from "../data/query.ts";
import { geniro, getPersonURI } from "../data/model.ts";
import { mainRdfNamespace } from "../config.ts";

const renderGraph = (data, root, visited, degree = null, date = null) => {
    if (root === null) {
        // if no root is specified, start from each root separately
        return (
            <>
                {Object.entries(data)
                    .filter(([_, data]) => Object.keys(data.projects).length === 0)
                    .map(([key, _]) => renderGraph(data, key, visited))}
            </>
        );
    }

    let degreeLabel;

    if (degree !== null && date !== null) {
        let degreeType = "Unknown";

        switch (degree) {
            case geniro.MScProject.value:
                degreeType = "M.Sc.";
                break;

            case geniro.PhDProject.value:
                degreeType = "Ph.D.";
                break;
        }

        let degreeDate = date.split("-")[0];
        degreeLabel = ` (${degreeType} ${degreeDate})`;
    }

    let subtree;

    if (!visited.has(root)) {
        let items = [];

        for (const [student, entry] of Object.entries(data)) {
            for (const project of Object.values(entry.projects)) {
                if (project.advisors.includes(root)) {
                    items.push(renderGraph(
                        data,
                        student,
                        visited,
                        project.type,
                        project.dateEnd,
                    ));
                }
            }
        }

        if (items.length > 0) {
            subtree = <ul>{items}</ul>;
        }
    }

    visited.add(root);

    return (
        <li>
            <a href={uriToUrl(root)}>
                {data[root].firstName} {data[root].lastName}
            </a>
            {degreeLabel}
            {subtree}
        </li>
    );
};

export const tree = new App();

tree.get("/:id", async (ctx) => {
    const { id } = ctx.params;
    let person = null;
    let data = null;

    if (id === "all") {
        data = await query.graph();
        ctx.state.title = "Graphe complet";
    } else {
        const personNode = getPersonURI(id);
        person = personNode.value;
        data = await query.graph(personNode);

        if (!(person in data)) {
            ctx.throw(404, "Person not found");
            return;
        }

        ctx.state.title = <>{data[person].firstName} {data[person].lastName}</>;
    }

    switch (accepts(ctx.req, "text/html", "application/json")) {
        case "text/html":
            return ctx.render(<ul>{renderGraph(data, person, new Set())}</ul>);

        case "application/json":
            return new Response(
                JSON.stringify(data),
                {
                    headers: {
                        "access-control-allow-origin": "*",
                        "content-type": "application/json",
                    },
                },
            );
    }
});
