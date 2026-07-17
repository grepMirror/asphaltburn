from fastapi import APIRouter, HTTPException, Query
from datetime import datetime, timedelta, time as dt_time, timezone
from typing import Any, Optional
from service.garmin_client_connect import GarminClientConnect
from service.acwr_service import compute_acwr_metrics, compute_acwr_series
import os
from dotenv import load_dotenv

router = APIRouter(prefix="/api/garmin")

load_dotenv()

# In a real app, these would come from a secure source or user session
# Load credentials inside a function or after load_dotenv() to be safe
def get_credentials():
    load_dotenv()
    return os.getenv("GARMIN_EMAIL"), os.getenv("GARMIN_PASSWORD")


def _utc_naive(dt: datetime) -> datetime:
    if dt.tzinfo is None:
        return dt
    return dt.astimezone(timezone.utc).replace(tzinfo=None)


def _parse_reference_datetime(value: Optional[str]) -> datetime:
    """End of the ACWR window (inclusive), as UTC-naive for comparisons with Garmin timestamps."""
    if value is None or not str(value).strip():
        return datetime.now(timezone.utc).replace(tzinfo=None)
    s = str(value).strip()
    try:
        parsed = datetime.fromisoformat(s.replace("Z", "+00:00"))
        return _utc_naive(parsed)
    except ValueError:
        pass
    try:
        d = datetime.strptime(s[:10], "%Y-%m-%d").date()
        return datetime.combine(d, dt_time(23, 59, 59, 999000))
    except ValueError as err:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid reference_date: {value}. Use ISO-8601 datetime or YYYY-MM-DD.",
        ) from err


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


@router.get("/acwr")
async def get_acwr(
    reference_date: Optional[str] = Query(
        default=None,
        description="ISO-8601 end of ACWR window, or YYYY-MM-DD (23:59:59). Omit for now.",
    ),
    run: bool = Query(default=True),
    bike: bool = Query(default=True),
    swim: bool = Query(default=True),
) -> dict[str, Any]:
    """Acute:chronic workload ratio (7d / 28d) from HR zone-weighted load vs Garmin training load."""
    try:
        ref = _parse_reference_datetime(reference_date)
        email, password = get_credentials()
        client = GarminClientConnect(email, password)
        if not client.login():
            raise HTTPException(status_code=401, detail="Garmin login failed")

        end_d = ref.date()
        start_d = end_d - timedelta(days=90)
        activities = client.client.get_activities_by_date(
            startdate=start_d.strftime("%Y-%m-%d"),
            enddate=end_d.strftime("%Y-%m-%d"),
        )
        if activities is None:
            activities = []
        return compute_acwr_metrics(activities, ref, run=run, bike=bike, swim=swim)
    except HTTPException:
        raise
    except Exception as e:
        print(f"DEBUG Error in get_acwr: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/acwr/series")
async def get_acwr_series(
    days: int = Query(
        56,
        ge=14,
        le=120,
        description="Number of calendar days of daily ACWR points (end = today UTC).",
    ),
    run: bool = Query(default=True),
    bike: bool = Query(default=True),
    swim: bool = Query(default=True),
) -> dict[str, Any]:
    """Daily ACWR evolution (zones + Garmin) for charts."""
    try:
        email, password = get_credentials()
        client = GarminClientConnect(email, password)
        if not client.login():
            raise HTTPException(status_code=401, detail="Garmin login failed")

        today = datetime.now(timezone.utc).replace(tzinfo=None).date()
        first_series_day = today - timedelta(days=max(14, min(days, 120)) - 1)
        start_fetch = first_series_day - timedelta(days=90)

        activities = client.client.get_activities_by_date(
            startdate=start_fetch.strftime("%Y-%m-%d"),
            enddate=today.strftime("%Y-%m-%d"),
        )
        if activities is None:
            activities = []

        payload = compute_acwr_series(
            activities,
            days=max(14, min(days, 120)),
            run=run,
            bike=bike,
            swim=swim,
        )
        return payload
    except HTTPException:
        raise
    except Exception as e:
        print(f"DEBUG Error in get_acwr_series: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/activities/{activity_id}/details")
