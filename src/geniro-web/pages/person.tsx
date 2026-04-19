import rdf from "@rdfjs/data-model";
import { Router } from "@oak/oak";
import { errors } from "@oak/commons/http_errors";
import render from "../render.tsx";
import * as query from "../data/query.ts";
import * as update from "../data/update.ts";
import { sanitizeNamedNode } from "../data/sparql.ts";
import { webRoot } from "../config.ts";
import {
    geniro,
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
                <a href={`${webRoot}/person/${id}/edit`}>Éditer les informations</a> ·
                {" "}
                <a href={`${webRoot}/person/${id}/desc`}>Voir l’arbre de descendance</a> ·
                {" "}
                <a href={`${webRoot}/person/${id}/asc`}>Voir l’arbre d’ascendance</a>
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

            <h3>Projets réalisés</h3>
            {renderTable(Object.values(studentProjects), projectsBaseKey)}

            <h3>Projets encadrés</h3>
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

const knownSources = {
    "Mathematics Genealogy Project": {
        namespace: "http://mathgenealogy.org/id.php?id=",
        link: part => `https://mathgenealogy.org/id.php?id=${part}`,
    },
    "Papyrus": {
        namespace: "http://diro.umontreal.ca/geniro/external/umontreal.scholaris.ca/person/",
        link: part => `https://umontreal.scholaris.ca/search?query=${part}`,
    },
};

const dateFormatter = new Intl.DateTimeFormat("fr-CA");
const formatInstant = (instant) => (
    <time datetime={instant.toString()}>
        {dateFormatter.format(instant)}
    </time>
);

const formatAlias = (alias, info) => {
    let sourceId = <span class="source-id">Autre: {alias}</span>;

    for (const [name, source] of Object.entries(knownSources)) {
        if (alias.startsWith(source.namespace)) {
            const suffix = alias.slice(source.namespace.length);
            const link = source.link(suffix);
            sourceId = <a class="source-id" href={link}>{name}: {suffix}</a>;
        }
    }

    let updated = null;
    let expires = null;
    let noData = null;

    if ("updated" in info) {
        updated = (
            <>
                <br />
                Dernière mise à jour: {formatInstant(info.updated)}
            </>
        );
    }

    if ("expires" in info) {
        expires = (
            <>
                <br />
                Prochaine mise à jour: {formatInstant(info.expires)}
            </>
        );
    }

    if (!updated && !expires) {
        noData = (
            <>
                <br />
                <span class="source-nodata">
                    Aucune donnée provenant de cette source
                </span>
            </>
        );
    }

    return <>{sourceId}{updated}{expires}{noData}</>;
};

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
                    {Object.entries(aliases).map(([alias, aliasInfo]) => (
                        <tr>
                            <td>{formatAlias(alias, aliasInfo)}</td>
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
                                <select name={formInputs.alias.addType}>
                                    <option>Mathematics Genealogy Project</option>
                                    <option>Papyrus</option>
                                    <option>Autre</option>
                                </select>
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

const renderTree = (root, tree, projects, persons, visited) => {
    const badges = [];

    for (const affil of persons[root].affiliations) {
        if (affil.organization === "http://diro.umontreal.ca/geniro/org/diro") {
            const yearStart = affil.dateStart
                ? new Date(affil.dateStart).getUTCFullYear()
                : "";
            const yearEnd = affil.dateEnd ? new Date(affil.dateEnd).getUTCFullYear() : "";
            const range = `${yearStart}-${yearEnd}`;

            switch (affil.role) {
                case geniro.roleProfessor.value:
                    badges.push(`(professeur.e DIRO ${range})`);
                    break;

                case geniro.roleDirector.value:
                    badges.push(`(directeur.ice DIRO ${range})`);
                    break;
            }
        }
    }

    for (const { type: degree, dateEnd: date } of projects[root]) {
        badges.push(`(${geniroProjectTypeLabel(degree)} ${date?.split("-")?.[0]})`);
    }

    let subtree;

    if (!visited.has(root) && tree[root].length > 0) {
        subtree = (
            <ul>
                {tree[root].map((child) =>
                    renderTree(child, tree, projects, persons, visited, null, null)
                )}
            </ul>
        );
    }

    const head = (
        <>
            <a href={uriToUrl(root)}>
                {persons[root].firstName} {persons[root].lastName}
            </a>
            {" " + badges.join(" ")}
        </>
    );

    visited.add(root);

    if (subtree) {
        return (
            <li>
                <details open>
                    <summary>{head}</summary>
                    {subtree}
                </details>
            </li>
        );
    }

    return <li>{head}</li>;
};

const processProjectsForTree = async (root, projects) => {
    // Retrieve persons information
    let personsUris = new Set();
    personsUris.add(root.value);

    for (const project of Object.values(projects)) {
        personsUris.add(project.student.uri);
        personsUris = personsUris.union(new Set(Object.keys(project.advisors)));
    }

    const persons = await query.persons(Array.from(personsUris).map(rdf.namedNode));

    // Collect projects by student
    const projectsByStudent = {};

    for (const person of personsUris) {
        projectsByStudent[person] = [];
    }

    for (const project of Object.values(projects)) {
        projectsByStudent[project.student.uri].push(project);
    }

    return [persons, projectsByStudent];
};

person.get("/:id/desc", async (ctx) => {
    const { id } = ctx.params;
    const uri = getPersonURI(id);

    // Retrieve project and persons information
    const projects = await query.projects({ ancestors: [uri] });
    const [persons, projectsByStudent] = await processProjectsForTree(uri, projects);

    // Create tree
    const tree = {};

    for (const person of Object.keys(persons)) {
        tree[person] = [];
    }

    for (const project of Object.values(projects)) {
        for (const advisor of Object.values(project.advisors)) {
            if (tree[advisor.uri].indexOf(project.student.uri) === -1) {
                tree[advisor.uri].push(project.student.uri);
            }
        }
    }

    render(ctx, {
        title: (
            <>
                {persons[uri.value].firstName} {persons[uri.value].lastName} · Descendance
            </>
        ),
        content: (
            <>
                <h2>
                    Arbre de descendance de{" "}
                    <a href={`${webRoot}/person/${id}`}>
                        {persons[uri.value].firstName} {persons[uri.value].lastName}
                    </a>
                </h2>

                <ul class="tree">
                    {renderTree(uri.value, tree, projectsByStudent, persons, new Set())}
                </ul>
            </>
        ),
    });
});

person.get("/:id/asc", async (ctx) => {
    const { id } = ctx.params;
    const uri = getPersonURI(id);

    // Retrieve project and persons information
    const projects = await query.projects({ descendants: [uri] });
    const [persons, projectsByStudent] = await processProjectsForTree(uri, projects);

    // Create tree
    const tree = {};

    for (const person of Object.keys(persons)) {
        tree[person] = [];
    }

    for (const project of Object.values(projects)) {
        for (const advisor of Object.values(project.advisors)) {
            if (tree[project.student.uri].indexOf(advisor.uri) === -1) {
                tree[project.student.uri].push(advisor.uri);
            }
        }
    }

    render(ctx, {
        title: (
            <>{persons[uri.value].firstName} {persons[uri.value].lastName} · Ascendance</>
        ),
        content: (
            <>
                <h2>
                    Arbre d’ascendance de{" "}
                    <a href={`${webRoot}/person/${id}`}>
                        {persons[uri.value].firstName} {persons[uri.value].lastName}
                    </a>
                </h2>

                <ul class="tree">
                    {renderTree(uri.value, tree, projectsByStudent, persons, new Set())}
                </ul>
            </>
        ),
    });
});
