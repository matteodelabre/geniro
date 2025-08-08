from .schema import geniro_root, Geniro, open_graph, PersistedGraph
from .scrapers import papyrus, mathgenealogy, wikidata
from .util import normalize_name
from rdflib import Literal, URIRef
from rdflib.namespace import RDF, FOAF, OWL
from rdflib.plugins.sparql import prepareQuery
import sys


papyrus_graph_path = "data/papyrus.ttl"
links_graph_path = "data/links.ttl"
mathgenealogy_graph_path = "data/mathgenealogy.ttl"
local_neg_graph_path = "data/local-neg.ttl"


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
                print(person_uri, "==", mathgen_uri)

            for wikidata_uri in wikidata.search_by_name(name):
                links_graph.add((person_uri, OWL.sameAs, wikidata_uri))
                print(person_uri, "==", wikidata_uri)

            print()


def query_descendants(name):
    graph = (
        open_graph(papyrus_graph_path)
        + open_graph(mathgenealogy_graph_path)
        + open_graph(links_graph_path)
        - open_graph(local_neg_graph_path)
    )

    graph.update(
        """
        DELETE { ?alias ?predicate ?object . }
        INSERT { ?original ?predicate ?object . }
        WHERE {
          ?original owl:sameAs+ ?alias .
          ?alias ?predicate ?object .
        }
        """
    )
    graph.update(
        """
        DELETE { ?object ?predicate ?alias . }
        INSERT { ?object ?predicate ?original . }
        WHERE {
          ?original owl:sameAs+ ?alias .
          ?object ?predicate ?alias .
        }
        """
    )

    query = prepareQuery(
        """
        SELECT ?parentName ?studentName ?projectDate
        WHERE {
          ?base foaf:name ?name .
          ?base (^geniro:advisor/geniro:student)* ?parent .

          ?project geniro:advisor ?parent .
          ?parent foaf:name ?parentName .

          ?project geniro:student ?student .
          ?student foaf:name ?studentName .

          ?project geniro:dateEnd ?projectDate .
        }
        GROUP BY ?parent ?student ?project
        ORDER BY ?projectDate
        """,
        initNs={
            "geniro": Geniro
        }
    )

    res = graph.query(query, initBindings={"name": Literal(name)})

    for row in res:
        parent = row.parentName
        student = row.studentName
        date = row.projectDate.split("-")[0]
        print(f"{parent:>30} -[{date}]-> {student}")


if __name__ == "__main__":
    args = sys.argv[1:]

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

        case ["query_descendants", name]:
            query_descendants(name)

        case _:
            print("invalid command")
            exit(1)
