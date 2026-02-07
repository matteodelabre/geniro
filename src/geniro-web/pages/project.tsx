import { Router } from "@oak/oak";
import { errors } from "@oak/commons/http_errors";
import render from "../render.tsx";
import * as query from "../data/query.ts";
import { geniroProjectTypeLabel, getProjectURI } from "../data/model.ts";
import { uriToUrl } from "./util.tsx";

export const project = new Router();

const renderProject = (projectData) => ({
    title: <>{projectData.title}</>,
    content: (
        <>
            <h2>{projectData.title}</h2>

            <dl>
                <dt>Type</dt>
                <dd>{geniroProjectTypeLabel(projectData.type)}</dd>

                <dt>Organisme</dt>
                <dd>
                    <a href={uriToUrl(projectData.grantedBy)}>
                        {projectData.grantedBy}
                    </a>
                </dd>

                <dt>Manuscrit</dt>
                <dd>
                    <a href={projectData.thesis}>Voir le document</a>
                </dd>

                <dt>Date de début</dt>
                <dd>{projectData.dateStart || <em>Aucune information</em>}</dd>

                <dt>Date de fin</dt>
                <dd>{projectData.dateEnd || <em>Aucune information</em>}</dd>

                <dt>Étudiant·e</dt>
                <dd>
                    <a href={uriToUrl(projectData.student.uri)}>
                        {projectData.student.firstName} {projectData.student.lastName}
                    </a>
                </dd>

                <dt>Superviseur·e·s</dt>
                <dd>
                    <ul>
                        {Object.values(projectData.advisors).map((advisor) => (
                            <li>
                                <a href={uriToUrl(advisor.uri)}>
                                    {advisor.firstName} {advisor.lastName}
                                </a>
                            </li>
                        ))}
                    </ul>
                </dd>
            </dl>
        </>
    ),
});

project.get("/:id", async (ctx) => {
    const { id } = ctx.params;
    const uri = getProjectURI(id);
    const projectsData = await query.projects({ projects: [uri] });

    if (!(uri.value in projectsData)) {
        throw new errors.NotFound(
            "Le projet demandé n’existe pas dans la base de données.",
            { expose: false },
        );
    }

    const projectData = projectsData[uri.value];

    switch (ctx.request.accepts("text/html", "application/json")) {
        case "text/html":
            render(ctx, renderProject(projectData));
            break;

        case "application/json":
            ctx.response.type = "json";
            ctx.response.body = projectData;
            ctx.response.headers.set("access-control-allow-origin", "*");
            break;
    }
});
