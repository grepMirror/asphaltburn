"""
ACWR (7d acute / 28d chronic) using zone-weighted load and Garmin activityTrainingLoad comparison.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timedelta, time as dt_time, timezone
from typing import Any

UTC = timezone.utc


def _utc_naive(dt: datetime) -> datetime:
    """UTC wall-clock as naive datetime (for consistent comparisons)."""
    if dt.tzinfo is None:
        return dt
    return dt.astimezone(UTC).replace(tzinfo=None)

ZONE_WEIGHTS = (1.0, 2.0, 3.0, 4.0, 5.0)
ACUTE_DAYS = 7
CHRONIC_DAYS = 28

SWEET_SPOT_MAX = 1.3
SPIKE_RISK_MIN = 1.5


def sport_matches(type_key: str, run: bool, bike: bool, swim: bool) -> bool:
    key = (type_key or "").lower()
    if "run" in key:
        return run
    if "swim" in key:
        return swim
    if "cycl" in key:
        return bike
    return True


def parse_activity_start(activity: dict[str, Any]) -> datetime | None:
    """Activity instant as UTC-naive. Prefer beginTimestamp (ms UTC) for ordering."""
    ts = activity.get("beginTimestamp")
    if ts is not None:
        try:
            sec = float(ts) / 1000.0
            return datetime.fromtimestamp(sec, tz=UTC).replace(tzinfo=None)
        except (ValueError, TypeError, OSError):
            pass

    raw = activity.get("startTimeLocal") or activity.get("startTimeGMT")
    if not raw:
        return None
    if isinstance(raw, (int, float)):
        try:
            return datetime.fromtimestamp(raw / 1000.0, tz=UTC).replace(tzinfo=None)
        except (ValueError, OSError):
            return None
    if not isinstance(raw, str):
        return None
    s = raw.strip()
    if s.endswith("Z"):
        s = s[:-1] + "+00:00"
    try:
        parsed = datetime.fromisoformat(s)
        return _utc_naive(parsed)
    except ValueError:
        pass
    for fmt in ("%Y-%m-%d %H:%M:%S", "%Y-%m-%dT%H:%M:%S"):
        try:
            naive = datetime.strptime(s[:19], fmt)
            return naive
        except ValueError:
            continue
    return None


def session_load_zones(activity: dict[str, Any]) -> tuple[float, bool]:
    """Returns (load, used_zone_fallback). Fallback: duration * 1 when no HR zone time."""
    zone_sum = 0.0
    for i in range(1, 6):
        zone_sum += float(activity.get(f"hrTimeInZone_{i}") or 0)
    if zone_sum <= 0:
        dur = float(activity.get("duration") or 0)
        return dur, True
    load = sum(
        float(activity.get(f"hrTimeInZone_{i}") or 0) * ZONE_WEIGHTS[i - 1]
        for i in range(1, 6)
    )
    return load, False


def session_load_garmin(activity: dict[str, Any]) -> float | None:
    raw = activity.get("activityTrainingLoad")
    if raw is None:
        return None
    try:
        return float(raw)
    except (TypeError, ValueError):
        return None


@dataclass
class LoadStats:
    acute7: float
    chronic28: float
    chronic_weekly: float
    acwr: float | None


def _window_chronic(reference: datetime) -> tuple[datetime, datetime]:
    """(exclusive_start, inclusive_end] for chronic: (ref - 28d, ref]."""
    return reference - timedelta(days=CHRONIC_DAYS), reference


def _window_acute(reference: datetime) -> tuple[datetime, datetime]:
    return reference - timedelta(days=ACUTE_DAYS), reference


def compute_acwr_metrics(
    activities: list[dict[str, Any]],
    reference_dt: datetime,
    run: bool = True,
    bike: bool = True,
    swim: bool = True,
) -> dict[str, Any]:
    """
    Filter by sport flags, then sum loads in (ref-7d, ref] and (ref-28d, ref].
    Chronic weekly load = chronic28_sum / 4. ACWR = acute7_sum / chronic_weekly.
    """
    reference_dt = _utc_naive(reference_dt)
    chronic_exclusive_start, ref_end = _window_chronic(reference_dt)
    acute_exclusive_start, _ = _window_acute(reference_dt)

    zone_acute = 0.0
    zone_chronic = 0.0
    garmin_acute = 0.0
    garmin_chronic = 0.0
    zone_fallback_count = 0

    chronic_sessions = 0
    chronic_sessions_with_tl = 0

    type_key_fn = lambda a: (
        (a.get("activityType") or {}).get("typeKey") or ""
    )

    for activity in activities:
        if not isinstance(activity, dict):
            continue
        if not sport_matches(type_key_fn(activity), run, bike, swim):
            continue

        start = parse_activity_start(activity)
        if start is None:
            continue
        if start > ref_end:
            continue
        if start <= chronic_exclusive_start:
            continue

        lz, fb = session_load_zones(activity)
        zone_chronic += lz
        if fb:
            zone_fallback_count += 1

        tl = session_load_garmin(activity)
        if tl is not None:
            garmin_chronic += tl

        chronic_sessions += 1
        if tl is not None:
            chronic_sessions_with_tl += 1

        if start > acute_exclusive_start:
            zone_acute += lz
            if tl is not None:
                garmin_acute += tl

    chronic_weekly_zone = zone_chronic / 4.0
    acwr_zone = zone_acute / chronic_weekly_zone if chronic_weekly_zone > 0 else None

    chronic_weekly_garmin = garmin_chronic / 4.0
    acwr_garmin = (
        garmin_acute / chronic_weekly_garmin if chronic_weekly_garmin > 0 else None
    )

    return {
        "referenceDate": ref_end.isoformat(),
        "zone": {
            "acute7": round(zone_acute, 2),
            "chronic28": round(zone_chronic, 2),
            "chronicWeekly": round(chronic_weekly_zone, 2),
            "acwr": None if acwr_zone is None else round(acwr_zone, 3),
        },
        "garmin": {
            "acute7": round(garmin_acute, 2),
            "chronic28": round(garmin_chronic, 2),
            "chronicWeekly": round(chronic_weekly_garmin, 2),
            "acwr": None if acwr_garmin is None else round(acwr_garmin, 3),
            "sessionsWithTrainingLoad": chronic_sessions_with_tl,
            "sessionsTotal": chronic_sessions,
        },
        "meta": {
            "zoneFallbackSessionCount": zone_fallback_count,
        },
        "interpretationBands": {
            "sweetSpotMin": 0.8,
            "sweetSpotMax": SWEET_SPOT_MAX,
            "spikeRiskMin": SPIKE_RISK_MIN,
        },
    }


def compute_acwr_series(
    activities: list[dict[str, Any]],
    days: int,
    run: bool = True,
    bike: bool = True,
    swim: bool = True,
    *,
    today: datetime | None = None,
) -> dict[str, Any]:
    """
    Daily ACWR at end of each calendar day (UTC date), oldest → newest.
    ``today`` optional anchor (UTC naive); defaults to current UTC calendar day end.
    """
    days = max(14, min(days, 120))
    now_anchor = today if today is not None else datetime.now(timezone.utc).replace(tzinfo=None)
    end_day = now_anchor.date()
    series: list[dict[str, Any]] = []
    bands: dict[str, float] | None = None

    for i in range(days - 1, -1, -1):
        d = end_day - timedelta(days=i)
        ref_end = datetime.combine(d, dt_time(23, 59, 59, 999000))
        m = compute_acwr_metrics(activities, ref_end, run=run, bike=bike, swim=swim)
        if bands is None:
            bands = m["interpretationBands"]
        series.append(
            {
                "date": d.isoformat(),
                "zoneAcwr": m["zone"]["acwr"],
                "garminAcwr": m["garmin"]["acwr"],
            }
        )

    return {
        "series": series,
        "interpretationBands": bands
        or {
            "sweetSpotMin": 0.8,
            "sweetSpotMax": SWEET_SPOT_MAX,
            "spikeRiskMin": SPIKE_RISK_MIN,
        },
        "daysRequested": days,
        "endDate": end_day.isoformat(),
    }
