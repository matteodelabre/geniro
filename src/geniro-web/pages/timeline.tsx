import { Router } from "@oak/oak";
import { uriToUrl } from "./util.tsx";
import render from "../render.tsx";
import * as query from "../data/query.ts";
import { geniroAffiliationRoleLabel, getOrganizationURI } from "../data/model.ts";

const renderTimeline = (data) => (
    <>
        <h2>Membres</h2>
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
                    <td>{geniroAffiliationRoleLabel(row.role)}</td>
                    <td>{row.dateStart}</td>
                    <td>{row.dateEnd}</td>
                </tr>
            ))}
        </table>
    </>
);

export const timeline = new Router();

timeline.get("/:org", async (ctx) => {
    const { org } = ctx.params;
    const uri = getOrganizationURI(org);
    const data = await Array.fromAsync(query.timeline(uri));

    switch (ctx.request.accepts("text/html", "application/json")) {
        case "text/html":
            render(ctx, {
                title: <>Chronologie · {org}</>,
                content: renderTimeline(data),
            });
            break;

        case "application/json":
            ctx.response.type = "json";
            ctx.response.body = data;
            ctx.response.headers.set("access-control-allow-origin", "*");
            break;
    }
});
