# ByteMinds backend package
import sys
from pathlib import Path

# Add backend directory to sys.path so 'app' is discoverable as a top-level package
_backend_dir = str(Path(__file__).resolve().parent)
if _backend_dir not in sys.path:
    sys.path.insert(0, _backend_dir)
