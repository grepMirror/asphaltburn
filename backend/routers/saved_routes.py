import io
import json
import os
import re
import uuid
import zipfile

from fastapi import APIRouter, HTTPException, Query, Response

from schemas import SavedRoute, SavedRouteMetadata
from service.ign_service import IGNService

router = APIRouter(prefix="/api/saved-routes")

STORAGE_DIR = "saved_routes"

if not os.path.exists(STORAGE_DIR):
    os.makedirs(STORAGE_DIR)


def _user_dir(pin: str) -> str:
    user_dir = os.path.join(STORAGE_DIR, pin)
    if not os.path.isdir(user_dir):
        raise HTTPException(status_code=401, detail="Utilisateur introuvable. Veuillez vous connecter.")
    return user_dir


@router.get("", response_model=list[SavedRouteMetadata])
async def list_routes(pin: str = Query(...)):
    user_dir = _user_dir(pin)
    routes = []
    for filename in os.listdir(user_dir):
        if filename.endswith(".json"):
            try:
                with open(os.path.join(user_dir, filename), "r", encoding="utf-8") as f:
                    data = json.load(f)
                    routes.append(SavedRouteMetadata(
                        id=data["id"],
                        name=data["name"],
                        date=data["date"],
                        distance_km=data["route_data"]["distance_km"],
                        elevation_gain_m=data["route_data"]["elevation_gain_m"],
                        trek_id=data.get("trek_id"),
                        trek_name=data.get("trek_name")
                    ))
            except Exception as e:
                print(f"Error reading {filename}: {e}")
    routes.sort(key=lambda x: x.date, reverse=True)
    return routes


def _slug_filename(name: str, max_len: int = 48) -> str:
    slug = re.sub(r"[^\w\-]+", "_", name, flags=re.UNICODE).strip("_") or "etape"
    return slug[:max_len]


def _load_trek_route_dicts(pin: str, trek_id: str) -> list[dict]:
    user_dir = _user_dir(pin)
    trek_routes: list[dict] = []
    for filename in os.listdir(user_dir):
        if not filename.endswith(".json"):
            continue
        try:
            with open(os.path.join(user_dir, filename), "r", encoding="utf-8") as f:
                data = json.load(f)
                if data.get("trek_id") == trek_id:
                    trek_routes.append(data)
        except Exception as e:
            print(f"Error reading {filename}: {e}")
    trek_routes.sort(key=lambda x: x["date"])
    return trek_routes


@router.get("/trek/{trek_id}/export-gpx-zip")
async def export_trek_gpx_zip(trek_id: str, pin: str = Query(...)):
    trek_routes = _load_trek_route_dicts(pin, trek_id)
    if not trek_routes:
        raise HTTPException(status_code=404, detail="Trek introuvable ou sans étapes")

    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:
        for i, data in enumerate(trek_routes):
            coords = (data.get("route_data") or {}).get("coordinates") or []
            name = data.get("name") or f"Etape_{i + 1}"
            slug = _slug_filename(name)
            fname = f"{i + 1:02d}-{slug}.gpx"
            gpx_xml = IGNService.generate_gpx(coords, name=name)
            zf.writestr(fname, gpx_xml.encode("utf-8"))

    buf.seek(0)
    raw_name = trek_routes[0].get("trek_name") or "trek"
    zip_base = _slug_filename(raw_name, max_len=32)
    return Response(
        content=buf.getvalue(),
        media_type="application/zip",
        headers={
            "Content-Disposition": f'attachment; filename="{zip_base}-etapes.zip"',
        },
    )


@router.get("/{route_id}", response_model=SavedRoute)
async def get_route(route_id: str, pin: str = Query(...)):
    user_dir = _user_dir(pin)
    file_path = os.path.join(user_dir, f"{route_id}.json")
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="Route not found")

    with open(file_path, "r", encoding="utf-8") as f:
        return json.load(f)


@router.post("", response_model=SavedRoute)
async def save_route(route: SavedRoute, pin: str = Query(...)):
    user_dir = _user_dir(pin)
    if not route.id or route.id == "new":
        route.id = str(uuid.uuid4())

    file_path = os.path.join(user_dir, f"{route.id}.json")
    with open(file_path, "w", encoding="utf-8") as f:
        json.dump(route.model_dump(), f, ensure_ascii=False, indent=2)

    return route


@router.delete("/{route_id}")
async def delete_route(route_id: str, pin: str = Query(...)):
    user_dir = _user_dir(pin)
    file_path = os.path.join(user_dir, f"{route_id}.json")
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="Route not found")

    os.remove(file_path)
    return {"message": "Route deleted"}


@router.get("/trek/{trek_id}", response_model=list[SavedRoute])
async def get_trek_routes(trek_id: str, pin: str = Query(...)):
    return _load_trek_route_dicts(pin, trek_id)
