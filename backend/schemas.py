from pydantic import BaseModel

class Waypoint(BaseModel):
    lat: float
    lng: float

class RouteSegment(BaseModel):
    coordinates: list[list[float]]
    nature: str

class RouteRequest(BaseModel):
    waypoints: list[Waypoint]

class RouteResponse(BaseModel):
    coordinates: list[list[float]]
    segments: list[RouteSegment]
    distance_km: float
    elevation_gain_m: float
    elevation_loss_m: float
    road_type_summary: dict[str, float]

class SearchResponse(BaseModel):
    name: str
    lat: float
    lng: float
