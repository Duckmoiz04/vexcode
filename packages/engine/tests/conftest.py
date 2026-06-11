"""pytest configuration — ensures engine modules are importable."""
import sys
from pathlib import Path

# Add src/ dir to sys.path so imports like `from engine.xxx import ...` work
sys.path.insert(0, str(Path(__file__).parent.parent / "src"))
