from collections.abc import Iterator
from bs4 import BeautifulSoup
from bs4.element import Tag
from unidecode import unidecode
from rdflib import Graph, URIRef, Literal
import datetime
import re
from . import request
from ..util import normalize_name
from ..schema import (
    geniro_root, Geniro, GeniroDegree,
    insert_person, insert_project, insert_organization
)


###
# Special cases:
#
# - No advisor/dissertation (<https://www.mathgenealogy.org/id.php?id=147797>)
# - Multiple universities award the same degree (<https://mathgenealogy.org/id.php?id=125006>)
# - "Doctoral advisor" instead of "Advisor" (<https://mathgenealogy.org/id.php?id=127962>)
# - "Judge" instead of "Advisor" (<https://www.mathgenealogy.org/id.php?id=9748>)
# - No year/degree/title for dissertation (<https://mathgenealogy.org/id.php?id=234539>)
# - Dissertation title contains the word "advisor" (<https://mathgenealogy.org/id.php?id=74313>)
###


api_root = "https://mathgenealogy.org"
mathgenealogy_uri_root = geniro_root + "/mathgenealogy"

person_uri_template = api_root + "/id.php?id=%s"
project_uri_template = "#%s"
organization_uri_template = geniro_root + "/mathgenealogy/organization/%s"

id_pattern = re.compile(r"\d+")
parts_chars = re.compile(r"\s*,\s*")
special_chars = re.compile(r"[^a-zA-Z0-9]+")

degrees = {
    "Ph. D.": GeniroDegree.phd,
    "M. Sc.": GeniroDegree.msc,
}


def get_person_uri(name):
    return URIRef(person_uri_template % normalize_name(name))


def get_project_uri(person, date):
    return person + project_uri_template % str(date.year)


def get_organization_uri(name):
    return URIRef(organization_uri_template % normalize_name(name))


def search_by_name(name) -> Iterator[URIRef]:
    name = unidecode(name).strip()
    parts = re.split(parts_chars, name)
    terms = " ".join(
        "^" + " ".join(re.split(special_chars, part)) + "$"
        for part in parts
    )

    res = request.run(
        "POST",
        api_root + "/quickSearch.php",
        data={"searchTerms": terms},
        verify=False,
    )
    assert res.status_code in (200, 302)

    if res.status_code == 302:
        target = res.headers.get("location", "")
        target_id_match = id_pattern.search(target)

        if target_id_match is not None:
            yield get_person_uri(target_id_match.group(0))

    if res.status_code == 200:
        doc = BeautifulSoup(res.content, "html.parser")

        for item in doc.select("#mainContent tr a"):
            target = item.attrs.get("href", "")
            target_id_match = id_pattern.search(target)

            if target_id_match is not None:
                yield get_person_uri(target_id_match.group(0))


def query(person_id):
    res = request.run(
        "GET",
        api_root + "/id.php",
        params={"id": person_id},
        verify=False,
    )
    assert res.status_code == 200

    doc = BeautifulSoup(res.content, "html.parser")
    return doc.find(id="mainContent")


def is_dissertation(tag):
    return tag.text.strip().startswith("Dissertation")


def is_advisor(tag):
    tag_text = tag.text.strip().lower()
    prefix, *_ = tag_text.split(":")
    return "advisor" in prefix or "judge" in prefix


def split_list(data, separator):
    try:
        pos = data.index(separator)
        yield data[:pos]
        yield from split_list(data[pos + 1:], separator)
    except ValueError:
        yield data


def normalize_whitespace(value):
    return " ".join(value.strip().split())


def query_insert_records(graph, uri: URIRef) -> list[URIRef]:
    student_id = id_pattern.search(uri).group(0)
    doc = query(student_id)

    if doc is None:
        return []

    # Insert origin node
    student_uri = get_person_uri(student_id)
    name_tag = doc.h2
    student_name = normalize_whitespace(doc.h2.text)
    insert_person(graph, uri=student_uri, name=student_name)

    # Iterate over all awarded degrees
    degree_tag = name_tag.next_sibling
    all_advisors_uris = []

    while True:
        while degree_tag is not None and degree_tag.text.strip() == "":
            degree_tag = degree_tag.find_next_sibling("div")

        if degree_tag is None or len(list(degree_tag.stripped_strings)) != 3:
            break

        degree, university, date = degree_tag.stripped_strings
        print(student_name, degree, university, date)

        degree = normalize_whitespace(degree)
        project_degree = URIRef(degrees[degree]) if degree in degrees else None

        date = re.split(special_chars, date)[0]
        project_date_end = datetime.date(year=int(date), month=1, day=1)

        organization_uri = get_organization_uri(university)
        insert_organization(graph, organization_uri, university)

        dissertation_tag = degree_tag.find_next_sibling(is_dissertation)
        project_thesis_title = (
            normalize_whitespace(dissertation_tag.find(id="thesisTitle").text) 
            or None
        )

        # Insert advisors
        advisors_tag = degree_tag.find_next_sibling(is_advisor)
        project_advisors = []

        for advisor_contents in split_list(advisors_tag.contents, Tag(name="br")):
            if not advisor_contents or len(advisor_contents) < 2:
                break

            advisor_tag = advisor_contents[1]
            advisor_id = advisor_tag.attrs["href"].split("=")[1]
            advisor_name = normalize_whitespace(advisor_tag.text)
            advisor_uri = get_person_uri(advisor_id)
            project_advisors.append(advisor_uri)

            insert_person(
                graph,
                uri=advisor_uri,
                name=advisor_name,
            )

        # Insert degree information
        project_uri = get_project_uri(student_uri, project_date_end)
        insert_project(
            graph,
            uri=project_uri,
            student=student_uri,
            awarded_by=organization_uri,
            date_end=project_date_end,
            advisors=project_advisors,
            thesis_title=project_thesis_title,
            degree=project_degree,
        )
        all_advisors_uris.extend(project_advisors)

        degree_tag = advisors_tag.next_sibling

    # Retrieve links to all students and advisors
    return all_advisors_uris


def populate(graph, base_uris):
    remain_uris = list(base_uris)
    visited_uris = set()

    while remain_uris:
        item_uri = remain_uris.pop()

        if item_uri in visited_uris:
            continue

        visited_uris.add(item_uri)

        if list(graph.predicate_objects(item_uri)):
            print("[skip]", item_uri)
            advisors_uris = [
                advisor_uri
                for project_uri in graph.subjects(Geniro.student, item_uri)
                for advisor_uri in graph.objects(project_uri, Geniro.advisor)
            ]
        else:
            advisors_uris = query_insert_records(graph, item_uri)

        for advisor_uri in advisors_uris:
            if advisor_uri not in visited_uris:
                remain_uris.append(advisor_uri)
