import copy
import json
import math
import re
from collections import OrderedDict

import gpxpy.gpx
import requests
from schemas import Waypoint, RouteSegment

_SEGMENT_CACHE_MAX = 800


class _SegmentLRUCache:
    """LRU cache for raw IGN segment JSON keyed by rounded start/end (same legs reused when extending a trace)."""

    __slots__ = ("_max", "_data")

    def __init__(self, max_items: int = _SEGMENT_CACHE_MAX):
        self._max = max_items
        self._data: OrderedDict[str, dict] = OrderedDict()

    @staticmethod
    def _key(start: Waypoint, end: Waypoint) -> str:
        return (
            f"{start.lng:.6f},{start.lat:.6f}|"
            f"{end.lng:.6f},{end.lat:.6f}"
        )

    def get(self, start: Waypoint, end: Waypoint) -> dict | None:
        k = self._key(start, end)
        if k not in self._data:
            return None
        self._data.move_to_end(k)
        return copy.deepcopy(self._data[k])

    def set(self, start: Waypoint, end: Waypoint, value: dict) -> None:
        k = self._key(start, end)
        if k in self._data:
            self._data.move_to_end(k)
        self._data[k] = copy.deepcopy(value)
        while len(self._data) > self._max:
            self._data.popitem(last=False)


_segment_cache = _SegmentLRUCache()


