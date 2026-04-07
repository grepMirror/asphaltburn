import requests
import logging

logger = logging.getLogger(__name__)

OVERPASS_URL = "https://overpass-api.de/api/interpreter"

def get_outdoor_pois(min_lat: float, min_lon: float, max_lat: float, max_lon: float) -> list:
    """
    Query Overpass API for camping, shelters, and water points within a bbox.
    """
    # Optimized query for common hiking/bivouac interest points
    query = f"""
    [out:json][timeout:25];
    (
      node["tourism"~"camping|caravan_site|alpine_hut|wilderness_hut|shelter"]({min_lat},{min_lon},{max_lat},{max_lon});
      node["amenity"="drinking_water"]({min_lat},{min_lon},{max_lat},{max_lon});
      node["amenity"="shelter"]({min_lat},{min_lon},{max_lat},{max_lon});
      node["shelter_type"~"bivouac_site|rock_shelter"]({min_lat},{min_lon},{max_lat},{max_lon});
      
      way["tourism"~"camping|caravan_site|alpine_hut|wilderness_hut|shelter"]({min_lat},{min_lon},{max_lat},{max_lon});
    );
    out body;
    >;
    out skel qt;
    """
    
    try:
        response = requests.post(OVERPASS_URL, data={"data": query})
        response.raise_for_status()
        data = response.json()
        
        pois = []
        for element in data.get("elements", []):
            if element.get("type") == "node":
                tags = element.get("tags", {})
                pois.append({
                    "id": element["id"],
                    "lat": element["lat"],
                    "lon": element["lon"],
                    "name": tags.get("name", "Sans nom"),
                    "type": _categorize_poi(tags),
                    "tags": tags
                })
            # Ways are harder to represent as simple markers without centroid calculation
            # For simplicity, we start with nodes (which represent most POIs)
            
        return pois
    except Exception as e:
        logger.error(f"Error fetching POIs from Overpass: {e}")
        return []

def _categorize_poi(tags: dict) -> str:
    """Simple helper to group POIs into categories for frontend icons."""
    if "tourism" in tags:
        t = tags["tourism"]
        if t in ["camping", "caravan_site"]: return "camping"
        if t in ["alpine_hut", "wilderness_hut"]: return "shelter"
    if "amenity" in tags:
        a = tags["amenity"]
        if a == "drinking_water": return "water"
        if a == "shelter": return "shelter"
    if "shelter_type" in tags:
        return "shelter"
    return "interest"
