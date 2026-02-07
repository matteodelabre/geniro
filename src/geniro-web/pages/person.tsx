import { Router } from "@oak/oak";
import { errors } from "@oak/commons/http_errors";
import render from "../render.tsx";
import * as query from "../data/query.ts";
import { webRoot } from "../config.ts";
import {
    geniroAffiliationRoleLabel,
    geniroProjectTypeLabel,
    getPersonURI,
} from "../data/model.ts";
import { dateShowYear, renderTable, uriToUrl } from "./util.tsx";

export const person = new Router();

export const projectsBaseKey = {
    dateEnd: {
        label: "Date",
        display: dateShowYear,
    },
    type: {
        label: "Type",
        display: geniroProjectTypeLabel,
    },
    title: {
        label: "Titre",
        display: (title, row) => <a href={uriToUrl(row.uri)}>{title}</a>,
    },
};

const renderPerson = (id, personData, advisedProjects, studentProjects) => ({
    title: <>{personData.firstName} {personData.lastName}</>,
    content: (
        <>
            <h2>{personData.firstName} {personData.lastName}</h2>

            <h3>Affiliations</h3>
            {renderTable(personData.affiliations, {
                organization: {
                    label: "Organisme",
                    display: (org) => <a href={uriToUrl(org)}>{org}</a>,
                },
                role: {
                    label: "Rôle",
                    display: geniroAffiliationRoleLabel,
                },
                dateStart: { label: "Date de début" },
                dateEnd: { label: "Date de fin" },
            })}

            <h3>Projets encadrés</h3>
            <p>
                <a href={`${webRoot}/tree/${id}`}>Voir l’arbre de descendance →</a>
            </p>

            {renderTable(Object.values(advisedProjects), {
                ...projectsBaseKey,
                student: {
                    label: "Étudiant·e",
                    display: (_, row) => (
                        <a href={uriToUrl(row.student.uri)}>
                            {row.student.firstName} {row.student.lastName}
                        </a>
                    ),
                },
            })}

            <h3>Projets réalisés</h3>
            {renderTable(Object.values(studentProjects), projectsBaseKey)}
        </>
    ),
});

person.get("/:id", async (ctx) => {
    const { id } = ctx.params;
    const uri = getPersonURI(id);
    const personsData = await query.persons([uri]);

    if (!(uri.value in personsData)) {
        throw new errors.NotFound(
            "La personne demandée n’existe pas dans la base de données.",
            { expose: false },
        );
    }

    const personData = personsData[uri.value];
    const advisedProjects = await query.projects({ advisors: [uri] });
    const studentProjects = await query.projects({ student: uri });

    switch (ctx.request.accepts("text/html", "application/json")) {
        case "text/html":
            render(ctx, renderPerson(id, personData, advisedProjects, studentProjects));
            break;

        case "application/json":
            ctx.response.type = "json";
            ctx.response.body = {
                person: personData,
                advisedProjects,
                studentProjects,
            };
            ctx.response.headers.set("access-control-allow-origin", "*");
            break;
    }
});
