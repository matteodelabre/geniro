import rdf from "@rdfjs/data-model";
import { App, HttpError } from "@fresh/core";
import { accepts } from "@std/http/negotiation";
import { uriToUrl } from "./util.ts";
import * as query from "../data/query.ts";
import { geniro, getPersonURI } from "../data/model.ts";

const degreeLabel = (degree) => {
    switch (degree) {
        case geniro.MScProject.value:
            return "M.Sc.";

        case geniro.PhDProject.value:
            return "Ph.D.";

        default:
            return "Unknown degree";
    }
};

const renderGraph = (
    projectData,
    personData,
    root,
    visited,
    degree = null,
    date = null,
) => {
    if (root === null) {
        // if no root is specified, start from each root separately
        return (
            <>
                {Object.keys(personData)
                    .filter((root) => !(root in projectData))
                    .map((root) => renderGraph(projectData, personData, root, visited))}
            </>
        );
    }

    const badges = [];

    for (const affil of personData[root].affiliations) {
        if (affil.organization === "http://diro.umontreal.ca/geniro/org/diro") {
            const yearStart = affil.dateStart
                ? new Date(affil.dateStart).getUTCFullYear()
                : "";
            const yearEnd = affil.dateEnd ? new Date(affil.dateEnd).getUTCFullYear() : "";
            const range = `${yearStart}-${yearEnd}`;

            switch (affil.role) {
                case geniro.professorRole.value:
                    badges.push(`(professeur.e DIRO ${range})`);
                    break;

                case geniro.directorRole.value:
                    badges.push(`(directeur.ice DIRO ${range})`);
                    break;
            }
        }
    }

    if (degree !== null && date !== null) {
        badges.push(`(${degreeLabel(degree)} ${date.split("-")[0]})`);
    }

    let subtree;

    if (!visited.has(root)) {
        const items = [];

        for (const [student, projects] of Object.entries(projectData)) {
            for (
                const { advisors, type, dateEnd } of Object.values(projects)
            ) {
                if (advisors.includes(root)) {
                    items.push(renderGraph(
                        projectData,
                        personData,
                        student,
                        visited,
                        type,
                        dateEnd,
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
                {personData[root].firstName} {personData[root].lastName}
            </a>
            {" " + badges.join(" ")}
            {subtree}
        </li>
    );
};

export const tree = new App();

tree.get("/:id", async (ctx) => {
    const { id } = ctx.params;

    // Collect graph edges
    let root = null;
    let projectData = null;

    if (id === "all") {
        projectData = await query.graph();
    } else {
        const rootNode = getPersonURI(id);
        root = rootNode.value;
        projectData = await query.graph(rootNode);
    }

    // Retrieve information about the graph nodes
    let persons = new Set(Object.keys(projectData));

    for (const projects of Object.values(projectData)) {
        for (const project of Object.values(projects)) {
            persons = persons.union(new Set(project.advisors));
        }
    }

    const personData = await query.persons(Array.from(persons).map(rdf.namedNode));

    // Prepare page title
    if (id === "all") {
        ctx.state.title = <>Graphe complet</>;
    } else {
        if (!(root in personData)) {
            throw new HttpError(404, "Person not found");
        }

        ctx.state.title = <>{personData[root].firstName} {personData[root].lastName}</>;
    }

    switch (accepts(ctx.req, "text/html", "application/json")) {
        case "text/html":
            return ctx.render(
                <ul>{renderGraph(projectData, personData, root, new Set())}</ul>,
            );

        case "application/json":
            return new Response(
                JSON.stringify({
                    projects: projectData,
                    persons: personData,
                }),
                {
                    headers: {
                        "access-control-allow-origin": "*",
                        "content-type": "application/json",
                    },
                },
            );
    }
});
