from unidecode import unidecode
from rdflib import URIRef
import re
from . import request


root = "https://www.wikidata.org/"
id_uri = "http://www.wikidata.org/entity/%s"

special_chars = re.compile(r"[^a-zA-Z0-9]+")


def search_by_name(name):
    name = unidecode(name).strip()
    terms = [
        "haswbstatement:P31=Q5",
        "haswbstatement:P108=Q392189|P69=Q392189|P184|P185",
    ] + [
        f'"{part}"'
        for part in re.split(special_chars, name)
    ]

    res = request.run(
        "GET",
        f"{root}w/api.php",
        params={
            "action": "query",
            "list": "search",
            "format": "json",
            "srsearch": " ".join(terms),
        },
    )
    assert res.status_code == 200

    for item in res.json()["query"]["search"]:
        yield URIRef(id_uri % item["title"])
