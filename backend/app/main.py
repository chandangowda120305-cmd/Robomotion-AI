from contextlib import asynccontextmanager
import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.database.db import init_db
from app.api import robot, planning, simulation, pick_place, automation, history


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Initialize SQLite database tables on startup
    init_db()
    yield


app = FastAPI(
    title="RoboMotion AI API",
    description="Virtual Robotic Arm Simulation and Intelligent Motion Planning Backend",
    version="1.0.0",
    lifespan=lifespan
)

# Also explicitly ensure DB is initialized
init_db()

# Configure CORS for local development and integration
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        origin.strip()
        for origin in os.environ.get("CORS_ORIGINS", "*").split(",")
        if origin.strip()
    ],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register API Routers
app.include_router(robot.router, prefix="/api")
app.include_router(planning.router, prefix="/api")
app.include_router(simulation.router, prefix="/api")
app.include_router(pick_place.router, prefix="/api")
app.include_router(automation.router, prefix="/api")
app.include_router(history.router, prefix="/api")


@app.get("/")
def root():
    return {
        "status": "online",
        "service": "RoboMotion AI - Motion Planning & Kinematics Engine",
        "version": "1.0.0"
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True)
