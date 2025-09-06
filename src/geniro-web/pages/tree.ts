import { Router } from "@oak/oak/router";
import { uriToHTML } from "./util.ts";
import * as query from "../data/query.ts";
import { getPersonURI } from "../data/model.ts";

export const tree = new Router();

const treeToHTML = (index, root, dates = []) => {
    let parts = ["<li>", uriToHTML(root)];

    if (dates.length > 0) {
        parts.push(" (", dates.join(", "), ")");
    }

    if (index[root] !== undefined) {
        parts.push("<ul>");

        for (const [student, projects] of Object.entries(index[root])) {
            parts = parts.concat(treeToHTML(index, student, projects));
        }

        parts.push("</ul>");
    }

    parts.push("</li>");
    return parts;
};

tree.get("/tree/:id", async (ctx) => {
    const person = getPersonURI(ctx.params.id);
    const edges = await query.descendants(person);
    const index = {};

    for (const edge of edges) {
        if (!(edge.descendant.value in index)) {
            index[edge.descendant.value] = {};
        }

        if (!(edge.student.value in index[edge.descendant.value])) {
            index[edge.descendant.value][edge.student.value] = [];
        }

        index[edge.descendant.value][edge.student.value].push(edge.projectEndDate.value);
    }

    const html = treeToHTML(index, person.value).join("");
    ctx.response.body = html;
    ctx.response.type = "text/html";
});
