"""Unit tests for ACWR zone + Garmin aggregation."""

from datetime import datetime, timedelta

from service.acwr_service import (
    compute_acwr_metrics,
    compute_acwr_series,
    session_load_garmin,
    session_load_zones,
    sport_matches,
)


def test_sport_matches():
    assert sport_matches("running", True, True, True) is True
    assert sport_matches("running", False, True, True) is False
    assert sport_matches("lap_swimming", True, True, False) is False
    assert sport_matches("road_cycling", True, False, True) is False
    assert sport_matches("hiking", False, False, False) is True


def test_session_load_zones():
    act = {
        "hrTimeInZone_1": 100,
        "hrTimeInZone_2": 200,
        "duration": 9999,
    }
    load, fb = session_load_zones(act)
    assert fb is False
    assert load == 100 * 1 + 200 * 2


def test_session_load_zones_fallback():
    act = {"duration": 3600}
    load, fb = session_load_zones(act)
    assert fb is True
    assert load == 3600


def test_session_load_garmin():
    assert session_load_garmin({}) is None
    assert session_load_garmin({"activityTrainingLoad": 108.5}) == 108.5


def test_compute_acwr_metrics_constant_daily_zone_load():
    """Synthetic: same zone load every day for 28 days -> ACWR ~ 1."""
    ref = datetime(2026, 4, 27, 23, 59, 59)
    activities = []
    for i in range(28):
        d = ref - timedelta(days=i)
        activities.append(
            {
                "startTimeLocal": d.strftime("%Y-%m-%d %H:%M:%S"),
                "activityType": {"typeKey": "running"},
                "hrTimeInZone_3": 1800,
                "activityTrainingLoad": 100,
            }
        )
    out = compute_acwr_metrics(activities, ref)
    assert out["zone"]["acute7"] > 0
    assert out["zone"]["chronic28"] > 0
    assert out["zone"]["acwr"] is not None
    assert 0.99 <= out["zone"]["acwr"] <= 1.01
    assert out["garmin"]["acwr"] is not None
    assert 0.99 <= out["garmin"]["acwr"] <= 1.01


def test_compute_acwr_metrics_acute_spike():
    """Last week heavy load -> ACWR > 1."""
    ref = datetime(2026, 4, 27, 12, 0, 0)
    activities = []
    # Days 8–27 ago: low load (20 sessions)
    for i in range(8, 28):
        d = ref - timedelta(days=i)
        activities.append(
            {
                "startTimeLocal": d.strftime("%Y-%m-%d %H:%M:%S"),
                "activityType": {"typeKey": "running"},
                "hrTimeInZone_2": 100,
                "activityTrainingLoad": 50,
            }
        )
    # Days 0–7 ago: high load spike (8 sessions)
    for i in range(0, 8):
        d = ref - timedelta(days=i)
        activities.append(
            {
                "startTimeLocal": d.strftime("%Y-%m-%d %H:%M:%S"),
                "activityType": {"typeKey": "running"},
                "hrTimeInZone_4": 3600,
                "activityTrainingLoad": 400,
            }
        )
    out = compute_acwr_metrics(activities, ref)
    assert out["zone"]["acwr"] is not None
    assert out["zone"]["acwr"] > 1.3
    assert out["garmin"]["acwr"] is not None
    assert out["garmin"]["acwr"] > 1.3


def test_compute_acwr_series_length_and_bands():
    """Series length matches days and includes interpretation bands."""
    ref = datetime(2026, 6, 15, 12, 0, 0)
    activities = [
        {
            "startTimeLocal": "2026-06-14 10:00:00",
            "activityType": {"typeKey": "running"},
            "beginTimestamp": int(datetime(2026, 6, 14, 10, 0, 0).timestamp() * 1000),
            "hrTimeInZone_3": 1800,
            "activityTrainingLoad": 100,
        },
    ]
    out = compute_acwr_series(activities, days=14, today=ref)
    assert len(out["series"]) == 14
    assert "sweetSpotMin" in out["interpretationBands"]
    assert out["series"][-1]["date"] == "2026-06-15"


def test_garmin_missing_tl_excluded():
    """Activities without TL do not contribute to Garmin sums."""
    ref = datetime(2026, 4, 27, 18, 0, 0)
    activities = [
        {
            "startTimeLocal": (ref - timedelta(days=1)).strftime("%Y-%m-%d %H:%M:%S"),
            "activityType": {"typeKey": "running"},
            "hrTimeInZone_3": 1000,
            "duration": 1000,
        },
        {
            "startTimeLocal": (ref - timedelta(days=2)).strftime("%Y-%m-%d %H:%M:%S"),
            "activityType": {"typeKey": "running"},
            "hrTimeInZone_3": 500,
            "activityTrainingLoad": 80,
            "duration": 500,
        },
    ]
    out = compute_acwr_metrics(activities, ref)
    assert out["garmin"]["sessionsTotal"] == 2
    assert out["garmin"]["sessionsWithTrainingLoad"] == 1
    assert out["garmin"]["acute7"] == 80
    assert out["garmin"]["chronic28"] == 80
