import os
import re

from fastapi import APIRouter, HTTPException

router = APIRouter(prefix="/api/users")

STORAGE_DIR = "saved_routes"


def _valid_pin(pin: str) -> bool:
    return bool(re.match(r"^[a-zA-Z0-9_\-]{2,32}$", pin))


@router.get("/{pin}/exists")
async def check_user_exists(pin: str):
    if not _valid_pin(pin):
        raise HTTPException(status_code=400, detail="PIN invalide (2-32 caractères alphanumériques)")
    user_dir = os.path.join(STORAGE_DIR, pin)
    if os.path.isdir(user_dir):
        return {"exists": True}
    raise HTTPException(status_code=404, detail="Utilisateur introuvable")


@router.post("/{pin}", status_code=201)
async def create_user(pin: str):
    if not _valid_pin(pin):
        raise HTTPException(status_code=400, detail="PIN invalide (2-32 caractères alphanumériques)")
    user_dir = os.path.join(STORAGE_DIR, pin)
    if os.path.isdir(user_dir):
        raise HTTPException(status_code=409, detail="Cet utilisateur existe déjà")
    os.makedirs(user_dir, exist_ok=True)
    return {"created": True, "pin": pin}
