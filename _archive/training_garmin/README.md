# Training mode + Garmin Connect (shelved)

Kept out of the active app. Restore only if you want the training calendar / Garmin / ACWR features back.

## What was here

- Frontend: training calendar, ACWR charts, activity details/cards/export
- Backend: `/api/garmin/*` router, Garmin Connect client, ACWR service + tests
- Dep: `garminconnect==0.3.2` (removed from `backend/requirements.txt`)
- Env: `GARMIN_EMAIL`, `GARMIN_PASSWORD` (may still be in `backend/.env`)
- CSS for these views is still in `frontend/src/index.css` (harmless if unused)

## Restore (rough)

1. Move files back to their original paths (see layout below).
2. Re-add `garminconnect==0.3.2` to `backend/requirements.txt`.
3. In `backend/main.py`: import and `include_router(garmin.router)`.
4. In `frontend/src/App.jsx`: import `TrainingPlanner` / `AcwrChartsPage`, restore `view` values `'training'` / `'acwr'`.
5. In `TopRightMenu.jsx`: restore the calendar / Entraînement buttons.

## Layout (original paths)

```
frontend/src/components/{TrainingPlanner,AcwrChartsPage,ActivityDetails,ActivityCard,ActivityExportModal}.jsx
frontend/src/utils/activityExport.js
backend/routers/garmin.py
backend/service/{garmin_client_connect,acwr_service}.py
backend/tests/{demo_garmin_connect,test_garmin,test_acwr_service}.py
backend/tests/your_data/response.json
```
