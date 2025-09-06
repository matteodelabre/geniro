from .schema import geniro_root, Geniro, open_graph, PersistedGraph
from .scrapers import papyrus, mathgenealogy, wikidata
from .util import normalize_name
from rdflib import Literal, URIRef
from rdflib.namespace import RDF, FOAF, OWL
from rdflib.plugins.sparql import prepareQuery
import sys
from pathlib import Path


data_path = Path("data")
papyrus_graph_path = data_path / "papyrus.ttl"
links_graph_path = data_path / "links.ttl"
mathgenealogy_graph_path = data_path / "mathgenealogy.ttl"


def load_papyrus():
    with PersistedGraph(papyrus_graph_path) as graph:
        papyrus.populate(graph)


def load_mathgenealogy(base_graph):
    base_uris = sorted({
        uri
        for uri in base_graph.objects(None, OWL.sameAs)
        if uri.startswith("https://mathgenealogy.org")
    })

    with PersistedGraph(mathgenealogy_graph_path) as graph:
        mathgenealogy.populate(graph, base_uris)


def link_persons(base_graph):
    with PersistedGraph(links_graph_path) as links_graph:
        person_uri_template = geniro_root + "/person/%s"

        for base_uri in base_graph.subjects(predicate=RDF.type, object=FOAF.Person):
            name = base_graph.value(predicate=FOAF.name, subject=base_uri)
            person_uri = URIRef(person_uri_template % normalize_name(name))

            if list(links_graph.predicate_objects(person_uri)):
                continue

            links_graph.add((person_uri, RDF.type, FOAF.Person))
            links_graph.add((person_uri, OWL.sameAs, base_uri))

            for mathgen_uri in mathgenealogy.search_by_name(name):
                links_graph.add((person_uri, OWL.sameAs, mathgen_uri))

            for wikidata_uri in wikidata.search_by_name(name):
                links_graph.add((person_uri, OWL.sameAs, wikidata_uri))


def main():
    args = sys.argv[1:]
    data_path.mkdir(parents=True, exist_ok=True)

    match args:
        case ["load_papyrus"]:
            load_papyrus()

        case ["load_mathgenealogy"]:
            load_mathgenealogy(open_graph(links_graph_path))

        case ["link_persons"]:
            link_persons(
                open_graph(papyrus_graph_path)
                + open_graph(mathgenealogy_graph_path)
            )

        case _:
            print(f"""\
Usage: geniro [load_papyrus|link_persons|load_mathgenealogy]

Available subcommands:
    - load_papyrus: Retrieve thesis data from Papyrus and insert the resulting triples
      in '{papyrus_graph_path}'.

    - link_persons: Load all databases and run full-text searches in MathGenealogy and
      Wikidata to infer links between URIs referring to the same person in different
      databases. Insert the resulting triples in '{links_graph_path}'. As this may
      create false positives when multiple persons bear the same name or similar names,
      the results from this command need to be manually validated.

    - load_mathgenealogy: Retrieve information from MathGenealogy about all persons
      whose URI is already present in '{links_graph_path}' and walk up their ascendant
      tree to retrieve all of their ancestor’s information from MathGenealogy. Insert
      the resulting triples in '{mathgenealogy_graph_path}'.
""")
            exit(1)
