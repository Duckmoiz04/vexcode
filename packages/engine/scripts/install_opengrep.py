#!/usr/bin/env python3
"""Standalone CLI to download and install the Opengrep binary.

Usage:
    python scripts/install_opengrep.py
    python scripts/install_opengrep.py --version v1.22.0 --force
"""

import argparse
import sys
import os

# Ensure the engine package is importable when run from the repo root
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "src"))

from engine.opengrep_installer import ensure_opengrep, OPENGREP_VERSION


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Download and install the Opengrep SAST binary."
    )
    parser.add_argument(
        "--version",
        default=OPENGREP_VERSION,
        help=f"Release tag to download (default: {OPENGREP_VERSION})",
    )
    parser.add_argument(
        "--force",
        action="store_true",
        help="Re-download even if the binary already exists.",
    )
    args = parser.parse_args()

    try:
        path = ensure_opengrep(version=args.version, force=args.force)
        print(f"Opengrep is ready at: {path}", file=sys.stderr)
        sys.exit(0)
    except RuntimeError as e:
        print(f"Error: {e}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
