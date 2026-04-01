import requests
import gpxpy.gpx
import re
import math
import json
from schemas import Waypoint, RouteSegment

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
            segment_data = cls._fetch_route_segment(waypoints[i], waypoints[i+1])

            # Global coordinates
            segment_coords = segment_data.get("geometry", {}).get("coordinates", [])
            lat_lngs = [[c[1], c[0]] for c in segment_coords]

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

        response = requests.get(cls.NAVIGATION_URL, params=params)
        response.raise_for_status()
        return response.json()

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
