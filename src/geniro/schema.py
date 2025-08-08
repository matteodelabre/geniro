import datetime
from collections.abc import Collection
from rdflib import Graph, URIRef, Literal
from rdflib.namespace import Namespace, DefinedNamespace, FOAF, RDF, ORG
import re
from unidecode import unidecode


geniro_root = "https://diro.umontreal.ca/geniro"


class Geniro(DefinedNamespace):
    _NS = Namespace(geniro_root + "#")

    Project: URIRef
    thesisTitle: URIRef
    thesisURI: URIRef
    student: URIRef
    advisor: URIRef
    degree: URIRef
    awardedBy: URIRef
    dateStart: URIRef
    dateEnd: URIRef


class GeniroDegree(DefinedNamespace):
    _NS = Namespace(geniro_root + "/Degree#")

    phd: URIRef
    msc: URIRef


def open_graph(path: str | None) -> Graph:
    graph = Graph()
    graph.bind("geniro", Geniro)

    if path is not None:
        try:
            graph.parse(path)
        except FileNotFoundError:
            pass

    return graph


class PersistedGraph:
    def __init__(self, path: str) -> None:
        self.graph = None
        self.path = path

    def __enter__(self) -> Graph:
        self.graph = open_graph(self.path)
        return self.graph

    def __exit__(self, exc_type, exc_val, exc_tb) -> None:
        self.graph.serialize(self.path, format="turtle")
        self.graph = None


def insert_person(
    graph: Graph,
    uri: URIRef,
    name: str,
) -> Graph:
    graph.set((uri, RDF.type, FOAF.Person))
    graph.set((uri, FOAF.name, Literal(name)))

    return graph


def insert_project(
    graph: Graph,
    uri: URIRef,
    student: URIRef,
    awarded_by: URIRef,
    date_end: datetime.date,
    advisors: Collection[URIRef],
    thesis_title: str | None = None,
    thesis_uris: Collection[URIRef] = (),
    degree: URIRef | None = None,
    date_start: datetime.date | None = None,
) -> Graph:
    graph.set((uri, RDF.type, Geniro.Project))
    graph.set((uri, Geniro.student, student))
    graph.add((uri, Geniro.awardedBy, awarded_by))
    graph.add((uri, Geniro.dateEnd, Literal(date_end)))

    for advisor in advisors:
        graph.add((uri, Geniro.advisor, advisor))

    for thesis_uri in thesis_uris:
        graph.add((uri, Geniro.thesisURI, thesis_uri))

    if thesis_title is not None:
        graph.set((uri, Geniro.thesisTitle, Literal(thesis_title)))

    if degree is not None:
        graph.add((uri, Geniro.degree, degree))

    if date_start is not None:
        graph.add((uri, Geniro.dateStart, Literal(date_start)))

    return graph


def insert_organization(
    graph: Graph,
    uri: URIRef,
    name: str,
    parent: URIRef | None = None,
) -> Graph:
    graph.set((uri, RDF.type, ORG.Organization))
    graph.set((uri, FOAF.name, Literal(name)))

    if parent is not None:
        graph.set((uri, ORG.subOrganizationOf, parent_org))
