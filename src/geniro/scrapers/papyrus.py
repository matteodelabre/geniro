from rdflib import Graph, URIRef, Literal
from xml.etree import ElementTree
import datetime
from . import request
from ..util import normalize_name
from ..schema import (
    geniro_root, GeniroDegree,
    insert_person, insert_project, insert_organization,
)


api_root = "https://umontreal.scholaris.ca"
papyrus_uri_root = geniro_root + "/papyrus"

organization_uri = URIRef(papyrus_uri_root + "/organization/DIRO")
person_uri_template = papyrus_uri_root + "/person/%s"
project_uri_template = "/project/%s"

xml_namespaces = {
    "oai": "http://www.openarchives.org/OAI/2.0/",
    "etdms": "http://www.ndltd.org/standards/metadata/etdms/1.1/",
}

degrees = {
    "D. Th.": GeniroDegree.phd,
    "Ph. D.": GeniroDegree.phd,
    "M. Sc.": GeniroDegree.msc,
    "M. Sc. A.": GeniroDegree.msc,
    "M.A.": GeniroDegree.msc,
    "M.S.I.": GeniroDegree.msc,
}


def _query_raw(verb, **kwargs):
    res = request.run(
        "GET",
        api_root + "/server/oai/request",
        params={"verb": verb, **kwargs},
    )
    assert res.status_code == 200

    data = ElementTree.fromstring(res.content)

    if (error_tag := data.find("oai:error", xml_namespaces)) is not None:
        raise RuntimeError(error_tag.text)

    return data.find(f"oai:{verb}", xml_namespaces)


def query(verb, max_results=None, **kwargs):
    results = []
    total = 0
    token = None

    while True:
        if token is not None:
            data = _query_raw(verb, resumptionToken=token)
        else:
            data = _query_raw(verb, **kwargs)

        batch = data.findall("oai:record", xml_namespaces)

        if max_results is not None and total + len(batch) >= max_results:
            yield from batch[:max_results - total]
            return

        yield from batch
        total += len(batch)

        if (
            (token_tag := data.find("oai:resumptionToken", xml_namespaces)) is not None
            and token_tag.text is not None
        ):
            token = token_tag.text
        else:
            return


def get_person_uri(name):
    return URIRef(person_uri_template % normalize_name(name))


def get_project_uri(person, date):
    return person + project_uri_template % str(date.year)


def insert_record(graph, record):
    metadata = record.find("oai:metadata", xml_namespaces)
    thesis = metadata.find("etdms:thesis", xml_namespaces)

    student_tag = thesis.find("etdms:creator", xml_namespaces)
    student_name = student_tag.text.strip()
    student_uri = get_person_uri(student_name)

    insert_person(
        graph,
        uri=student_uri,
        name=student_name,
    )

    project_advisors = []
    project_thesis_uris = ()
    project_thesis_title = None
    project_degree = None
    project_date_start = None
    project_date_end = None

    advisor_tags = thesis.findall("etdms:contributor", xml_namespaces)

    for advisor_tag in advisor_tags:
        advisor_name = advisor_tag.text.strip()
        advisor_uri = URIRef(get_person_uri(advisor_name))
        project_advisors.append(advisor_uri)

        insert_person(
            graph,
            uri=advisor_uri,
            name=advisor_name,
        )

    title_tag = thesis.find("etdms:title", xml_namespaces)
    project_thesis_title = title_tag.text.strip()

    if (identifier_tag := thesis.find("etdms:identifier", xml_namespaces)) is not None:
        project_thesis_uris = (URIRef(identifier_tag.text.strip()),)

    if (degree_tag := thesis.find("etdms:degree", xml_namespaces)) is not None:
        degree_name_tag = degree_tag.find("etdms:name", xml_namespaces)
        degree_name_value = degree_name_tag.text.strip()

        if degree_name_value in degrees:
            project_degree = URIRef(degrees[degree_name_value])

    date_tag = thesis.find("etdms:date", xml_namespaces)
    date_year = int(date_tag.text.strip())
    project_date_end = datetime.date(year=date_year, month=1, day=1)

    project_uri = get_project_uri(student_uri, project_date_end)
    insert_project(
        graph,
        uri=project_uri,
        student=student_uri,
        awarded_by=organization_uri,
        date_end=project_date_end,
        advisors=project_advisors,
        thesis_title=project_thesis_title,
        thesis_uris=project_thesis_uris,
        degree=project_degree,
    )

    return graph


def populate(graph, set="col_1866_3001", max_results=None) -> Graph:
    insert_organization(
        graph,
        organization_uri,
        "Département d’informatique et de recherche opérationnelle",
    )

    for record in query(
        "ListRecords",
        metadataPrefix="etdms",
        set=set,
        max_results=max_results,
    ):
        insert_record(graph, record)

    return graph
