from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routers import route, garmin, saved_routes
from dotenv import load_dotenv

load_dotenv()



app = FastAPI(title="Route Planner API", version="1.0.0")

# Configure CORS for the React frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # For PoC we allow all, restrict in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(route.router)
app.include_router(garmin.router)
app.include_router(saved_routes.router)

@app.get("/")
def read_root():
    return {"message": "Route Planner API is running"}
