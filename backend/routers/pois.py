from fastapi import APIRouter, HTTPException

from service.pois_service import PoiFetchError, get_outdoor_pois

router = APIRouter()


@router.get("/api/pois")
async def read_pois(min_lat: float, min_lon: float, max_lat: float, max_lon: float):
    """
    Fetch outdoor-related POIs from OSM Overpass API for the full map rectangle.
    """
    if not (-90 <= min_lat <= 90 and -90 <= max_lat <= 90):
        raise HTTPException(status_code=400, detail="Latitude invalide.")
    if not (-180 <= min_lon <= 180 and -180 <= max_lon <= 180):
        raise HTTPException(status_code=400, detail="Longitude invalide.")
    if min_lat >= max_lat or min_lon >= max_lon:
        raise HTTPException(status_code=400, detail="Bounding box invalide.")

    # Guard against huge worldwide queries that overload Overpass
    lat_span = max_lat - min_lat
    lon_span = max_lon - min_lon
    if lat_span > 2.5 or lon_span > 2.5:
        raise HTTPException(
            status_code=400,
            detail="Zone trop large. Zoomez un peu avant de rechercher des POI.",
        )

    try:
        return get_outdoor_pois(min_lat, min_lon, max_lat, max_lon)
    except PoiFetchError as e:
        raise HTTPException(status_code=502, detail=str(e)) from e
    except Exception as e:
        raise HTTPException(
            status_code=502,
            detail="Impossible de charger les points d'intérêt. Réessayez dans un instant.",
        ) from e