async def get_activity_details(activity_id: str):
    try:
        numeric_id = int(activity_id)
        email, password = get_credentials()
        client = GarminClientConnect(email, password)
        if not client.login():
            raise HTTPException(status_code=401, detail="Garmin login failed")

        print(f"DEBUG: Fetching details for activity {numeric_id}")
        details = client.client.get_activity_details(numeric_id)
        splits = client.client.get_activity_splits(numeric_id)

        # Optimization for Swim Activities
        llm_summary = None
        
        # Garmin sometimes puts activityType in different places, but we can reliably check the splits
        # to see if 'swimStroke' or 'averageSwimCadence' exist in any of the laps.
        is_swimming = False
        if splits and "lapDTOs" in splits:
            for lap in splits.get("lapDTOs", []):
                if "swimStroke" in lap or "averageSwimCadence" in lap:
                    is_swimming = True
                    break

        if is_swimming:
            llm_summary = summarize_swim_activity(details, splits)

        return {
            "details": details,
            "splits": splits,
            "llmSummary": llm_summary
        }
    except Exception as e:
        print(f"DEBUG: Error fetching Garmin details for {activity_id}: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

def summarize_swim_activity(details, splits):
    compact_laps = []
    for lap in splits.get("lapDTOs", []):
        compact_lap = {
            "startTimeGMT": lap.get("startTimeGMT"),
            "distance": lap.get("distance"),
            "duration": lap.get("duration"),
            "averageSpeed": lap.get("averageSpeed"),
            "averageHR": lap.get("averageHR"),
            "maxHR": lap.get("maxHR"),
            "averageSwimCadence": lap.get("averageSwimCadence"),
            "numberOfActiveLengths": lap.get("numberOfActiveLengths"),
            "averageStrokes": lap.get("averageStrokes"),
            "averageSWOLF": lap.get("averageSWOLF"),
            "averageStrokeDistance": lap.get("averageStrokeDistance"),
            "lapIndex": lap.get("lapIndex"),
            "swimStroke": lap.get("swimStroke"),
            "lengthDTOs": []
        }
        
        # Only keep interesting length data
        for length in lap.get("lengthDTOs", []):
            compact_length = {
                "startTimeGMT": length.get("startTimeGMT"),
                "distance": length.get("distance"),
                "duration": length.get("duration"),
                "averageSpeed": length.get("averageSpeed"),
                "averageHR": length.get("averageHR"),
                "maxHR": length.get("maxHR"),
                "totalNumberOfStrokes": length.get("totalNumberOfStrokes"),
                "averageSWOLF": length.get("averageSWOLF"),
                "lengthIndex": length.get("lengthIndex"),
                "swimStroke": length.get("swimStroke")
            }
            compact_lap["lengthDTOs"].append(compact_length)
            
        compact_laps.append(compact_lap)

    # Text summary for LLM
    text_summary = f"Swim Workout Summary (ID: {details.get('activityId')})\n"
    text_summary += "="*30 + "\n"
    for lap in compact_laps:
        dist = (lap.get('distance') or 0)
        dur = (lap.get('duration') or 0)
        idx = lap.get('lapIndex', '?')
        
        if dist > 0:
            # Overall lap pace
            pace_total_sec = (dur / (dist / 100)) if dist > 0 else 0
            pm = int(pace_total_sec // 60)
            ps = int(pace_total_sec % 60)
            text_summary += f"Set {idx}: {int(dist)}m | {int(dur//60)}:{int(dur%60):02d} | Pace: {pm}:{ps:02d}/100m | AvgHR: {lap.get('averageHR') or '?'} | SWOLF: {lap.get('averageSWOLF') or '?'}\n"
            
            # Print individual lengths
            length_dtos = lap.get('lengthDTOs', [])
            if length_dtos:
                for length in length_dtos:
                    l_dist = (length.get('distance') or 0)
                    l_dur = (length.get('duration') or 0)
                    if l_dist > 0:
                        l_pace_sec = (l_dur / (l_dist / 100))
                        l_pm = int(l_pace_sec // 60)
                        l_ps = int(l_pace_sec % 60)
                        strokes = length.get('totalNumberOfStrokes') or "?"
                        hr = length.get('averageHR') or "?"
                        stroke_type = length.get('swimStroke') or "UNKNOWN"
                        # Format clearly
                        text_summary += f"  - Length ({l_dist}m) | Time: {l_dur:.1f}s | Pace: {l_pm}:{l_ps:02d}/100m | HR: {hr} | Strokes: {strokes} | Stroke: {stroke_type}\n"
        else:
            text_summary += f"REST: {int(dur//60)}:{int(dur%60):02d} (HR: {lap.get('averageHR') or '?'})\n"
            
    return {
        "activityId": details.get("activityId"),
        "lapDTOs": compact_laps,
        "textSummary": text_summary
    }
