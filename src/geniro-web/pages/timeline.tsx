import { App } from "@fresh/core";
import { accepts } from "@std/http/negotiation";
import { uriToUrl } from "./util.ts";
import * as query from "../data/query.ts";
import { geniro, getOrganizationURI } from "../data/model.ts";

const roleLabel = (role) => {
    switch (role) {
        case geniro.professorRole.value:
            return "Professeur.e";

        case geniro.directorRole.value:
            return "Directeur.ice";

        default:
            return role.substring(geniro.$().value.length);
    }
};

const renderTimeline = (data) => (
    <table>
        <thead>
            <tr>
                <th>Nom complet</th>
                <th>Rôle</th>
                <th>Date de début</th>
                <th>Date de fin</th>
            </tr>
        </thead>
        {data.map((row) => (
            <tr>
                <td>
                    <a href={uriToUrl(row.personUri)}>
                        {row.firstName} {row.lastName}
                    </a>
                </td>
                <td>{roleLabel(row.role)}</td>
                <td>{row.dateStart}</td>
                <td>{row.dateEnd}</td>
            </tr>
        ))}
    </table>
);

export const timeline = new App();

timeline.get("/:org", async (ctx) => {
    const { org } = ctx.params;
    const uri = getOrganizationURI(org);
    const data = await Array.fromAsync(query.timeline(uri));

    switch (accepts(ctx.req, "text/html", "application/json")) {
        case "text/html":
            ctx.state.title = <>Chronologie · {org}</>;
            return ctx.render(renderTimeline(data));

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
