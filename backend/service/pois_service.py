import logging
import threading
import time
from typing import Optional

import requests

logger = logging.getLogger(__name__)

OVERPASS_URLS = [
    "https://maps.mail.ru/osm/tools/overpass/api/interpreter",
    "https://lz4.overpass-api.de/api/interpreter",
    "https://overpass-api.de/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter",
]

# Prefer the last mirror that answered successfully.
_last_good_url: Optional[str] = None
_last_good_lock = threading.Lock()

# Public Overpass requires an identifying User-Agent (generic python-requests → 406).
_HEADERS = {
    "User-Agent": "OpenRun/1.0 (hiking route planner; https://github.com/)",
    "Referer": "https://openrun.local/",
    "Accept": "application/json",
}

# Fail over quickly: don't wait 35s on a dead mirror.
_CONNECT_TIMEOUT = 4
_READ_TIMEOUT = 12

# Cache: normalized bbox key → {pois, fetched_at}
_CACHE: dict[str, dict] = {}
_CACHE_LOCK = threading.Lock()
_CACHE_TTL_SEC = 15 * 60  # 15 minutes
_CACHE_MAX_ENTRIES = 64
_BBOX_PRECISION = 3  # ~100 m cells — enough to reuse nearby searches


class PoiFetchError(RuntimeError):
    """Raised when Overpass cannot be reached and no usable cache exists."""


def get_outdoor_pois(min_lat: float, min_lon: float, max_lat: float, max_lon: float) -> list:
    """
    Query Overpass for hiking POIs in the full requested rectangle.
    Uses a bounded TTL cache; returns stale cache if Overpass is down.
    """
    cache_key = _bbox_cache_key(min_lat, min_lon, max_lat, max_lon)
    cached = _cache_get(cache_key)
    if cached is not None and not _is_stale(cached):
        return cached["pois"]

    try:
        pois = _fetch_from_overpass(min_lat, min_lon, max_lat, max_lon)
        _cache_set(cache_key, pois)
        return pois
    except Exception as e:
        logger.error("Error fetching POIs from Overpass: %s", e)
        if cached is not None:
            logger.warning("Serving stale POI cache for %s", cache_key)
            return cached["pois"]
        message = str(e)
        if "429" in message or "Too Many Requests" in message:
            raise PoiFetchError(
                "Le service de points d'intérêt est saturé. Réessayez dans une minute."
            ) from e
        raise PoiFetchError(
            "Impossible de charger les points d'intérêt. Réessayez dans un instant."
        ) from e


def _bbox_cache_key(min_lat: float, min_lon: float, max_lat: float, max_lon: float) -> str:
    p = _BBOX_PRECISION
    return (
        f"{round(min_lat, p)},{round(min_lon, p)},"
        f"{round(max_lat, p)},{round(max_lon, p)}"
    )


def _is_stale(entry: dict) -> bool:
    return (time.time() - entry["fetched_at"]) > _CACHE_TTL_SEC


def _cache_get(key: str) -> Optional[dict]:
    with _CACHE_LOCK:
        return _CACHE.get(key)


def _cache_set(key: str, pois: list) -> None:
    with _CACHE_LOCK:
        _CACHE[key] = {"pois": pois, "fetched_at": time.time()}
        while len(_CACHE) > _CACHE_MAX_ENTRIES:
            oldest_key = min(_CACHE.items(), key=lambda item: item[1]["fetched_at"])[0]
            del _CACHE[oldest_key]


def _build_query(bbox: str) -> str:
    # Hiking-focused: camps, potable water, viewpoints, ruins, monuments.
    # No springs / generic water_point / shelters.
    return f"""
[out:json][timeout:10];
(
  node["tourism"="camp_site"]({bbox});
  node["tourism"="caravan_site"]({bbox});
  node["tourism"="viewpoint"]({bbox});
  node["historic"="ruins"]({bbox});
  node["historic"="monument"]({bbox});
  node["historic"="memorial"]({bbox});
  node["amenity"="drinking_water"]({bbox});

  way["tourism"="camp_site"]({bbox});
  way["tourism"="caravan_site"]({bbox});
  way["tourism"="viewpoint"]({bbox});
  way["historic"="ruins"]({bbox});
  way["historic"="monument"]({bbox});
  way["historic"="memorial"]({bbox});
);
out center tags;
""".strip()


def _mirror_order() -> list[str]:
    with _last_good_lock:
        preferred = _last_good_url
    if not preferred or preferred not in OVERPASS_URLS:
        return list(OVERPASS_URLS)
    return [preferred] + [url for url in OVERPASS_URLS if url != preferred]


def _fetch_from_overpass(min_lat: float, min_lon: float, max_lat: float, max_lon: float) -> list:
    global _last_good_url

    bbox = f"{min_lat},{min_lon},{max_lat},{max_lon}"
    query = _build_query(bbox)

    last_error: Optional[Exception] = None
    data = None
    for index, url in enumerate(_mirror_order()):
        try:
            response = requests.post(
                url,
                data={"data": query},
                headers=_HEADERS,
                timeout=(_CONNECT_TIMEOUT, _READ_TIMEOUT),
            )
            if response.status_code == 429:
                # Soft backoff before trying the next mirror
                time.sleep(0.4 * (index + 1))
                response.raise_for_status()
            response.raise_for_status()
            data = response.json()
            with _last_good_lock:
                _last_good_url = url
            logger.info("POI Overpass OK via %s", url)
            break
        except Exception as e:
            last_error = e
            logger.warning("Overpass mirror failed (%s): %s", url, e)

    if data is None:
        raise RuntimeError(str(last_error) if last_error else "Overpass unavailable")

    pois = []
    seen = set()
    for element in data.get("elements", []):
        tags = element.get("tags") or {}
        category = _categorize_poi(tags)
        if not category:
            continue

        lat = element.get("lat")
        lon = element.get("lon")
        if lat is None or lon is None:
            center = element.get("center") or {}
            lat = center.get("lat")
            lon = center.get("lon")
        if lat is None or lon is None:
            continue

        osm_type = element.get("type", "node")
        osm_id = element.get("id")
        qualified_id = f"{osm_type}/{osm_id}"
        if qualified_id in seen:
            continue
        seen.add(qualified_id)

        pois.append({
            "id": qualified_id,
            "lat": lat,
            "lon": lon,
            "name": tags.get("name") or None,
            "type": category,
            "description": tags.get("description:fr") or tags.get("description") or None,
            "website": tags.get("website") or tags.get("contact:website") or None,
        })

    return pois


def _categorize_poi(tags: dict) -> Optional[str]:
    """Map OSM tags to frontend icon categories."""
    tourism = tags.get("tourism")
    if tourism in ("camp_site", "caravan_site"):
        return "camp_site"
    if tourism == "viewpoint":
        return "viewpoint"

    historic = tags.get("historic")
    if historic == "ruins":
        return "ruins"
    if historic in ("monument", "memorial"):
        return "monument"

    amenity = tags.get("amenity")
    if amenity == "drinking_water":
        return "drinking_water"

    return None
