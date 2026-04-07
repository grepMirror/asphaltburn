from pydantic import BaseModel

class Waypoint(BaseModel):
    lat: float
    lng: float

class RouteSegment(BaseModel):
    coordinates: list[list[float]]
    nature: str

class RouteRequest(BaseModel):
    waypoints: list[Waypoint]
    provider: str = "ign"

class ElevationPoint(BaseModel):
    distance: float
    elevation: float
    lat: float
    lng: float

class RouteResponse(BaseModel):
    coordinates: list[list[float]]
    segments: list[RouteSegment]
    distance_km: float
    elevation_gain_m: float
    elevation_loss_m: float
    elevation_profile: list[ElevationPoint]
    road_type_summary: dict[str, float]

class SearchResponse(BaseModel):
    name: str
    lat: float
    lng: float

class SavedRouteMetadata(BaseModel):
    id: str
    name: str
    date: str
    distance_km: float
    elevation_gain_m: float
    trek_id: str | None = None
    trek_name: str | None = None

class SavedRoute(BaseModel):
    id: str
    name: str
    date: str
    waypoints: list[Waypoint]
    route_data: RouteResponse
    trek_id: str | None = None
    trek_name: str | None = None