class IGNService:
    """
    Main service to interact with IGN (Institut National de l'Information Géographie et Forestière) 
    Géoplateforme APIs.
    """
    NAVIGATION_URL = "https://data.geopf.fr/navigation/itineraire"
    ALTIMETRY_URL = "https://data.geopf.fr/altimetrie/1.0/calcul/alti/rest/elevation.json"
    GEOCODING_URL = "https://data.geopf.fr/geocodage/search"

    @classmethod
    def get_route(cls, waypoints: list[Waypoint]) -> dict:
        """
        Calculates the route between multiple waypoints segment by segment.
        Reverted to sequential loop for better stability (avoiding 400 errors with 'intermediates').
        """
        if len(waypoints) < 2:
            return {"coordinates": [], "segments": [], "distance_km": 0.0, "road_type_summary": {}}

        all_coordinates = []
        all_segments = []
        total_distance_m = 0.0
        road_type_dist = {}

        for i in range(len(waypoints) - 1):
            try:
                segment_data = cls._fetch_route_segment(waypoints[i], waypoints[i + 1])
            except requests.exceptions.HTTPError as e:
                status = e.response.status_code if e.response is not None else "?"
                body = (e.response.text[:500] if e.response is not None else "")
                raise RuntimeError(
                    f"IGN routing failed for segment {i + 1}→{i + 2} "
                    f"({waypoints[i].lat:.5f},{waypoints[i].lng:.5f} → "
                    f"{waypoints[i + 1].lat:.5f},{waypoints[i + 1].lng:.5f}): {status} {body}"
                ) from e

            # Global polyline: prefer full-route geometry; else stitch step geometries (some responses omit root geometry).
            lat_lngs = cls._segment_polyline_lat_lngs(segment_data)

            if i == 0:
                all_coordinates.extend(lat_lngs)
            else:
                all_coordinates.extend(lat_lngs[1:])

            total_distance_m += segment_data.get("distance", 0.0)

            # Detailed steps analysis for color-coding and summary
            cls._process_segments_and_types(segment_data, all_segments, road_type_dist)

        # Final summary
        summary = {k: round(v / 1000, 2) for k, v in road_type_dist.items() if v > 0}

        # Smart fallback if IGN data is missing
        if not summary and total_distance_m > 0:
            total_km = round(total_distance_m / 1000, 2)
            summary = {"Route": total_km}
            if all_coordinates:
               all_segments = [RouteSegment(coordinates=all_coordinates, nature="Route")]

        return {
            "coordinates": all_coordinates,
            "segments": all_segments,
            "distance_km": round(total_distance_m / 1000, 2),
            "road_type_summary": summary
        }

    @classmethod
    def _fetch_route_segment(cls, start: Waypoint, end: Waypoint) -> dict:
        constraints = [
            {"key": "itineraire_vert", "operator": "=", "value": "vrai", "constraintType": "prefer"},
            # {"key": "nature", "operator": "=", "value": "route_a_2_chaussees", "constraintType": "banned"}
            {"key": "cpx_classement_administratif", "operator": "=", "value": "chemin_rural", "constraintType": "prefer"},
            # {"key": "cpx_classement_administratif", "operator": "=", "value": "departementale", "constraintType": "banned"}
            # {"key": "cpx_classement_administratif", "operator": "=", "value": "nationale", "constraintType": "banned"},
            # {"key": "cpx_classement_administratif", "operator": "=", "value": "autoroute", "constraintType": "banned"}
        ]
        params = {
            "resource": "bdtopo-pgr",
            "start": f"{start.lng},{start.lat}",
            "end": f"{end.lng},{end.lat}",
            "profile": "pedestrian",
            "optimization": "shortest",
            "getSteps": "true",
            "waysAttributes": "name|nature|nom_1_gauche|nom_1_droite|itineraire_vert|cpx_classement_administratif",
            "geometryFormat": "geojson",
            "constraints": "|".join([json.dumps(c) for c in constraints])
            # "constraints": json.dumps(constraints)
            # "constraints": json.dumps({"key": "itineraire_vert", "operator": "=", "value": "vrai", "constraintType": "prefer"})
        }

        cached = _segment_cache.get(start, end)
        if cached is not None:
            return cached

        response = requests.get(cls.NAVIGATION_URL, params=params, timeout=60)
        response.raise_for_status()
        data = response.json()
        _segment_cache.set(start, end, data)
        return data

    @staticmethod
    def _same_lat_lng(a: list[float], b: list[float], eps: float = 1e-5) -> bool:
        return abs(a[0] - b[0]) < eps and abs(a[1] - b[1]) < eps

    @staticmethod
    def _lat_lng_from_geojson_coordinates(coords: list) -> list[list[float]]:
        return [[c[1], c[0]] for c in coords]

    @classmethod
    def _segment_polyline_lat_lngs(cls, segment_data: dict) -> list[list[float]]:
        geom = segment_data.get("geometry") or {}
        root = geom.get("coordinates") or []
        lat_lngs = cls._lat_lng_from_geojson_coordinates(root)
        if lat_lngs:
            return lat_lngs
        merged: list[list[float]] = []
        for portion in segment_data.get("portions", []):
            for step in portion.get("steps", []):
                step_coords = (step.get("geometry") or {}).get("coordinates") or []
                step_ll = cls._lat_lng_from_geojson_coordinates(step_coords)
                if not step_ll:
                    continue
                if not merged:
                    merged.extend(step_ll)
                elif cls._same_lat_lng(step_ll[0], merged[-1]):
                    merged.extend(step_ll[1:])
                else:
                    merged.extend(step_ll)
        return merged

    @classmethod
    def _process_segments_and_types(cls, data: dict, all_segments: list[RouteSegment], road_type_dist: dict[str, float]):
        """Parses steps of a portion to create RouteSegments and accumulate distances."""
        portions = data.get("portions", [])
        for portion in portions:
            steps = portion.get("steps", [])
            for step in steps:
                attrs = step.get("attributes", {})
                dist = step.get("distance", 0.0)
                step_geometry = step.get("geometry", {}).get("coordinates", [])
                step_lat_lngs = [[c[1], c[0]] for c in step_geometry]

                if not step_lat_lngs:
                    continue

                # Nature extraction & normalization
                nature = attrs.get("nature")
                if not nature:
                    # Check new attributes or fallback to name analysis
                    if attrs.get("itineraire_vert") == "vrai" or attrs.get("cpx_classement_administratif") == "chemin_rural":
                        nature = "Chemin / Sentier"
                    else:
                        name = (attrs.get("nom_1_gauche") or attrs.get("nom_1_droite") or attrs.get("name") or "").lower()
                        if any(x in name for x in ["sentier", "piste", "chemin", "parcours"]):
                            nature = "Chemin / Sentier"
                        elif any(x in name for x in ["route", "rue", "avenue", "boulevard", "quai", "place"]):
                            nature = "Route"
                        else:
                            nature = "Autre"

                norm_nature = cls._normalize_string(nature)
                mapping = {
                    "route_a_1_chaussee": "Route",
                    "route_a_2_chaussees": "Route",
                    "type_autoroutier": "Autoroute",
                    "route_empierree": "Chemin empierré",
                    "chemin": "Chemin / Sentier",
                    "sentier": "Chemin / Sentier",
                    "piste_cyclable": "Piste Cyclable",
                    "escalier": "Escaliers",
                    "bretelle": "Route",
                    "rond_point": "Route"
                }
                label = mapping.get(norm_nature, nature)

                # Accumulate for summary
                road_type_dist[label] = road_type_dist.get(label, 0.0) + dist

                # Create or Merge Segment
                if all_segments and all_segments[-1].nature == label:
                    # Merge if same nature: avoid duplicate coordinates between steps
                    last_seg = all_segments[-1]
                    # Append coordinates, skipping the first one as it's the last one of the previous step
                    if step_lat_lngs[0] == last_seg.coordinates[-1]:
                        last_seg.coordinates.extend(step_lat_lngs[1:])
                    else:
                        last_seg.coordinates.extend(step_lat_lngs)
                else:
                    all_segments.append(RouteSegment(coordinates=step_lat_lngs, nature=label))

    @staticmethod
    def _normalize_string(s: str) -> str:
        if not s: return ""
        import unicodedata
        s = unicodedata.normalize('NFD', s).encode('ascii', 'ignore').decode('utf-8')
        s = re.sub(r'[^a-zA-Z0-9]+', '_', s).lower().strip('_')
        return s

    @classmethod
    def get_elevation_data(cls, coordinates: list[list[float]]) -> dict:
        """
        Calculates total elevation gain (D+), loss (D-), and returns the full profile.
        """
        if not coordinates:
            return {"gain": 0.0, "loss": 0.0, "profile": []}

        # Sample points to balance speed vs accuracy (max 150 points for better D+/D- resolution)
        max_points = 150
        if len(coordinates) > max_points:
            step = len(coordinates) // max_points
            sampled = coordinates[::step]
            if coordinates[-1] not in sampled:
                sampled.append(coordinates[-1])
        else:
            sampled = coordinates

        lons = ",".join([str(c[1]) for c in sampled])
        lats = ",".join([str(c[0]) for c in sampled])

        params = {
            "lon": lons, "lat": lats,
            "resource": "ign_rge_alti_wld", "delimiter": ",", "indent": "false"
        }

        try:
            response = requests.get(cls.ALTIMETRY_URL, params=params)
            response.raise_for_status()
            elevations = response.json().get("elevations", [])

            total_gain = 0.0
            total_loss = 0.0
            profile = []
            cumulative_dist = 0.0

            # Calculate cumulative distances for the sampled points
            for i in range(len(sampled)):
                if i > 0:
                    p1 = sampled[i-1]
                    p2 = sampled[i]
                    cumulative_dist += cls._haversine(p1[0], p1[1], p2[0], p2[1])

                z = elevations[i].get("z", 0.0)
                profile.append({
                    "distance": round(cumulative_dist, 3),
                    "elevation": z,
                    "lat": sampled[i][0],
                    "lng": sampled[i][1]
                })

                if i > 0:
                    z1 = elevations[i-1].get("z")
                    z2 = elevations[i].get("z")
                    if z1 is not None and z2 is not None:
                        diff = z2 - z1
                        if diff > 0:
                            total_gain += diff
                        else:
                            total_loss += abs(diff)

            return {
                "gain": round(total_gain, 1),
                "loss": round(total_loss, 1),
                "profile": profile
            }
        except Exception as e:
            print(f"Elevation error: {e}")
            return {"gain": 0.0, "loss": 0.0, "profile": []}

    @staticmethod
    def _haversine(lat1, lon1, lat2, lon2):
        R = 6371.0  # Earth radius in km
        dlat = math.radians(lat2 - lat1)
        dlon = math.radians(lon2 - lon1)
        a = math.sin(dlat / 2)**2 + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlon / 2)**2
        c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
        return R * c

    @classmethod
    def search_location(cls, query: str) -> list[dict]:
        params = {"q": query, "index": "address", "limit": 5}
        try:
            response = requests.get(cls.GEOCODING_URL, params=params)
            response.raise_for_status()
            features = response.json().get("features", [])
            return [
                {
                    "name": f.get("properties", {}).get("label"),
                    "lat": f.get("geometry", {}).get("coordinates", [])[1],
                    "lng": f.get("geometry", {}).get("coordinates", [])[0]
                } for f in features
            ]
        except Exception:
            return []

    @staticmethod
    def generate_gpx(coordinates: list[list[float]], name: str = "My Route") -> str:
        gpx = gpxpy.gpx.GPX()
        track = gpxpy.gpx.GPXTrack(name=name)
        gpx.tracks.append(track)
        segment = gpxpy.gpx.GPXTrackSegment()
        track.segments.append(segment)
        for lat, lng in coordinates:
            segment.points.append(gpxpy.gpx.GPXTrackPoint(lat, lng))
        return gpx.to_xml()
