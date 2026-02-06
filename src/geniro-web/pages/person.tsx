import { Router } from "@oak/oak";
import render from "../render.tsx";
import * as query from "../data/query.ts";
import {
    geniroAffiliationRoleLabel,
    geniroProjectTypeLabel,
    getPersonURI,
} from "../data/model.ts";
import { dateShowYear, renderTable, uriToUrl } from "./util.tsx";

export const person = new Router();

const projectsBaseKey = {
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

person.get("/:id", async (ctx) => {
    const { id } = ctx.params;
    const uri = getPersonURI(id);
    const personsData = await query.persons([uri]);

    if (!(uri.value in personsData)) {
        ctx.response.status = 404;
        render(ctx, {
            title: <>Personne non trouvée</>,
            content: <p>La personne demandée n’existe pas dans la base de données.</p>,
        });
        return;
    }

    const personData = personsData[uri.value];
    const advisedProjectsData = await query.projects({ advisors: [uri] });
    const studentProjectsData = await query.projects({ student: uri });

    render(ctx, {
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
                {renderTable(Object.values(advisedProjectsData), {
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
                {renderTable(Object.values(studentProjectsData), projectsBaseKey)}
            </>
        ),
    });
});
