#!/usr/bin/env python3
"""Backward-compatible entry point — delegates to the engine package.

Usage:
    python main.py --target <dir> --output report.json
"""
import sys
from pathlib import Path

# Ensure src/ is on sys.path for direct `python main.py` invocation
src_path = str(Path(__file__).parent / "src")
if src_path not in sys.path:
    sys.path.insert(0, src_path)

from engine.__main__ import main

if __name__ == "__main__":
    main()
