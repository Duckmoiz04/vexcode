import ast
import os
import sys
import logging
import lizard
from typing import Dict, Any, List, Optional, Tuple

logger = logging.getLogger(__name__)

CCN_HIGH_THRESHOLD = 25
"""Cyclomatic Complexity threshold above which a file is considered HIGH complexity."""

COGNITIVE_HIGH_THRESHOLD = 15
"""Cognitive Complexity threshold above which a file is flagged as high cognitive load."""


def _is_text_file(file_path: str, num_bytes: int = 1024) -> bool:
    """
    Detect whether a file is a text file by scanning for null bytes.
    
    Reads the first num_bytes bytes in binary mode. If a null byte (b'\\0')
    is found, the file is considered binary.
    
    Args:
        file_path: Path to the file to check.
        num_bytes: Number of bytes to read (default 1024).
        
    Returns:
        True if no null bytes were detected, False otherwise.
    """
    try:
        with open(file_path, "rb") as f:
            chunk = f.read(num_bytes)
        return b'\0' not in chunk
    except Exception:
        return False


def get_complexity_level(ccn: int) -> str:
    """
    Categorizes the cyclomatic complexity into a human-readable scale.
    """
    if ccn <= 10:
        return "LOW"
    elif ccn <= CCN_HIGH_THRESHOLD:
        return "MEDIUM"
    else:
        return "HIGH"


def gen_complexity_findings(metrics: Dict[str, Any], target: str) -> List[Dict[str, Any]]:
    """Generate findings for files with high cyclomatic complexity.

    Files with ``level == "HIGH"`` (CCN > CCN_HIGH_THRESHOLD) produce a
    ``maintainability.complexity.high-ccn`` finding each.  The message
    includes the total CCN and up to 5 high-complexity functions.

    Args:
        metrics: The metrics dict from ``_compute_metrics()``, expected to
                 contain ``metrics["files"][rel_path]`` with ``"complexity"``,
                 ``"level"`` and ``"functions"`` keys.
        target: The target directory path (unused directly, kept for API
                consistency).

    Returns:
        A list of finding dicts for source files whose CCN exceeds the
        HIGH threshold.
    """
    findings: List[Dict[str, Any]] = []
    for rel_path, file_metrics in metrics.get("files", {}).items():
        if file_metrics.get("level") != "HIGH":
            continue

        ccn = file_metrics.get("complexity", 0)
        top_funcs = [
            f for f in file_metrics.get("functions", [])
            if f.get("complexity", 0) > 10
        ][:5]

        func_detail = "; ".join(
            f"{f['name']} (CCN {f['complexity']}, line {f['start_line']})"
            for f in top_funcs
        )

        base_msg = (
            f"File has high cyclomatic complexity ({ccn}), "
            f"exceeding threshold of {CCN_HIGH_THRESHOLD}."
        )
        message = f"{base_msg} Top high-complexity functions: {func_detail}" if func_detail else base_msg

        findings.append({
            "file": rel_path,
            "line": 1,
            "rule_id": "maintainability.complexity.high-ccn",
            "message": message,
            "severity": "warning",
            "iso_25010": "maintainability",
        })

    return findings

