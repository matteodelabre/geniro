import rdf from "@rdfjs/data-model";
import { Router } from "@oak/oak";
import { errors } from "@oak/commons/http_errors";
import render from "../render.tsx";
import * as query from "../data/query.ts";
import * as update from "../data/update.ts";
import { sanitizeNamedNode } from "../data/sparql.ts";
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
            <p>
                <a href={`${webRoot}/person/${id}/edit`}>Éditer les informations →</a>
            </p>

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

person.all("/:id/edit", async (ctx) => {
    const { id } = ctx.params;
    const uri = getPersonURI(id);
    const data = ctx.request.body.has && await ctx.request.body.formData();

    const formInputs = {
        alias: {
            remove: "alias-remove",
            add: "alias-add",
            addValue: "alias-add-value",
        },
        merge: {
            source: "merge-source",
            submit: "merge-submit",
        },
    };

    if (data) {
        if (data.has(formInputs.alias.add)) {
            const alias = data.get(formInputs.alias.addValue);
            await update.addAliases(uri, [sanitizeNamedNode(alias)]);
        }

        if (data.has(formInputs.alias.remove)) {
            const alias = data.get(formInputs.alias.remove);
            await update.removeAliases(uri, [sanitizeNamedNode(alias)]);
        }

        if (data.has(formInputs.merge.submit)) {
            const source = data.get(formInputs.merge.source);
            await update.merge(uri, sanitizeNamedNode(source));
        }
    }

    const { aliases } = await query.aliases(uri);

    render(ctx, {
        title: <>Édition</>,
        content: (
            <>
                <p>
                    <a href={`${webRoot}/person/${id}`}>← Retour en consultation</a>
                </p>
                <h3>Sources</h3>
                <table>
                    <tr>
                        <td>{uri.value}</td>
                    </tr>
                    {aliases.map((alias) => (
                        <tr>
                            <td>{alias}</td>
                            <td>
                                <form method="POST">
                                    <button
                                        type="submit"
                                        name={formInputs.alias.remove}
                                        value={alias}
                                    >
                                        Supprimer
                                    </button>
                                </form>
                            </td>
                        </tr>
                    ))}
                    <tr>
                        <form method="POST">
                            <td>
                                <input
                                    type="url"
                                    required
                                    name={formInputs.alias.addValue}
                                />
                            </td>
                            <td>
                                <input
                                    type="submit"
                                    name={formInputs.alias.add}
                                    value="Ajouter"
                                />
                            </td>
                        </form>
                    </tr>
                </table>
                <h3>Fusion</h3>
                <form method="POST">
                    <label for={formInputs.merge.source}>Source</label>
                    <input
                        type="url"
                        name={formInputs.merge.source}
                        id={formInputs.merge.source}
                    />
                    <input
                        type="submit"
                        name={formInputs.merge.submit}
                        value="Fusionner avec la personne actuelle"
                    />
                </form>
            </>
        ),
    });
});
