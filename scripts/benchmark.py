#!/usr/bin/env python3
"""Benchmark VexCode scan performance for Chương 4 DATN report.

Usage:
    python scripts/benchmark.py [--target <dir>] [--output <file>]
"""

import subprocess
import time
import json
import sys
import os
from pathlib import Path


def benchmark_scan(target: str, label: str, extra_args: list = None) -> dict:
    """Run a scan and return timing + findings count."""
    tmp_output = os.path.join(os.path.dirname(__file__) or ".", ".benchmark-tmp.json")
    cmd = [sys.executable, "-m", "engine", "--target", target, "--output", tmp_output]
    if extra_args:
        cmd.extend(extra_args)

    start = time.perf_counter()
    result = subprocess.run(
        cmd, capture_output=True, text=True, timeout=300,
        cwd=os.path.join(os.path.dirname(__file__), "..", "packages", "engine"),
    )
    elapsed = time.perf_counter() - start

    findings_count = 0
    try:
        with open(tmp_output) as f:
            report = json.load(f)
            findings_count = len(report.get("findings", []))
    except (FileNotFoundError, json.JSONDecodeError):
        pass

    # Clean up temp file
    Path(tmp_output).unlink(missing_ok=True)

    return {
        "label": label,
        "time_seconds": round(elapsed, 2),
        "findings": findings_count,
        "exit_code": result.returncode,
        "error": result.stderr[:500] if result.returncode != 0 else None,
    }


def main():
    target = "."
    output = "benchmark-results.json"

    # Parse simple CLI args
    args = sys.argv[1:]
    i = 0
    while i < len(args):
        if args[i] == "--target" and i + 1 < len(args):
            target = args[i + 1]
            i += 2
        elif args[i] == "--output" and i + 1 < len(args):
            output = args[i + 1]
            i += 2
        else:
            i += 1

    results = []

    # Test 1: Full scan with mock
    results.append(benchmark_scan(target, "full-scan-mock", ["--mock-scan", "--mock-ai"]))

    # Test 2: Fast scan with mock
    results.append(benchmark_scan(target, "fast-scan-mock", ["--fast", "--mock-scan", "--mock-ai"]))

    # Test 3: Full scan with mock + no-sarif
    results.append(benchmark_scan(target, "full-no-sarif-mock", ["--mock-scan", "--mock-ai", "--no-sarif"]))

    # Summary
    print("\n" + "=" * 60)
    print("  VexCode Benchmark Results")
    print("=" * 60)
    print(f"  Target: {target}\n")
    print(f"  {'Test':<25} {'Time':<10} {'Findings':<10}")
    print(f"  {'-' * 45}")
    for r in results:
        status = "❌" if r["exit_code"] != 0 else "✓"
        print(f"  {r['label']:<23} {r['time_seconds']:<8}s {r['findings']:<8} {status}")
    print()

    # Save JSON
    with open(output, "w") as f:
        json.dump(results, f, indent=2)
    print(f"  Results saved to {output}")
    print("=" * 60)


if __name__ == "__main__":
    main()
