import requests
from collections import defaultdict
from urllib.parse import urlparse
import time
import urllib3


urllib3.disable_warnings()

last_request_time = defaultdict(float)
min_delay = 2 # in seconds


base_headers = {
    "User-Agent": "Mattéo Delabre (<geniro.matteo@delab.re>)",
    "From": "geniro.matteo@delab.re",
}


def run(method, url, headers={}, **kwargs):
    parts = urlparse(url)
    then = time.monotonic()
    elapsed = then - last_request_time[parts.netloc]

    if elapsed < min_delay:
        time.sleep(min_delay - elapsed)

    now = time.monotonic()
    last_request_time[parts.netloc] = now
    headers = {**base_headers, **headers}

    print_args = {**kwargs.get("params", {}), **kwargs.get("data", {})}
    print(f"[{now}] request {method} {url} ({print_args})")

    return requests.request(
        method,
        url,
        headers=headers,
        allow_redirects=False,
        **kwargs,
    )
