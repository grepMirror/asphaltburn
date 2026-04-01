import os
import json
import uuid
from datetime import datetime
from fastapi import APIRouter, HTTPException
from schemas import SavedRoute, SavedRouteMetadata

router = APIRouter(prefix="/api/saved-routes")

STORAGE_DIR = "saved_routes"

if not os.path.exists(STORAGE_DIR):
    os.makedirs(STORAGE_DIR)

@router.get("", response_model=list[SavedRouteMetadata])
async def list_routes():
    routes = []
    for filename in os.listdir(STORAGE_DIR):
        if filename.endswith(".json"):
            try:
                with open(os.path.join(STORAGE_DIR, filename), "r", encoding="utf-8") as f:
                    data = json.load(f)
                    routes.append(SavedRouteMetadata(
                        id=data["id"],
                        name=data["name"],
                        date=data["date"],
                        distance_km=data["route_data"]["distance_km"],
                        elevation_gain_m=data["route_data"]["elevation_gain_m"]
                    ))
            except Exception as e:
                print(f"Error reading {filename}: {e}")
    # Sort by date descending
    routes.sort(key=lambda x: x.date, reverse=True)
    return routes

@router.get("/{route_id}", response_model=SavedRoute)
async def get_route(route_id: str):
    file_path = os.path.join(STORAGE_DIR, f"{route_id}.json")
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="Route not found")
    
    with open(file_path, "r", encoding="utf-8") as f:
        return json.load(f)

@router.post("", response_model=SavedRoute)
async def save_route(route: SavedRoute):
    # If ID is not provided or is "new", generate one
    if not route.id or route.id == "new":
        route.id = str(uuid.uuid4())
    
    file_path = os.path.join(STORAGE_DIR, f"{route.id}.json")
    with open(file_path, "w", encoding="utf-8") as f:
        json.dump(route.model_dump(), f, ensure_ascii=False, indent=2)
    
    return route

@router.delete("/{route_id}")
async def delete_route(route_id: str):
    file_path = os.path.join(STORAGE_DIR, f"{route_id}.json")
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="Route not found")
    
    os.remove(file_path)
    return {"message": "Route deleted"}