def _compute_cognitive_complexity_python(file_path: str) -> int:
    """Compute cognitive complexity for a Python file using AST analysis.

    Implements a subset of SonarQube's Cognitive Complexity definition:
      - +1 per breaking structure: if, elif, else, for, while, except,
            with, assert, ternary
      - +1 per boolean operator in a condition (and, or)
      - +N for nested structures (N = nesting depth)
      - Method/function bodies do NOT increment at depth 0 (first level)

    Returns 0 for non-Python files or parsing failures.
    """
    if not file_path.endswith(".py"):
        return 0
    try:
        with open(file_path, "r", encoding="utf-8", errors="replace") as f:
            source = f.read()
        tree = ast.parse(source)
    except (SyntaxError, FileNotFoundError, UnicodeDecodeError):
        return 0

    total = 0

    class CognitiveVisitor(ast.NodeVisitor):
        def __init__(self):
            self.total = 0
            self._nesting_depth = 0
            self._in_function_body = False

        def _increment(self, base: int = 1) -> None:
            self.total += base + self._nesting_depth

        def visit_FunctionDef(self, node: ast.FunctionDef) -> None:
            old_in_fn = self._in_function_body
            self._in_function_body = True
            self.generic_visit(node)
            self._in_function_body = old_in_fn

        def visit_AsyncFunctionDef(self, node: ast.AsyncFunctionDef) -> None:
            old_in_fn = self._in_function_body
            self._in_function_body = True
            self.generic_visit(node)
            self._in_function_body = old_in_fn

        def _visit_control(self, node) -> None:
            if self._in_function_body:
                self._increment()
            self._nesting_depth += 1
            self.generic_visit(node)
            self._nesting_depth -= 1

        def visit_If(self, node: ast.If) -> None:
            self._visit_control(node)
            # elif/else nodes are nested If under orelse — they are already
            # visited via generic_visit of the parent, but we need to
            # increment for each elif/else.  Mark visited by the parent.
            if isinstance(node.orelse, list):
                for child in node.orelse:
                    if isinstance(child, ast.If):
                        # Python's elif: another condition -> +1
                        if self._in_function_body:
                            self._increment()
                        self._nesting_depth += 1
                        self.visit(child)
                        self._nesting_depth -= 1
                    elif isinstance(child, ast.IfExp):
                        self._visit_control(child)
                    else:
                        # else block (no condition) — +1 for the else itself
                        if self._in_function_body:
                            self._increment()

        def visit_For(self, node: ast.For) -> None:
            self._visit_control(node)

        def visit_AsyncFor(self, node: ast.AsyncFor) -> None:
            self._visit_control(node)

        def visit_While(self, node: ast.While) -> None:
            self._visit_control(node)

        def visit_Try(self, node: ast.Try) -> None:
            # Try itself does not break linear flow, but except and else/finally do
            self._nesting_depth += 1
            for handler in node.handlers:
                if self._in_function_body:
                    self._increment()
                self.visit(handler)
            if node.orelse:  # try/else
                if self._in_function_body:
                    self._increment()
            if node.finalbody:  # try/finally
                if self._in_function_body:
                    self._increment()
            self.generic_visit(node)
            self._nesting_depth -= 1

        def visit_ExceptHandler(self, node: ast.ExceptHandler) -> None:
            self.generic_visit(node)

        def visit_With(self, node: ast.With) -> None:
            self._visit_control(node)

        def visit_AsyncWith(self, node: ast.AsyncWith) -> None:
            self._visit_control(node)

        def visit_Assert(self, node: ast.Assert) -> None:
            if self._in_function_body:
                self._increment()
            self.generic_visit(node)

        def visit_IfExp(self, node: ast.IfExp) -> None:
            """Ternary expression (x if cond else y)."""
            if self._in_function_body:
                self._increment()
            self._nesting_depth += 1
            self.generic_visit(node)
            self._nesting_depth -= 1

        def visit_BoolOp(self, node: ast.BoolOp) -> None:
            """Boolean operators 'and' / 'or' — each adds 1."""
            if self._in_function_body:
                for _ in node.values:
                    self.total += 1  # +1 per operand (not per nesting)
            self.generic_visit(node)

    visitor = CognitiveVisitor()
    visitor.visit(tree)
    return visitor.total


def _compute_cognitive_complexity_heuristic(file_path: str) -> int:
    """Compute an estimated cognitive complexity for non-Python files.

    Uses regex pattern matching on common control-flow keywords.
    This is a best-effort heuristic, not as precise as AST-based analysis.
    """
    if not _is_text_file(file_path):
        return 0
    try:
        with open(file_path, "r", encoding="utf-8", errors="replace") as f:
            source = f.read()
    except (FileNotFoundError, OSError):
        return 0

    import re
    patterns = [
        (r'\bif\s*\(', 1),
        (r'\belse\s+if\b', 1),
        (r'\belse\b', 1),
        (r'\bfor\s*\(', 1),
        (r'\bwhile\s*\(', 1),
        (r'\bcatch\s*\(', 1),
        (r'\bcase\s+', 1),
        (r'\bdefault\s*:', 1),
        (r'\b三元\b', 1),  # ternary operator '?'
        (r'\?\s*\n*\s*[a-zA-Z]', 1),
        (r'\bswitch\s*\(', 1),
        (r'\breturn\s+', 0),  # no increment, base flow
    ]
    # Count nesting-violation keywords
    nesting_keywords = [r'\bif\b', r'\bfor\b', r'\bwhile\b', r'\bcatch\b']
    total = 0
    for pattern, base in patterns:
        matches = re.findall(pattern, source, re.MULTILINE)
        total += len(matches) * base

    # Simple nesting heuristic: count how often control keywords appear
    # inside blocks (inside { } ) — estimate average depth
    lines = source.split('\n')
    depth = 0
    max_depth = 0
    for line in lines:
        stripped = line.strip()
        if any(kw in stripped for kw in ['{']):
            depth += stripped.count('{')
        depth = max(0, depth)
        max_depth = max(max_depth, depth)
        if any(kw in stripped for kw in ['}']):
            depth = max(0, depth - stripped.count('}'))

    # Apply nesting multiplier: at most 2x for deep nesting
    nesting_factor = 1 + min(max_depth, 3) * 0.3
    return int(total * nesting_factor)


