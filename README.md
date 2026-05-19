# geniro — Projet de généalogie académique du DIRO

## Scrapers

Les scripts dans le répertoire `src/geniro/` permettent de **récupérer automatiquement les
données** concernant les professeur.e.s du DIRO et leurs étudiant.e.s au travers des bases
de données suivantes:

- [Papyrus](https://umontreal.scholaris.ca/), le répertoire des thèses et mémoires de
  l’université de Montréal, via l’API
  [OAI-PMH](https://boite-outils.bib.umontreal.ca/c.php?g=729567&p=5239477).
- [Mathematics Genealogy Project](https://mathgenealogy.org), la plus grande banque de
  données historiques sur les relations de généalogie académique en mathématiques, en
  extrayant les données à partir des pages web.
- [Wikidata](https://www.wikidata.org), qui contient les relations de supervision
  doctorales au travers des propriétés [P184](https://www.wikidata.org/wiki/Property:P184)
  et [P185](https://www.wikidata.org/wiki/Property:P185). Pour l’instant, seule la
  recherche par nom est implémentée pour cette source.

Les scripts infèrent également des liens lorsque la même personne est référencée par
plusieurs bases de données, en se basant sur une recherche par nom. Cette approche crée
des faux positifs lorsque plusieurs personnes portent des noms identiques ou similaires.
Les résultats doivent donc être manuellement validés.

Les données récupérées sont stockées sous forme de triplets au format Turtle dans des
fichiers sous le répertoire `data/`. Ce format facilite l’archivage et la relecture des
données par les humains, mais ne permet pas l’exécution efficace de requêtes.

## Schéma

Les données sont représentées en
[RDF](https://en.wikipedia.org/wiki/Resource_Description_Framework), en incorporant
l’ontologie [FOAF](http://xmlns.com/foaf/spec/) pour les données concernant les personnes
et [Organization](https://www.w3.org/TR/vocab-org/) pour celles concernant les
affiliations.

Dans la suite, l’espace de noms <https://diro.umontreal.ca/geniro#> est abrégé en le
préfixe `geniro:`. Les entités suivantes sont représentées:

- `geniro:Project` - Représente un projet terminé de maîtrise ou de doctorat pendant
  lequel une personne étudiante a été supervisée par une ou plusieurs personnes
  professeures, menant à la production d’un manuscrit et à l’octroi d’un grade
  universitaire. Au moins une des propriétés `geniro:advisor` ou `geniro:student` doit
  être liée à chaque projet.
  - `geniro:thesisTitle` (obligatoire) - Intitulé du projet, habituellement le titre du
    manuscrit déposé à la fin du projet.
  - `geniro:dateEnd` (recommandée) - Date de fin du projet.
  - `geniro:dateStart` - Date de début du projet.
  - `geniro:advisor` - Lie le projet à des entités de type `foaf:Person` qui représentent
    la ou les personnes ayant supervisé le projet.
  - `geniro:student` - Lie le projet à une entité de type `foaf:Person` qui représente la
    personne étudiante ayant réalisé le projet.
  - `geniro:degree` - Qualifie le type de grade octroyé à la fin du projet
    (<https://diro.umontreal.ca/geniro/Degree#msc> pour une maîtrise ou
    <https://diro.umontreal.ca/geniro/Degree#phd> pour un doctorat).
  - `geniro:awardedBy` - Lie le projet à l’institution de type `org:Organization` ayant
    délivré le grade universitaire associé au projet.
  - `geniro:thesisURI` - Lien vers le manuscrit associé déposé à la fin du projet.
- `foaf:Person` - Représente une personne étudiante ou professeure qui a pu réaliser ou
  superviser un ou des projets. Voir
  [la définition dans l’ontologie FOAF](http://xmlns.com/foaf/spec/#term_Person) pour la
  liste des propriétés permises.
- `org:Organization` - Représente une institution capable de délivrer des grades
  universitaires et sous laquelle des projets peuvent être réalisés. Voir
  [la définition dans l’ontologie Organization](https://www.w3.org/TR/vocab-org/#org:Organization)
  pour la liste des propriétés permises.

Les identifiants d’entités de ces trois types peuvent être reliés par des propriétés
`owl:sameAs` pour signifier que ces identifiants provenant de différentes sources de
données réfèrent à la même entité.

## Web

Dans le répertoire `src/geniro/`, un serveur et une interface web de base permettent
de requêter rapidement les données de la base de données. Ce serveur est écrit en
TypeScript avec [Deno](https://deno.com/) et interagit avec une base de données
[GraphDB](https://graphdb.ontotext.com/).

### Base de données

La **base de données** peut être lancée dans un conteneur Podman à l’aide de la commande
suivante. Les fichiers de travail seront stockés dans le répertoire `data/graphdb/` et le
service sera rendu disponible sur le port 7200.

Pour **initialiser** la base de données avec les triplets obtenus par les scrapers, créer
le répertoire `data/graphdb/` puis lancer la commande suivante:

```
podman container run -it \
    -v $PWD/graphdb-config.ttl:/graphdb-config.ttl \
    -v $PWD/geniro.ttl:/geniro.ttl \
    -v $PWD/data/graphdb:/opt/graphdb/home \
    --entrypoint /opt/graphdb/dist/bin/importrdf \
    docker.io/ontotext/graphdb:10.8.9 \
    load -Dgraphdb.home=/opt/graphdb/home \
    --config-file /graphdb-config.ttl \
    /geniro.ttl
```

Pour **lancer** la base de données par la suite, utiliser la commande suivante:

```bash
podman container run -it \
    -p 7200:7200 \
    -v $PWD/data/graphdb:/opt/graphdb/home \
    docker.io/ontotext/graphdb:10.8.9
```

Une interface web, fournie par GraphDB, permet d’inspecter l’état de la base de données et
de lancer manuellement des requêtes, à l’adresse `http://localhost:7200`.

### Serveur

Le **serveur web** peut être lancé à l’aide de la commande suivante.

```bash
deno run --allow-net --allow-env=READABLE_STREAM src/geniro/server.ts
```
