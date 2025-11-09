import { Router } from "@oak/oak/router";
import { uriToUrl } from "./util.ts";
import * as query from "../data/query.ts";
import { geniro, getPersonURI } from "../data/model.ts";
import { mainRdfNamespace } from "../config.ts";

export const tree = new Router();

const treeToHTML = (tree, root, visited, degree = null, date = null) => {
    let parts = ["<li>"];
    parts.push(
        '<a href="',
        uriToUrl(root),
        '">',
        tree[root].firstName,
        " ",
        tree[root].lastName,
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

        for (const [student, data] of Object.entries(tree)) {
            for (const project of Object.values(data.projects)) {
                if (project.advisors.includes(root)) {
                    subtree = subtree.concat(treeToHTML(
                        tree,
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
    const person = getPersonURI(ctx.params.id);
    const tree = await query.descendants(person);

    if (!(person.value in tree)) {
        ctx.throw(404, "Person not found");
        return;
    }

    switch (ctx.request.accepts("text/html", "application/json")) {
        case "text/html":
            const html = treeToHTML(tree, person.value, new Set()).join("");
            ctx.response.body = html;
            ctx.response.type = "text/html";
            break;

        case "application/json":
            ctx.response.body = JSON.stringify(tree);
            ctx.response.type = "application/json";
            break;
    }
});