def compute_cognitive_complexity(file_path: str) -> Tuple[int, int]:
    """Compute the full cognitive complexity of a file.

    Uses AST-based analysis for Python files and a regex heuristic for
    other languages (JS, TS, Java, Go, etc.).

    Returns:
        (per_function_sum, total) where per_function_sum is the sum of
        individual function cognitive scores and total is the file-level
        cognitive complexity.
    """
    # AST-based for Python
    if file_path.endswith(".py"):
        total = _compute_cognitive_complexity_python(file_path)
    else:
        total = _compute_cognitive_complexity_heuristic(file_path)

    # For per-function sum, fall back to the lizard-based estimate
    try:
        analysis = lizard.analyze_file(file_path)
        per_fn_sum = sum(max(0, f.cyclomatic_complexity - 1) for f in analysis.function_list)
    except Exception:
        per_fn_sum = total

    return per_fn_sum, total


def gen_cognitive_complexity_findings(
    metrics: Dict[str, Any], target: str
) -> List[Dict[str, Any]]:
    """Generate findings for files with high cognitive complexity.

    Uses the ``cognitive_complexity`` (total) key from each file's metrics.
    Files whose cognitive_complexity exceeds COGNITIVE_HIGH_THRESHOLD are
    reported.

    Args:
        metrics: The metrics dict (``metrics["files"][rel_path]``).
        target: Target directory path (for path resolution).

    Returns:
        A list of finding dicts for files with high cognitive complexity.
    """
    findings: List[Dict[str, Any]] = []
    for rel_path, file_metrics in metrics.get("files", {}).items():
        cog = file_metrics.get("cognitive_complexity", 0)
        if not isinstance(cog, (int, float)) or cog <= COGNITIVE_HIGH_THRESHOLD:
            continue

        # Gather top functions by cognitive estimate
        top_funcs = sorted(
            (
                f for f in file_metrics.get("functions", [])
                if f.get("cognitive_complexity", 0) > 5
            ),
            key=lambda x: x.get("cognitive_complexity", 0),
            reverse=True,
        )[:5]

        func_detail = "; ".join(
            f"{f['name']} (cog {f['cognitive_complexity']}, line {f['start_line']})"
            for f in top_funcs
        )

        base_msg = (
            f"File has high cognitive complexity ({cog}), "
            f"exceeding threshold of {COGNITIVE_HIGH_THRESHOLD}. "
            f"Consider refactoring deeply nested control structures."
        )
        message = f"{base_msg} Top complex functions: {func_detail}" if func_detail else base_msg

        findings.append({
            "file": rel_path,
            "line": 1,
            "rule_id": "maintainability.complexity.high-cognitive",
            "message": message,
            "severity": "warning",
            "iso_25010": "maintainability",
        })

    return findings


def analyze_file_complexity(file_path: str, threshold: Optional[int] = None) -> Dict[str, Any]:
    """Analyze Cyclomatic Complexity and Cognitive Complexity for a source file.

    Uses Lizard for CCN/function analysis. Cognitive complexity is calculated
    via AST (Python) or regex heuristic (other languages).

    Args:
        file_path: Absolute or relative path to the file to analyze.
        threshold: Optional override for HIGH complexity threshold.
                   Defaults to CCN_HIGH_THRESHOLD.

    Returns:
        A dict with complexity, cognitive_complexity, loc, level, functions[].
    """
    use_threshold = threshold if threshold is not None else CCN_HIGH_THRESHOLD
    fallback_result = {
        "complexity": 0,
        "cognitive_complexity": 0,
        "loc": 0,
        "level": "LOW",
        "functions": [],
    }

    if not os.path.exists(file_path):
        return fallback_result

    try:
        filesize = os.path.getsize(file_path)
        if filesize == 0:
            return fallback_result

        if filesize > 1024 * 1024:
            logger.warning("Skipping large file (>1MB): %s", file_path)
            return fallback_result

        if not _is_text_file(file_path):
            logger.warning("Skipping binary file: %s", file_path)
            return fallback_result

        analysis = lizard.analyze_file(file_path)
        functions_data = []
        total_ccn = analysis.CCN
        total_loc = analysis.nloc

        _, file_cognitive = compute_cognitive_complexity(file_path)

        for f in analysis.function_list:
            functions_data.append({
                "name": f.name,
                "start_line": f.start_line,
                "end_line": f.end_line,
                "complexity": f.cyclomatic_complexity,
                "cognitive_complexity": max(0, f.cyclomatic_complexity - 1),
                "loc": f.nloc,
            })

        if total_ccn <= 10:
            level = "LOW"
        elif total_ccn <= use_threshold:
            level = "MEDIUM"
        else:
            level = "HIGH"

        return {
            "complexity": total_ccn,
            "cognitive_complexity": file_cognitive,
            "loc": total_loc,
            "level": level,
            "functions": functions_data,
        }

    except Exception as e:
        print(f"Error analyzing complexity for {file_path}: {e}", file=sys.stderr)
        return fallback_result

if __name__ == "__main__":
    if len(sys.argv) > 1:
        test_file = sys.argv[1]
        print(f"Analyzing: {test_file}")
        import json
        print(json.dumps(analyze_file_complexity(test_file), indent=2))
    else:
        print("Please provide a file path to test.")
