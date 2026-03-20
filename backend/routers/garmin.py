from fastapi import APIRouter, HTTPException
from datetime import datetime, timedelta
from service.garmin_client_connect import GarminClientConnect
import os
from dotenv import load_dotenv

router = APIRouter(prefix="/api/garmin")

load_dotenv()

# In a real app, these would come from a secure source or user session
EMAIL = os.getenv("GARMIN_EMAIL")
PASSWORD = os.getenv("GARMIN_PASSWORD")

@router.get("/activities")
async def get_activities():
    try:
        client = GarminClientConnect(EMAIL, PASSWORD)
        if not client.login():
            raise HTTPException(status_code=401, detail="Garmin login failed")

        # Fetch the last 60 days of activities to allow local navigation and comparison on the frontend
        end_date = datetime.now()
        start_date = end_date - timedelta(days=60)

        activities = client.client.get_activities_by_date(
            startdate=start_date.strftime("%Y-%m-%d"),
            enddate=end_date.strftime("%Y-%m-%d")
        )

        return activities
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/activities/{activity_id}/details")
async def get_activity_details(activity_id: str):
    try:
        client = GarminClientConnect(EMAIL, PASSWORD)
        if not client.login():
            raise HTTPException(status_code=401, detail="Garmin login failed")

        details = client.client.get_activity_details(activity_id)
        splits = client.client.get_activity_splits(activity_id)

        return {
            "details": details,
            "splits": splits
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
