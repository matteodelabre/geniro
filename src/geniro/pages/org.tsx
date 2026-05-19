import { Router } from "@oak/oak";
import { errors } from "@oak/commons/http_errors";
import render from "../render.tsx";
import * as query from "../data/query.ts";
import { geniroAffiliationRoleLabel, getOrganizationURI } from "../data/model.ts";
import { renderTable, uriToUrl } from "./util.tsx";
import { projectsBaseKey } from "./person.tsx";

export const org = new Router();

const renderOrg = (orgData, projectsData) => ({
    title: <>{orgData.prefLabel}</>,
    content: (
        <>
            <h2>{orgData.prefLabel}</h2>

            <h3>Membres</h3>
            {renderTable(orgData.members, {
                member: {
                    label: "Membre",
                    display: (_, row) => (
                        <a href={uriToUrl(row.uri)}>
                            {row.firstName} {row.lastName}
                        </a>
                    ),
                },
                role: {
                    label: "Rôle",
                    display: geniroAffiliationRoleLabel,
                },
                dateStart: { label: "Date de début" },
                dateEnd: { label: "Date de fin" },
            })}

            <h3>Projets</h3>
            {renderTable(Object.values(projectsData), projectsBaseKey)}
        </>
    ),
});

org.get("/:id", async (ctx) => {
    const { id } = ctx.params;
    const uri = getOrganizationURI(id);

    const orgData = await query.org(uri);

    if (!orgData) {
        throw new errors.NotFound(
            "L’organisme demandé n’existe pas dans la base de données.",
            { expose: false },
        );
    }

    const projectsData = await query.projects({ grantors: [uri] });

    switch (ctx.request.accepts("text/html", "application/json")) {
        case "text/html":
            render(ctx, renderOrg(orgData, projectsData));
            break;

        case "application/json":
            ctx.response.type = "json";
            ctx.response.body = {
                org: orgData,
                projects: projectsData,
            };
            ctx.response.headers.set("access-control-allow-origin", "*");
            break;
    }
});
