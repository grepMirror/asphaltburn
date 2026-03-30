from fastapi import APIRouter, HTTPException
from datetime import datetime, timedelta
from service.garmin_client_connect import GarminClientConnect
import os
from dotenv import load_dotenv

router = APIRouter(prefix="/api/garmin")

load_dotenv()

# In a real app, these would come from a secure source or user session
# Load credentials inside a function or after load_dotenv() to be safe
def get_credentials():
    load_dotenv()
    return os.getenv("GARMIN_EMAIL"), os.getenv("GARMIN_PASSWORD")

@router.get("/activities")
async def get_activities():
    try:
        email, password = get_credentials()
        client = GarminClientConnect(email, password)
        if not client.login():
            raise HTTPException(status_code=401, detail="Garmin login failed")

        end_date = datetime.now()
        start_date = end_date - timedelta(days=60)

        activities = client.client.get_activities_by_date(
            startdate=start_date.strftime("%Y-%m-%d"),
            enddate=end_date.strftime("%Y-%m-%d")
        )

        return activities
    except Exception as e:
        print(f"DEBUG Error in get_activities: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/activities/{activity_id}/details")
async def get_activity_details(activity_id: str):
    try:
        # Cast to int to be safe with different library versions
        numeric_id = int(activity_id)
        email, password = get_credentials()
        client = GarminClientConnect(email, password)
        if not client.login():
            raise HTTPException(status_code=401, detail="Garmin login failed")

        print(f"DEBUG: Fetching details for activity {numeric_id}")
        details = client.client.get_activity_details(numeric_id)
        splits = client.client.get_activity_splits(numeric_id)

        return {
            "details": details,
            "splits": splits
        }
    except Exception as e:
        print(f"DEBUG: Error fetching Garmin details for {activity_id}: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))
