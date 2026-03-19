from fastapi import APIRouter, HTTPException, Response
from schemas import RouteRequest, RouteResponse, SearchResponse
from service.ign_service import IGNService

router = APIRouter(prefix="/api")

@router.post("/route", response_model=RouteResponse)
async def calculate_route(request: RouteRequest):
    try:
        # 1. Get the route path and distance
        route_data = IGNService.get_route(request.waypoints)

        # 2. Calculate elevation gain (D+) and loss (D-)
        elev_data = IGNService.get_elevation_data(route_data["coordinates"])

        return RouteResponse(
            coordinates=route_data["coordinates"],
            segments=route_data["segments"],
            distance_km=route_data["distance_km"],
            elevation_gain_m=elev_data["gain"],
            elevation_loss_m=elev_data["loss"],
            road_type_summary=route_data["road_type_summary"]
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/search", response_model=list[SearchResponse])
async def search_city(q: str):
    try:
        results = IGNService.search_location(q)
        return results
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/export/gpx")
async def export_gpx(request: RouteResponse):
    try:
        gpx_content = IGNService.generate_gpx(request.coordinates)
        return Response(
            content=gpx_content,
            media_type="application/gpx+xml",
            headers={
                "Content-Disposition": "attachment; filename=route.gpx"
            }
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
