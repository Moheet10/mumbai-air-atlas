import sys
from pathlib import Path

# Add repository root to Python path so backend packages import reliably in Vercel serverless environment
ROOT_DIR = Path(__file__).resolve().parent.parent
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

# Import FastAPI app from backend.app.main
from backend.app.main import app

# app is exported for Vercel Serverless Function entrypoint
