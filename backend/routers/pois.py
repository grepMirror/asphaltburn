from fastapi import APIRouter, HTTPException
from service.pois_service import get_outdoor_pois

router = APIRouter()

@router.get("/api/pois")
async def read_pois(min_lat: float, min_lon: float, max_lat: float, max_lon: float):
    """
    Fetch outdoor-related POIs from OSM Overpass API.
    """
    pois = get_outdoor_pois(min_lat, min_lon, max_lat, max_lon)
    return pois
