import sqlite3
import os
from typing import Generator

DB_FILE = os.path.join(os.path.dirname(__file__), "robomotion.db")


def get_db():
    conn = sqlite3.connect(DB_FILE, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    try:
        yield conn
    finally:
        conn.close()


def init_db():
    """Initializes SQLite database tables."""
    conn = sqlite3.connect(DB_FILE)
    cursor = conn.cursor()

    cursor.executescript("""
    CREATE TABLE IF NOT EXISTS robot_configs (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT,
        config_json TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS obstacle_scenes (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        obstacles_json TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS simulation_runs (
        id TEXT PRIMARY KEY,
        name TEXT,
        algorithm TEXT NOT NULL,
        success INTEGER NOT NULL,
        planning_time_ms REAL NOT NULL,
        execution_time_s REAL NOT NULL,
        path_length REAL NOT NULL,
        sampled_nodes INTEGER NOT NULL,
        collision_checks INTEGER NOT NULL,
        max_velocity REAL,
        max_acceleration REAL,
        rms_tracking_error REAL,
        details_json TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS pick_place_tasks (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        object_id TEXT,
        pick_pos_json TEXT NOT NULL,
        place_pos_json TEXT NOT NULL,
        status TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS automation_sequences (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT,
        steps_json TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS benchmark_experiments (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        num_trials INTEGER NOT NULL,
        results_json TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    """)

    conn.commit()
    conn.close()
