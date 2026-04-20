import rdf from "@rdfjs/data-model";
import { Router } from "@oak/oak";
import { errors } from "@oak/commons/http_errors";
import { uriToUrl } from "./util.tsx";
import render from "../render.tsx";
import * as query from "../data/query.ts";
import { geniro, geniroProjectTypeLabel, getPersonURI } from "../data/model.ts";

/**
 * @param graph - Graph data
 * @param tree - Edges of the tree as a dictionary of arrays
 */
export const renderTree = (root, graphData, tree, visited) => {
    if (visited === undefined) {
        visited = new Set();
    }

    const badges = [];
    let isDiro = false;

    for (const affil of graphData.persons[root].affiliations) {
        if (affil.organization === "http://diro.umontreal.ca/geniro/org/diro") {
            const yearStart = affil.dateStart
                ? new Date(affil.dateStart).getUTCFullYear()
                : "";
            const yearEnd = affil.dateEnd ? new Date(affil.dateEnd).getUTCFullYear() : "";
            const range = `${yearStart}-${yearEnd}`;

            switch (affil.role) {
                case geniro.roleProfessor.value:
                case geniro.roleProfessorEmeritus.value:
                case geniro.roleProfessorFull.value:
                case geniro.roleProfessorAssociate.value:
                case geniro.roleProfessorAssistant.value:
                    isDiro = true;
                    badges.push(`(professeur.e DIRO ${range})`);
                    break;

                case geniro.roleDirector.value:
                    isDiro = true;
                    badges.push(`(directeur.ice DIRO ${range})`);
                    break;
            }
        }
    }

    for (const projectUri of graphData.persons[root].projects) {
        const { type: degree, dateEnd: date } = graphData.projects[projectUri];
        badges.push(`(${geniroProjectTypeLabel(degree)} ${date?.split("-")?.[0]})`);
    }

    let head = (
        <>
            <a href={uriToUrl(root)}>
                {graphData.persons[root].firstName} {graphData.persons[root].lastName}
            </a>
            {" " + badges.join(" ")}
        </>
    );

    if (isDiro) {
        head = <strong>{head}</strong>;
    }

    if (!visited.has(root)) {
        visited.add(root);

        return (
            <li>
                <details open>
                    <summary>{head}</summary>
                    <ul>
                        {tree[root].map((child) =>
                            renderTree(child, graphData, tree, visited)
                        )}
                    </ul>
                </details>
            </li>
        );
    }

    return <li>{head}</li>;
};

export const retrieveGraph = async (criteria) => {
    // Retrieve projects satisfying the given criteria
    const projects = await query.projects(criteria);

    let personsUris = new Set();

    for (const project of Object.values(projects)) {
        personsUris.add(project.student.uri);
        personsUris = personsUris.union(new Set(Object.keys(project.advisors)));
    }

    // Retrieve informations about the persons in the graph
    const persons = await query.persons(Array.from(personsUris).map(rdf.namedNode));

    // Collect projects by student
    for (const person of personsUris) {
        persons[person].projects = [];
    }

    for (const project of Object.values(projects)) {
        persons[project.student.uri].projects.push(project.uri);
    }

    return {projects, persons};
};

export const graph = new Router();

graph.get("/", async (ctx) => {
    const graphData = await retrieveGraph();

    const edges = {};
    const roots = new Set(Object.keys(graphData.persons));

    for (const person of Object.keys(graphData.persons)) {
        edges[person] = [];
    }

    for (const project of Object.values(graphData.projects)) {
        roots.delete(project.student.uri);

        for (const advisor of Object.values(project.advisors)) {
            if (edges[advisor.uri].indexOf(project.student.uri) === -1) {
                edges[advisor.uri].push(project.student.uri);
            }
        }
    }

    switch (ctx.request.accepts("text/html", "application/json")) {
        case "text/html":
            const visited = new Set();

            render(ctx, {
                title: "Graphe complet",
                content: <>
                    {Array.from(roots).map(root => <ul class="tree">{renderTree(root, graphData, edges)}</ul>)}
                </>,
            });
            break;

        case "application/json":
            ctx.response.type = "json";
            ctx.response.body = graphData;
            ctx.response.headers.set("access-control-allow-origin", "*");
            break;
    }
});
