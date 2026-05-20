# geniro — Projet de généalogie académique du DIRO

## Données

### Schéma

Les données sont **représentées en [RDF](https://en.wikipedia.org/wiki/Resource_Description_Framework)** en utilisant le vocabulaire [Geniro](geniro.ttl).
Les personnes, qu’elles soient étudiantes ou professeures, sont représentées par des instances de `foaf:Person`, une classe de l’ontologie [FOAF](http://xmlns.com/foaf/spec/).
Les universités décernant les grades sont représentées par des instances de `org:Organization`, une classe de l’ontologie et [Organization](https://www.w3.org/TR/vocab-org/).

L’ontologie Geniro définit la classe `geniro:Project`, une sous-classe de `foaf:Project`, qui représente un projet terminé de maîtrise ou de doctorat pendant lequel une personne étudiante a été supervisée par une ou plusieurs personnes professeures, menant à la production d’un manuscrit et à l’octroi d’un grade universitaire.
Les propriétés suivantes peuvent y être associées:

- `dcterms:title` - Intitulé du projet, habituellement le titre du manuscrit déposé à la fin du projet.
- `dcterms:description` - Résumé ou description du projet mené.
- `geniro:advisor` - Lie le projet à des entités de type `foaf:Person` qui représentent la ou les personnes ayant supervisé le projet.
- `geniro:student` - Lie le projet à une entité de type `foaf:Person` qui représente la personne étudiante ayant réalisé le projet.
- `geniro:grantedBy` - Lie le projet à l’institution de type `org:Organization` ayant délivré le grade universitaire associé au projet.
- `geniro:thesis` - Lie le projet au manuscrit du mémoire ou de la thèse déposée à la fin du projet.
- `geniro:timePeriod` - Décrit la période durant laquelle le projet s’est déroulé, à l’aide de l’ontologie [Time](https://www.w3.org/TR/owl-time/).

Les sous-classes `geniro:PhDProject` et `geniro:MScProject` permettent de représenter plus spécifiquement des projets ayant mené à l’obtention d’un doctorat ou d’une maîtrise respectivement.

Les relations d’appartenance d’une personne professeure à une université sont représentées par l’intermédiaire d’instances de la classe `org:Membership` de l’ontologie Organization.
Geniro définit également une taxonomie de rôles permettant de qualifier ces relations.

### Sources

Les données concernant les personnes étudiantes et professeures ainsi que les projets et les universités peuvent être saisies manuellement. Le fichier [data/diro-org.ttl](data/diro-org.ttl) fournit d’ailleurs une base d’informations décrivant les personnes professeures du DIRO. Les entités qui y sont décrites sont également reliées à des URI externes au travers de la propriété `owl:sameAs`. **Ce sont ces relations qui déclenchent l’extraction automatique de données depuis des sources externes.**

- [Papyrus](https://umontreal.scholaris.ca/), le répertoire des thèses et mémoires de l’université de Montréal, via l’API [OAI-PMH](https://boite-outils.bib.umontreal.ca/c.php?g=729567&p=5239477).
- [Mathematics Genealogy Project](https://mathgenealogy.org), la plus grande banque de données historiques sur les relations de généalogie académique en mathématiques, via [leur API interne](https://www.mathgenealogy.org:8000/api/v2/MGP/).

Les scripts dans le répertoire `src/geniro/fetcher/` permettent de récupérer automatiquement les données associées à ces sources.
Les triplets ainsi récupérés sont considérés comme temporaires et associés à une date d’expiration au delà de laquelle ils seront automatiquement effacés et rafraîchis depuis leur source originale.

### Base de données

La **base de données** peut être lancée dans un conteneur Podman à l’aide de la commande suivante.
Les fichiers de travail seront stockés dans le répertoire `data/graphdb/` et le service sera rendu disponible sur le port 7200.

Pour **initialiser** la base de données avec les triplets obtenus par les scrapers, créer le répertoire `data/graphdb/` puis lancer la commande suivante:

```
podman container run -it \
    -v $PWD/graphdb-config.ttl:/graphdb-config.ttl \
    -v $PWD/geniro.ttl:/geniro.ttl \
    -v $PWD/data/diro-org.ttl:/diro-org.ttl \
    -v $PWD/data/graphdb:/opt/graphdb/home \
    --entrypoint /opt/graphdb/dist/bin/importrdf \
    docker.io/ontotext/graphdb:10.8.9 \
    load -Dgraphdb.home=/opt/graphdb/home \
    --config-file /graphdb-config.ttl \
    /geniro.ttl \
    /diro-org.ttl
```

Pour **lancer** la base de données par la suite, utiliser la commande suivante:

```bash
podman container run -it \
    -p 7200:7200 \
    -v $PWD/data/graphdb:/opt/graphdb/home \
    docker.io/ontotext/graphdb:10.8.9
```

Une interface web, fournie par GraphDB, permet d’inspecter l’état de la base de données et de lancer manuellement des requêtes, à l’adresse `http://localhost:7200`.

## Utilisation

### Configuration

Le projet **doit au préalable être configuré** en créant un fichier `src/geniro/config.ts`, sur la base du fichier de configuration modèle situé dans le fichier `src/geniro/config.sample.ts`.

### Serveur

Le **serveur web** fournit une interface web de base pour consulter les données ainsi qu’une API REST.
Il est écrit en TypeScript avec [Deno](https://deno.com/) et interagit avec la base de données [GraphDB](https://graphdb.ontotext.com/).
Il peut être lancé à l’aide de la commande suivante.

```bash
deno run prod
```

### Scripts

- `deno run cli fetch-oai-pmh` - Rafraîchit les données issues de Papyrus.
- `deno run cli fetch-mathgen` - Rafraîchit les données issues de MathGenealogy.
- `deno run cli fix-unidentified` - Crée des identifiants pour les entités externes. Doit être exécuté après chaque rafraîchissement de données.
