import re
from unidecode import unidecode


special_chars = re.compile(r"[^a-zA-Z0-9]+")


def normalize_name(name):
    if "," in name:
        name = " ".join(name.split(",")[::-1])

    name = unidecode(name).lower().strip()
    parts = re.split(special_chars, name)
    return "-".join(parts)
