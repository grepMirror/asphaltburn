import math
import os
import re

import requests

from schemas import RouteSegment, Waypoint

# Same HTTP API used by brouter-web (BRouter server GET /brouter).
_DEFAULT_BASE_URL = "https://brouter.de"
_DEFAULT_PROFILE = "hiking-mountain"


class BRouterService:
    """Route via BRouter HTTP API (brouter-web backend)."""

    BASE_URL = os.getenv("BROUTER_BASE_URL", _DEFAULT_BASE_URL).rstrip("/")
    PROFILE = os.getenv("BROUTER_PROFILE", _DEFAULT_PROFILE)
    ROUTE_URL = f"{BASE_URL}/brouter"

    _HIGHWAY_LABELS = {
        "motorway": "Autoroute",
        "trunk": "Route",
        "primary": "Route",
        "secondary": "Route",
        "tertiary": "Route",
        "residential": "Rue",
        "living_street": "Rue",
        "service": "Chemin",
        "track": "Chemin / Sentier",
        "path": "Chemin / Sentier",
        "footway": "Chemin / Sentier",
        "pedestrian": "Zone Piétonne",
        "steps": "Escaliers",
        "cycleway": "Piste Cyclable",
        "bridleway": "Chemin / Sentier",
        "unclassified": "Route",
    }

    @classmethod
    def get_route(cls, waypoints: list[Waypoint]) -> dict:
        if len(waypoints) < 2:
            return {"coordinates": [], "segments": [], "distance_km": 0.0, "road_type_summary": {}}

        lonlats = "|".join(f"{w.lng},{w.lat}" for w in waypoints)
        params = {
            "lonlats": lonlats,
            "profile": cls.PROFILE,
            "format": "geojson",
            "alternativeidx": 0,
        }

        try:
            response = requests.get(cls.ROUTE_URL, params=params, timeout=120)
            response.raise_for_status()
            feature = response.json()["features"][0]
        except requests.exceptions.ConnectionError as e:
            raise RuntimeError(
                "Impossible de joindre le service d'itinéraire. Vérifiez votre connexion internet."
            ) from e
        except requests.exceptions.Timeout as e:
            raise RuntimeError(
                "Le calcul d'itinéraire a pris trop de temps. Réessayez dans un instant."
            ) from e
        except Exception as e:
            raise RuntimeError(
                "Le calcul d'itinéraire a échoué. Réessayez ou déplacez légèrement vos points."
            ) from e

        raw_coords = feature["geometry"]["coordinates"]  # [lng, lat, elev?]
        lat_lngs = [[c[1], c[0]] for c in raw_coords]
        props = feature.get("properties", {})
        total_distance_m = float(props.get("track-length", 0))

        messages = props.get("messages") or []
        road_type_dist, labels, leg_distances = cls._labels_from_messages(messages)
        segments = cls._segments_from_labels(raw_coords, labels, leg_distances)

        summary = {k: round(v / 1000, 2) for k, v in road_type_dist.items() if v > 0}
        if not summary and total_distance_m > 0:
            summary = {"Route": round(total_distance_m / 1000, 2)}
            segments = [RouteSegment(coordinates=lat_lngs, nature="Route")]

        return {
            "coordinates": lat_lngs,
            "segments": segments,
            "distance_km": round(total_distance_m / 1000, 2),
            "road_type_summary": summary,
            "elevation_data": cls._extract_elevation(raw_coords, props),
        }

    @classmethod
    def _labels_from_messages(cls, messages: list) -> tuple[dict[str, float], list[str], list[float]]:
        if len(messages) < 2:
            return {}, [], []

        road_type_dist: dict[str, float] = {}
        labels: list[str] = []
        leg_distances: list[float] = []
        for row in messages[1:]:
            dist_m = float(row[3])
            label = cls._label_from_waytags(row[9] if len(row) > 9 else "")
            labels.append(label)
            leg_distances.append(dist_m)
            road_type_dist[label] = road_type_dist.get(label, 0.0) + dist_m
        return road_type_dist, labels, leg_distances

    @classmethod
    def _label_from_waytags(cls, waytags: str) -> str:
        match = re.search(r"(?:^|\s)highway=([^\s]+)", waytags or "")
        if not match:
            return "Route"
        return cls._HIGHWAY_LABELS.get(match.group(1), match.group(1).replace("_", " ").capitalize())

    @classmethod
    def _segments_from_labels(
        cls,
        raw_coords: list,
        labels: list[str],
        leg_distances: list[float],
    ) -> list[RouteSegment]:
        if not raw_coords or not labels:
            return []

        path_cum = [0.0]
        for i in range(1, len(raw_coords)):
            path_cum.append(path_cum[-1] + cls._haversine(
                raw_coords[i - 1][1], raw_coords[i - 1][0],
                raw_coords[i][1], raw_coords[i][0],
            ) * 1000)

        leg_bounds = [0.0]
        for dist in leg_distances:
            leg_bounds.append(leg_bounds[-1] + dist)

        vertex_labels: list[str] = []
        leg_idx = 0
        for dist in path_cum:
            while leg_idx < len(labels) - 1 and dist > leg_bounds[leg_idx + 1]:
                leg_idx += 1
            vertex_labels.append(labels[leg_idx])

        segments: list[RouteSegment] = []
        seg_start = 0
        for i in range(1, len(vertex_labels)):
            if vertex_labels[i] != vertex_labels[i - 1]:
                coords = [[raw_coords[j][1], raw_coords[j][0]] for j in range(seg_start, i + 1)]
                if len(coords) >= 2:
                    cls._append_segment(segments, coords, vertex_labels[seg_start])
                seg_start = i

        if seg_start < len(vertex_labels):
            coords = [[raw_coords[j][1], raw_coords[j][0]] for j in range(seg_start, len(vertex_labels))]
            if len(coords) >= 2:
                cls._append_segment(segments, coords, vertex_labels[seg_start])
        return segments

    @staticmethod
    def _append_segment(segments: list[RouteSegment], coords: list[list[float]], nature: str) -> None:
        if segments and segments[-1].nature == nature:
            prev = segments[-1].coordinates
            if prev[-1] == coords[0]:
                prev.extend(coords[1:])
            else:
                prev.extend(coords)
        else:
            segments.append(RouteSegment(coordinates=coords, nature=nature))

    @staticmethod
    def _extract_elevation(raw_coords: list, props: dict) -> dict:
        ascend = props.get("filtered ascend")
        if ascend is not None:
            total_gain = float(ascend)
        else:
            total_gain = float(props.get("plain-ascend") or 0)

        total_loss = 0.0
        profile = []
        cumulative_dist = 0.0

        for i, p in enumerate(raw_coords):
            z = p[2] if len(p) > 2 else 0.0
            if i > 0:
                prev = raw_coords[i - 1]
                cumulative_dist += BRouterService._haversine(prev[1], prev[0], p[1], p[0])
                z_prev = prev[2] if len(prev) > 2 else 0.0
                diff = z - z_prev
                if diff < 0:
                    total_loss += abs(diff)

            profile.append({
                "distance": round(cumulative_dist, 3),
                "elevation": z,
                "lat": p[1],
                "lng": p[0],
            })

        if total_gain <= 0:
            total_gain = 0.0
            total_loss = 0.0
            for i in range(1, len(raw_coords)):
                z1 = raw_coords[i - 1][2] if len(raw_coords[i - 1]) > 2 else 0.0
                z2 = raw_coords[i][2] if len(raw_coords[i]) > 2 else 0.0
                diff = z2 - z1
                if diff > 0:
                    total_gain += diff
                else:
                    total_loss += abs(diff)

        return {
            "gain": round(total_gain, 1),
            "loss": round(total_loss, 1),
            "profile": profile,
        }

    @staticmethod
    def _haversine(lat1, lon1, lat2, lon2):
        r = 6371.0
        dlat = math.radians(lat2 - lat1)
        dlon = math.radians(lon2 - lon1)
        a = math.sin(dlat / 2) ** 2 + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlon / 2) ** 2
        return r * (2 * math.atan2(math.sqrt(a), math.sqrt(1 - a)))


if __name__ == "__main__":
    # ponytail: smallest runnable check — public BRouter demo endpoint
    demo = BRouterService.get_route([
        Waypoint(lat=48.1011, lng=-1.6613),
        Waypoint(lat=48.1088, lng=-1.6785),
    ])
    assert demo["distance_km"] > 0
    assert len(demo["coordinates"]) >= 2
    print(f"ok distance_km={demo['distance_km']} points={len(demo['coordinates'])}")
