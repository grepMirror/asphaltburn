import requests
import json
import math
import gpxpy.gpx
from schemas import Waypoint, RouteSegment

class GraphHopperService:
    """
    Service to interact with self-hosted GraphHopper instance.
    """
    BASE_URL = "http://graphhopper:8989"
    ROUTE_URL = f"{BASE_URL}/route"

    @classmethod
    def get_route(cls, waypoints: list[Waypoint]) -> dict:
        """
        Calculates the route using the GraphHopper API.
        """
        if len(waypoints) < 2:
            return {"coordinates": [], "segments": [], "distance_km": 0.0, "road_type_summary": {}}

        params = {
            "point": [f"{w.lat},{w.lng}" for w in waypoints],
            "profile": "foot",
            "locale": "fr",
            "calc_points": "true",
            "points_encoded": "false",
            "elevation": "true",
            "details": ["road_class"]
        }

        # requests.get doesn't handle multiple 'point' params correctly if passed as a list of strings
        # unless we use the 'params' argument with a list of tuples or similar.
        # Actually, requests handles a list of values for the same key.

        try:
            response = requests.get(cls.ROUTE_URL, params=params)
            response.raise_for_status()
            data = response.json()

            path = data["paths"][0]
            points = path["points"]["coordinates"] # [lng, lat, elev]

            all_coordinates = [[p[1], p[0]] for p in points]
            total_distance_m = path["distance"]

            all_segments = []
            road_type_dist = {}

            # Process details (road_class, etc.) to create segments
            cls._process_details(path.get("details", {}), points, all_segments, road_type_dist)

            # Final summary in km
            summary = {k: round(v / 1000, 2) for k, v in road_type_dist.items() if v > 0}

            # Fallback if no details
            if not summary and total_distance_m > 0:
                summary = {"Route": round(total_distance_m / 1000, 2)}
                all_segments = [RouteSegment(coordinates=all_coordinates, nature="Route")]

            return {
                "coordinates": all_coordinates,
                "segments": all_segments,
                "distance_km": round(total_distance_m / 1000, 2),
                "road_type_summary": summary,
                "elevation_data": cls._extract_elevation(points) # Added for internal use
            }
        except Exception as e:
            print(f"GraphHopper Error: {e}")
            raise e

    @classmethod
    def _process_details(cls, details: dict, points: list, all_segments: list[RouteSegment], road_type_dist: dict):
        """
        Maps GraphHopper details (road_class, surface) to our RouteSegment model.
        """
        road_classes = details.get("road_class", [])
        # We'll use road_class as the primary nature for now

        for start_idx, end_idx, value in road_classes:
            segment_points = points[start_idx : end_idx + 1]
            lat_lngs = [[p[1], p[0]] for p in segment_points]

            # Map GraphHopper road_class to our labels
            label = cls._map_road_class(value)

            # Calculate distance for this segment
            dist = cls._calculate_path_distance(segment_points)
            road_type_dist[label] = road_type_dist.get(label, 0.0) + dist

            if all_segments and all_segments[-1].nature == label:
                last_seg = all_segments[-1]
                if lat_lngs[0] == last_seg.coordinates[-1]:
                    last_seg.coordinates.extend(lat_lngs[1:])
                else:
                    last_seg.coordinates.extend(lat_lngs)
            else:
                all_segments.append(RouteSegment(coordinates=lat_lngs, nature=label))

    @staticmethod
    def _map_road_class(rc: str) -> str:
        mapping = {
            "motorway": "Autoroute",
            "trunk": "Route",
            "primary": "Route",
            "secondary": "Route",
            "tertiary": "Route",
            "residential": "Rue",
            "service": "Chemin",
            "track": "Chemin / Sentier",
            "path": "Chemin / Sentier",
            "footway": "Chemin / Sentier",
            "pedestrian": "Zone Piétonne",
            "steps": "Escaliers",
            "cycleway": "Piste Cyclable"
        }
        return mapping.get(rc, rc.capitalize())

    @staticmethod
    def _calculate_path_distance(points: list) -> float:
        dist = 0.0
        for i in range(len(points) - 1):
            p1 = points[i]
            p2 = points[i+1]
            dist += GraphHopperService._haversine(p1[1], p1[0], p2[1], p2[0])
        return dist * 1000 # Convert to meters

    @staticmethod
    def _haversine(lat1, lon1, lat2, lon2):
        R = 6371.0
        dlat = math.radians(lat2 - lat1)
        dlon = math.radians(lon2 - lon1)
        a = math.sin(dlat / 2)**2 + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlon / 2)**2
        c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
        return R * c

    @staticmethod
    def _extract_elevation(points: list) -> dict:
        total_gain = 0.0
        total_loss = 0.0
        profile = []
        cumulative_dist = 0.0

        for i in range(len(points)):
            p = points[i]
            z = p[2] if len(p) > 2 else 0.0

            if i > 0:
                p_prev = points[i-1]
                dist = GraphHopperService._haversine(p_prev[1], p_prev[0], p[1], p[0])
                cumulative_dist += dist

                z_prev = p_prev[2] if len(p_prev) > 2 else 0.0
                diff = z - z_prev
                if diff > 0:
                    total_gain += diff
                else:
                    total_loss += abs(diff)

            profile.append({
                "distance": round(cumulative_dist, 3),
                "elevation": z,
                "lat": p[1],
                "lng": p[0]
            })

        return {
            "gain": round(total_gain, 1),
            "loss": round(total_loss, 1),
            "profile": profile
        }

    @classmethod
    def get_elevation_data(cls, coordinates: list[list[float]]) -> dict:
        # Since GraphHopper returns elevation with the route, we might not need this
        # or we can implement it using the /elevation endpoint if configured.
        # For now, we'll return empty if called separately, as coordinates from GH
        # already include elevation.
        return {"gain": 0.0, "loss": 0.0, "profile": []}
