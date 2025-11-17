import { Router } from "@oak/oak/router";
import { uriToUrl } from "./util.ts";
import * as query from "../data/query.ts";
import { geniro, getPersonURI } from "../data/model.ts";
import { mainRdfNamespace } from "../config.ts";

export const tree = new Router();

const forestToHTML = (data, root, visited, degree = null, date = null) => {
    if (root === null) {
        // if no root is specified, start from each root separately
        return Array.prototype.concat(
            ...(
                Object.entries(data)
                    .filter(([_, data]) => Object.keys(data.projects).length === 0)
                    .map(([key, _]) => forestToHTML(data, key, visited))
            ),
        );
    }

    let parts = ["<li>"];
    parts.push(
        '<a href="',
        uriToUrl(root),
        '">',
        data[root].firstName,
        " ",
        data[root].lastName,
        "</a>",
    );

    if (degree !== null && date !== null) {
        let degreeLabel = "Unknown";

        switch (degree) {
            case geniro.MScProject.value:
                degreeLabel = "M.Sc.";
                break;

            case geniro.PhDProject.value:
                degreeLabel = "Ph.D.";
                break;
        }

        parts.push(
            " (",
            degreeLabel,
            " ",
            date.split("-")[0],
            ")",
        );
    }

    if (!visited.has(root)) {
        let subtree = [];

        for (const [student, entry] of Object.entries(data)) {
            for (const project of Object.values(entry.projects)) {
                if (project.advisors.includes(root)) {
                    subtree = subtree.concat(forestToHTML(
                        data,
                        student,
                        visited,
                        project.type,
                        project.dateEnd,
                    ));
                }
            }
        }

        if (subtree.length > 0) {
            parts.push("<ul>");
            parts = parts.concat(subtree);
            parts.push("</ul>");
        }
    }

    visited.add(root);
    parts.push("</li>");
    return parts;
};

tree.get("/tree/:id", async (ctx) => {
    const { id } = ctx.params;
    let person = null;
    let data = null;

    if (id === "all") {
        data = await query.graph();
    } else {
        const personNode = getPersonURI(id);
        person = personNode.value;
        data = await query.graph(personNode);

        if (!(person in data)) {
            ctx.throw(404, "Person not found");
            return;
        }
    }

    switch (ctx.request.accepts("text/html", "application/json")) {
        case "text/html":
            const html = forestToHTML(data, person, new Set()).join("");
            ctx.response.body = html;
            ctx.response.type = "text/html";
            break;

        case "application/json":
            ctx.response.headers.set("access-control-allow-origin", "*");
            ctx.response.body = JSON.stringify(data);
            ctx.response.type = "application/json";
            break;
    }
});
