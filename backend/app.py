from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
import sqlite3
import os
from pathlib import Path
from datetime import date

# Project folders
BASE_DIR = Path(__file__).resolve().parent.parent
FRONTEND_DIR = BASE_DIR / "frontend-new"

app = Flask(__name__)
CORS(app)

# SQLite database
DATABASE = Path(__file__).resolve().parent / "tasks.db"


def get_db():
    connection = sqlite3.connect(DATABASE)
    connection.row_factory = sqlite3.Row
    return connection


def init_db():
    with get_db() as db:
        db.execute("""
            CREATE TABLE IF NOT EXISTS tasks (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                title TEXT NOT NULL,
                description TEXT DEFAULT '',
                priority TEXT DEFAULT 'Medium',
                status TEXT DEFAULT 'Pending',
                due_date TEXT DEFAULT '',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)


def task_to_dict(row):
    task = dict(row)
    task["overdue"] = (
        bool(task["due_date"])
        and task["due_date"] < date.today().isoformat()
        and task["status"] != "Completed"
    )
    return task


# Serve the frontend
@app.route("/")
def home():
    return send_from_directory(FRONTEND_DIR, "index.html")


@app.route("/<path:filename>")
def frontend_files(filename):
    if filename in ("style.css", "script.js"):
        return send_from_directory(FRONTEND_DIR, filename)

    return jsonify({"error": "Page not found"}), 404


# Get all tasks, optionally filtered by status and search
@app.route("/api/tasks", methods=["GET"])
def get_tasks():
    status = request.args.get("status", "").strip()
    search = request.args.get("search", "").strip()

    query = "SELECT * FROM tasks WHERE 1=1"
    params = []

    if status in ["Pending", "In Progress", "Completed"]:
        query += " AND status = ?"
        params.append(status)

    if search:
        query += " AND title LIKE ?"
        params.append(f"%{search}%")

    query += " ORDER BY id DESC"

    with get_db() as db:
        rows = db.execute(query, params).fetchall()

    return jsonify([task_to_dict(row) for row in rows])


# Create a task
@app.route("/api/tasks", methods=["POST"])
def create_task():
    data = request.get_json(silent=True) or {}

    title = str(data.get("title", "")).strip()
    description = str(data.get("description", "")).strip()
    priority = data.get("priority", "Medium")
    status = data.get("status", "Pending")
    due_date = str(data.get("due_date") or "").strip()

    if not title:
        return jsonify({"error": "Task title is required"}), 400

    if priority not in ["Low", "Medium", "High"]:
        return jsonify({"error": "Invalid priority"}), 400

    if status not in ["Pending", "In Progress", "Completed"]:
        return jsonify({"error": "Invalid status"}), 400

    if due_date:
        try:
            date.fromisoformat(due_date)
        except ValueError:
            return jsonify({"error": "Invalid due date"}), 400

    with get_db() as db:
        cursor = db.execute("""
            INSERT INTO tasks
            (title, description, priority, status, due_date)
            VALUES (?, ?, ?, ?, ?)
        """, (title, description, priority, status, due_date))

        row = db.execute(
            "SELECT * FROM tasks WHERE id = ?",
            (cursor.lastrowid,)
        ).fetchone()

    return jsonify(task_to_dict(row)), 201


# Edit a task
@app.route("/api/tasks/<int:task_id>", methods=["PUT"])
def update_task(task_id):
    data = request.get_json(silent=True) or {}

    title = str(data.get("title", "")).strip()
    description = str(data.get("description", "")).strip()
    priority = data.get("priority", "Medium")
    status = data.get("status", "Pending")
    due_date = str(data.get("due_date") or "").strip()

    if not title:
        return jsonify({"error": "Task title is required"}), 400

    if priority not in ["Low", "Medium", "High"]:
        return jsonify({"error": "Invalid priority"}), 400

    if status not in ["Pending", "In Progress", "Completed"]:
        return jsonify({"error": "Invalid status"}), 400

    if due_date:
        try:
            date.fromisoformat(due_date)
        except ValueError:
            return jsonify({"error": "Invalid due date"}), 400

    with get_db() as db:
        existing = db.execute(
            "SELECT id FROM tasks WHERE id = ?", (task_id,)
        ).fetchone()

        if existing is None:
            return jsonify({"error": "Task not found"}), 404

        db.execute("""
            UPDATE tasks
            SET title = ?, description = ?, priority = ?,
                status = ?, due_date = ?
            WHERE id = ?
        """, (title, description, priority, status, due_date, task_id))

        row = db.execute(
            "SELECT * FROM tasks WHERE id = ?", (task_id,)
        ).fetchone()

    return jsonify(task_to_dict(row))


# Change task status
@app.route("/api/tasks/<int:task_id>", methods=["PATCH"])
def update_task_status(task_id):
    data = request.get_json(silent=True) or {}
    status = data.get("status")

    if status not in ["Pending", "In Progress", "Completed"]:
        return jsonify({"error": "Invalid status"}), 400

    with get_db() as db:
        existing = db.execute(
            "SELECT id FROM tasks WHERE id = ?", (task_id,)
        ).fetchone()

        if existing is None:
            return jsonify({"error": "Task not found"}), 404

        db.execute(
            "UPDATE tasks SET status = ? WHERE id = ?",
            (status, task_id)
        )

        row = db.execute(
            "SELECT * FROM tasks WHERE id = ?", (task_id,)
        ).fetchone()

    return jsonify(task_to_dict(row))


# Delete a task
@app.route("/api/tasks/<int:task_id>", methods=["DELETE"])
def delete_task(task_id):
    with get_db() as db:
        cursor = db.execute(
            "DELETE FROM tasks WHERE id = ?", (task_id,)
        )

        if cursor.rowcount == 0:
            return jsonify({"error": "Task not found"}), 404

    return jsonify({"message": "Task deleted successfully"})


# Start the server
if __name__ == "__main__":
    init_db()
    app.run(
        host="0.0.0.0",
        port=int(os.environ.get("PORT", 5000)),
        debug=False
    )
else:
    init_db()
