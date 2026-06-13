"""Auto-download and resolve the Opengrep binary.

On first use (or when missing), downloads the correct binary for the current
platform from GitHub Releases and caches it at ~/.vexcode/bin/opengrep.
"""

import os
import sys
import shutil
import platform
import urllib.request
import hashlib
from pathlib import Path
from typing import Optional

OPENGREP_VERSION: str = "v1.22.0"
OPENGREP_DIR: Path = Path.home() / ".vexcode" / "bin"

# GitHub release asset names per platform
_PLATFORM_ASSETS: dict = {
    ("windows", "x86_64"): "opengrep_windows_x86.exe",
    ("windows", "amd64"): "opengrep_windows_x86.exe",
    ("darwin", "x86_64"): "opengrep_osx_x86",
    ("darwin", "arm64"): "opengrep_osx_arm64",
    ("darwin", "aarch64"): "opengrep_osx_arm64",
    ("linux", "x86_64"): "opengrep_manylinux_x86",
    ("linux", "amd64"): "opengrep_manylinux_x86",
    ("linux", "aarch64"): "opengrep_manylinux_aarch64",
    ("linux", "arm64"): "opengrep_manylinux_aarch64",
}


def _get_binary_name() -> str:
    """Return the binary filename for the current platform."""
    return "opengrep.exe" if sys.platform == "win32" else "opengrep"


def _get_asset_name() -> str:
    """Map current platform to the GitHub release asset name."""
    system = platform.system().lower()
    machine = platform.machine().lower()
    key = (system, machine)
    if key not in _PLATFORM_ASSETS:
        raise RuntimeError(
            f"Unsupported platform: system={system}, machine={machine}. "
            f"Opengrep does not provide a binary for this combination."
        )
    return _PLATFORM_ASSETS[key]


def resolve_opengrep_path() -> Optional[str]:
    """Locate an existing opengrep binary.

    Checks (in order):
      1. The system PATH  (``shutil.which``)
      2. The project cache directory (``~/.vexcode/bin/``)
      3. The official install location (``~/.opengrep/cli/latest/``)

    Returns the absolute path to the binary, or *None* if not found.
    """
    # 1. System PATH
    resolved = shutil.which("opengrep")
    if resolved:
        return resolved

    # 2. Project-level cache
    cached = OPENGREP_DIR / _get_binary_name()
    if cached.is_file():
        return str(cached)

    # 3. Official Opengrep install location (from their install script)
    official = Path.home() / ".opengrep" / "cli" / "latest" / _get_binary_name()
    if official.is_file():
        return str(official)

    return None


def _download_progress_hook(block_count: int, block_size: int, total_size: int):
    """Simple progress callback for ``urllib.request.urlretrieve``."""
    if total_size > 0:
        downloaded = block_count * block_size / (1024 * 1024)
        total_mb = total_size / (1024 * 1024)
        print(
            f"\r  Downloaded {downloaded:.1f} / {total_mb:.1f} MB",
            file=sys.stderr, end="",
        )


def ensure_opengrep(version: str = OPENGREP_VERSION, force: bool = False) -> str:
    """Return a usable opengrep path, downloading the binary if necessary.

    Args:
        version: Semver tag to download (default ``OPENGREP_VERSION``).
        force: If *True*, re-download even when a binary is already present.

    Returns:
        Absolute path to the opengrep executable.

    Raises:
        RuntimeError: If the platform is unsupported or the download fails.
    """
    # Short-circuit when already installed (unless forced)
    if not force:
        existing = resolve_opengrep_path()
        if existing:
            return existing

    # Determine target
    asset = _get_asset_name()
    url = (
        f"https://github.com/opengrep/opengrep/releases/download/"
        f"{version}/{asset}"
    )
    bin_name = _get_binary_name()
    OPENGREP_DIR.mkdir(parents=True, exist_ok=True)
    dest = OPENGREP_DIR / bin_name

    print(f"Downloading Opengrep {version} for {sys.platform}...", file=sys.stderr)
    print(f"  From: {url}", file=sys.stderr)

    try:
        urllib.request.urlretrieve(url, dest, reporthook=_download_progress_hook)
        print(file=sys.stderr)  # newline after progress
    except Exception as exc:
        # Clean up partial download
        if dest.exists():
            dest.unlink()
        raise RuntimeError(f"Failed to download Opengrep from {url}: {exc}") from exc

    # Mark executable on Unix
    if sys.platform != "win32":
        dest.chmod(0o755)

    # Quick sanity: check the file is non-empty and executable
    if not dest.is_file() or dest.stat().st_size < 1024:
        dest.unlink(missing_ok=True)
        raise RuntimeError(
            f"Downloaded Opengrep binary is invalid or too small. "
            f"Please try again or install manually."
        )

    print(f"  Installed: {dest} ({dest.stat().st_size / 1024 / 1024:.1f} MB)", file=sys.stderr)
    return str(dest)


def main() -> None:
    """CLI entry point (``install-opengrep`` command)."""
    import argparse

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
    except RuntimeError as e:
        print(f"Error: {e}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
