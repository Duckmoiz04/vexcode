# ISO 25010 Sprint 3 Ngày — Technical Plan

**Date**: 22-06-26
**Complexity**: Medium (4 tính năng độc lập, Python + Node.js)
**Status**: ⏳ PLANNED
**Author**: Sisyphus
**Project**: VexCode — AI Code Review (DATN)
**Deadline**: 24-06-26 (3 ngày — chạy nước rút trước bảo vệ)

## Overview

Plan này nhắm vào 4 tính năng có impact/effort cao nhất để cải thiện điểm ISO 25010 trước ngày bảo vệ DATN. Mỗi tính năng mapping trực tiếp tới một hoặc nhiều đặc tính chất lượng, cung cấp số liệu cứng (benchmark) cho Chương 4.

**5 mục tiêu trong 3 ngày — mở rộng phủ 7/8 ISO 25010 categories:**

| Ngày | Tính năng | ISO Impact | Nỗ lực |
|------|-----------|------------|--------|
| 1 | Gitleaks integration + Markdown export | Security +25%, Operability +5% | 3.5h |
| 2 | Threshold Engine + `--explain` flag | Functional +15%, Maintainability +25%, Operability +10% | 5h |
| 3 | Custom rules (security + functional + operability) + valid_exts + taxonomy expansion + Benchmark | Functional +10%, Security +10%, Operability +5%, Compatibility +5%, Transferability +5% | 5h |

**Tổng nỗ lực**: ~13.5 giờ — rải 3 ngày (4-5h/ngày)

**ISO Coverage tăng**: 39% → ~55% (từ 4/8 categories lên 7/8 categories có ít nhất 1 check)

**User profile**: KTPM — cần số liệu benchmark, taxonomy mapping rõ ràng, traceability cho luận văn.

---

## Quick Links
- [Goals and Success Metrics](#goals-and-success-metrics)
- [Phase Completion Rules](#phase-completion-rules)
- [Day 1 — Gitleaks + Markdown Export](#day-1--gitleaks--markdown-export)
- [Day 2 — Threshold Engine + `--explain` Flag](#day-2--threshold-engine--explain-flag)
- [Day 3 — Custom Rules, valid_exts, Taxonomy, Benchmark](#day-3--custom-rules-valid_exts-taxonomy-benchmark)
- [Acceptance Criteria](#acceptance-criteria)
- [Blast Radius](#blast-radius)
- [Verification Evidence](#verification-evidence)
- [Resume and Execution Handoff](#resume-and-execution-handoff)

---

## Goals and Success Metrics

### Business Goals
- **Số liệu Chương 4**: Benchmark scan time, findings per category, rating distribution, parallel vs sequential speedup
- **Bảo vệ DATN**: Trình diễn tool quét được secret, áp threshold, có custom rules — khác biệt so với Semgrep đơn thuần
- **Phòng vệ**: Khi giảng viên hỏi "tool có gì ngoài Semgrep?" — trả lời được: secret scanning, quality gates, custom rules, markdown report

### Success Metrics
- **Gitleaks**: Phát hiện ít nhất 1 secret trong git history của target thật
- **Markdown**: `vexcode scan --target . --format md` sinh file `.md` đọc được
- **Threshold**: `vexcode scan --target . --thresholds conf/thresholds.toml` exit code != 0 khi vi phạm
- **--explain**: `vexcode scan --target . --explain` hiển thị lý do cho từng finding
- **Custom rules**: `vexcode scan --target . --semgrep-rules semgrep-rules/custom/` ra findings từ ít nhất 3/8 rules
- **Correctness rules**: Phát hiện self-comparison, mutable-default-arg, unchecked-return trong Python code
- **Operability rules**: Phát hiện silent-except và bare-except patterns
- **valid_exts mở rộng**: Resolver chấp nhận .java, .go, .yaml, .md (Compatibility + Transferability)
- **Taxonomy constants**: 4 category constants mới có trong ISO_METADATA_KEYS (Transferability mapping)
- **Benchmark**: Concrete numbers cho ít nhất: scan time (sequential vs parallel), findings breakdown, ratings
- **ISO Coverage**: Từ 4/8 categories lên 7/8 categories có ít nhất 1 check
- **0 regression** trên Python tests hiện tại

---

## Phase Completion Rules

A phase is NOT complete until:
1. **Integration Test** — Works với pipeline hiện tại (scanner → enricher → resolver → reporter)
2. **Manual Test** — Chạy CLI command thật, output đúng
3. **Data Verification** — Report JSON/MD có field mới
4. **Error Handling** — Failure cases handled (no Gitleaks → skip gracefully, bad threshold file → clear error)
5. **User Confirmation** — User verifies it works

Status meanings:
- ⏳ PLANNED — Not started
- 🔨 CODE DONE — Written but not E2E tested
- 🧪 TESTING — Currently being tested
- ✅ VERIFIED — Tested AND confirmed working
- 🚧 BLOCKED — Has issues

---

## Day 1 — Gitleaks + Markdown Export

**ISO Impact**: Security (+25%), Operability (+5%)
**Effort**: ~3.5h

### Mục tiêu
1. Thêm Gitleaks vào pipeline — quét secret trong git history
2. Thêm Markdown export — sinh báo cáo `.md` đọc được

### Files affected

| File | Action |
|------|--------|
| `packages/engine/src/engine/pipeline/scanner.py` | Modify — thêm `run_gitleaks_scan()` |
| `packages/engine/src/engine/pipeline/reporter.py` | Modify — thêm `export_markdown()` |
| `packages/engine/src/engine/config/sarif_builder.py` | Modify — thêm `build_markdown_report()` (hoặc file riêng) |
| `packages/engine/src/engine/pipeline/__init__.py` | Modify — update module docstring |
| `packages/engine/conf/settings.toml` | Modify — thêm `[gitleaks]` section |
| `packages/engine/tests/test_gitleaks.py` | Create — unit test |
| `packages/engine/tests/test_markdown_export.py` | Create — unit test |

### Implementation

#### 1.1 Thêm Gitleaks scan vào scanner.py (~1.5h)

**Vị trí**: Trong `scanner.py`, sau `run_scan_phase()` hoặc hàm mới `run_gitleaks_scan()`.

Gitleaks detect mode chạy trên git repo, output JSON. Nếu không có git repo hoặc Gitleaks chưa install → skip với warning.

```python
def run_gitleaks_scan(target: str, use_mock: bool = False) -> List[Dict[str, Any]]:
    """Run Gitleaks secret scan on target directory.

    Returns a list of findings in VexCode internal format.
    Returns empty list if Gitleaks is not installed or not a git repo.
    """
    if use_mock:
        return [
            {
                "rule_id": "gitleaks/mock-secret",
                "message": "[Mock] Hardcoded credential detected",
                "severity": "error",
                "file": "example.py",
                "line": 10,
                "category": "security",
                "scanner": "gitleaks",
            }
        ]

    # Check if git repo
    git_state = get_git_state(target)
    if not git_state:
        logger.info("Gitleaks: Not a git repository, skipping.")
        return []

    # Check if gitleaks is installed
    try:
        subprocess.run(
            ["gitleaks", "version"],
            capture_output=True, text=True, check=False,
            shell=(sys.platform == 'win32'),
        )
    except FileNotFoundError:
        logger.warning("Gitleaks not found. Install with: brew install gitleaks / scoop install gitleaks")
        return []

    # Run gitleaks detect
    result = subprocess.run(
        ["gitleaks", "detect", "--source", target,
         "--report-format", "json", "--no-git",
         "--exit-code", "0"],  # Don't fail on finding — we handle it
        cwd=target, capture_output=True, text=True, check=False,
        shell=(sys.platform == 'win32'),
    )

    findings = []
    if result.stdout:
        try:
            raw = json.loads(result.stdout)
            for item in raw if isinstance(raw, list) else raw.get("Findings", []):
                finding = {
                    "rule_id": f"gitleaks/{item.get('RuleID', 'unknown')}",
                    "message": f"Secret detected: {item.get('Description', '')}",
                    "severity": "error" if item.get("Severity") == "high" else "warning",
                    "file": item.get("File", ""),
                    "line": item.get("StartLine", 0),
                    "category": "security",
                    "scanner": "gitleaks",
                    "cwe_id": "CWE-798",  # Hardcoded credentials
                }
                findings.append(finding)
        except json.JSONDecodeError:
            logger.warning("Failed to parse Gitleaks output as JSON")

    logger.info(f"Gitleaks found {len(findings)} secret(s)")
    return findings
```

**Tích hợp vào pipeline**: Trong `run_scan_phase()` hoặc tách riêng — đề xuất tách ra rồi merge findings ở `__main__.py` hoặc pipeline orchestrator.

**Integration**: Ở Python `__main__.py` hoặc pipeline runner, gọi `run_gitleaks_scan()` song song với `run_scan_phase()` và gộp findings.

#### 1.2 Cập nhật settings.toml (~15 phút)

**File**: `packages/engine/conf/settings.toml`

```toml
[gitleaks]
enabled = true
timeout_seconds = 120
```

Cập nhật `constants.py`:

```python
# -- Gitleaks settings ----------------------------------------------------
GITLEAKS_ENABLED = _nested_get(_settings, ["gitleaks", "enabled"], True)
GITLEAKS_TIMEOUT = _nested_get(_settings, ["gitleaks", "timeout_seconds"], 120)
```

#### 1.3 Markdown export (~1.5h)

**File mới hoặc thêm vào `reporter.py`**: Hàm xuất báo cáo markdown từ report JSON.

```python
def export_markdown(report: Dict[str, Any], output_path: str) -> None:
    """Write a human-readable Markdown report from VexCode report data.

    Sections:
    - Scan info (timestamp, target, scanner)
    - Summary (total findings per severity, per category)
    - Finding details per file (file, line, severity, message, category, status)
    - AI resolutions (if any)
    - Ratings (A-E per ISO dimension if computed)
    """
    lines = []
    # Header
    lines.append(f"# VexCode Scan Report")
    lines.append(f"")
    lines.append(f"- **Target**: `{report.get('target_path', 'N/A')}`")
    lines.append(f"- **Scanner**: {report.get('scanner', 'N/A')}")
    lines.append(f"- **Timestamp**: {report.get('timestamp', 'N/A')}")
    lines.append(f"")

    findings = report.get("findings", [])
    # Summary
    lines.append(f"## Summary")
    lines.append(f"")
    lines.append(f"**Total findings**: {len(findings)}")
    lines.append(f"")

    # Per severity
    severity_counts: Dict[str, int] = {}
    category_counts: Dict[str, int] = {}
    for f in findings:
        sev = f.get("severity", "unknown")
        severity_counts[sev] = severity_counts.get(sev, 0) + 1
        cat = f.get("category", "unknown")
        category_counts[cat] = category_counts.get(cat, 0) + 1

    lines.append("### By Severity")
    for sev in ["error", "warning", "info"]:
        if sev in severity_counts:
            lines.append(f"- **{sev}**: {severity_counts[sev]}")
    lines.append("")

    lines.append("### By Category")
    for cat in sorted(category_counts.keys()):
        lines.append(f"- **{cat}**: {category_counts[cat]}")
    lines.append("")

    # Ratings
    metrics = report.get("metrics", {})
    ratings = metrics.get("ratings", {})
    if ratings:
        lines.append("### Quality Ratings (A-E)")
        for dim, rating in ratings.items():
            lines.append(f"- **{dim}**: {rating}")
        lines.append("")

    # Finding details grouped by file
    lines.append(f"## Finding Details")
    lines.append(f"")
    by_file: Dict[str, List[dict]] = {}
    for f in findings:
        file_key = f.get("file", "unknown")
        by_file.setdefault(file_key, []).append(f)

    for file_path, file_findings in sorted(by_file.items()):
        lines.append(f"### {file_path}")
        lines.append(f"")
        lines.append("| Line | Severity | Rule | Message | Category | Status |")
        lines.append("|------|----------|------|---------|----------|--------|")
        for f in file_findings:
            lines.append(
                f"| {f.get('line', '')} "
                f"| {f.get('severity', '')} "
                f"| `{f.get('rule_id', '')}` "
                f"| {f.get('message', '')} "
                f"| {f.get('category', '')} "
                f"| {f.get('status', 'open')} |"
            )
        lines.append("")

    # AI resolutions
    ai_res = report.get("ai_resolutions", {})
    if ai_res:
        lines.append("## AI Resolutions")
        for rule_id, res in ai_res.items():
            lines.append(f"- **{rule_id}**: {res.get('suggestion', '')[:120]}")
        lines.append("")

    content = "\n".join(lines)
    with open(output_path, "w", encoding="utf-8") as f:
        f.write(content)

    logger.info(f"Markdown report written to {output_path}")
```

**Tích hợp CLI**: Thêm enum format và xử lý trong CLI entry point (có thể qua `--format md|json|sarif` flag).

#### 1.4 CLI --format flag (~30 phút)

**File**: Node.js CLI (bridge.js hoặc CLI entry point)

Trong CLI scan command, thêm `--format <json|md|sarif>` flag. Mặc định là `json`. Khi `--format md`:

1. Chạy scan bình thường → nhận report JSON
2. Gọi `python config_cli.py export-markdown <report> <output>`

Hoặc đơn giản hơn: thêm flag vào Python `__main__.py` — `--format md` để xuất markdown thay vì JSON.

**Đề xuất**: Sửa `packages/engine/__main__.py` để nhận `--format md` và gọi `export_markdown()` thay vì `write_report()`.

**Tham khảo CLI arg:**

```python
# Trong __main__.py
parser.add_argument("--format", choices=["json", "md", "sarif"], default="json",
                    help="Output format (default: json)")
```

#### 1.5 Tests

**test_gitleaks.py**:
- Test hàm nhận mock Gitleaks output → parse đúng
- Test skip khi không có git repo
- Test skip khi Gitleaks không installed
- Test finding format đúng schema

**test_markdown_export.py**:
- Test sinh markdown từ report mẫu
- Test các section header có mặt
- Test empty findings edge case

---

## Day 2 — Threshold Engine + `--explain` Flag

**ISO Impact**: Functional Suitability (+15%), Maintainability (+25%), Operability (+10%)
**Effort**: ~5h

### Mục tiêu
1. Thêm threshold engine — đánh giá findings so với ngưỡng, fail scan nếu vượt
2. Thêm `--explain` flag — giải thích từng finding trong output (STDOUT)

### Files affected

| File | Action |
|------|--------|
| `packages/engine/src/engine/pipeline/thresholds.py` | **Create** — threshold evaluation engine |
| `packages/engine/src/engine/pipeline/reporter.py` | Modify — thêm threshold results vào report |
| `packages/engine/conf/settings.toml` | Modify — thêm `[thresholds]` section |
| `packages/engine/__main__.py` | Modify — thêm `--thresholds`, `--explain`, exit code logic |
| `packages/engine/src/engine/config/constants.py` | Modify — thêm threshold config keys |
| `packages/engine/tests/test_thresholds.py` | **Create** — unit test |
| `packages/cli/src/index.js` (bridge) | Modify — truyền threshold params |

### Implementation

#### 2.1 Threshold Engine (~2.5h)

**File mới**: `packages/engine/src/engine/pipeline/thresholds.py`

```python
"""Threshold evaluation engine for quality gates.

Evaluates scan findings and metrics against configurable thresholds.
Produces PASS/FAIL with violations list.

Threshold config (TOML):
    [thresholds]
    max_critical = 0           # Max critical-severity findings
    max_high = 10              # Max high-severity findings
    max_total = 100            # Max total findings
    max_files_with_errors = 20 # Max files containing errors
    min_rating = "C"           # Minimum acceptable A-E rating
    max_complexity = 15        # Max cyclomatic complexity per function
    max_duplicate_lines = 100  # Max duplicated lines
"""

from typing import Any, Dict, List, Optional, Tuple


def load_thresholds(config_path: Optional[str] = None) -> Dict[str, Any]:
    """Load thresholds from TOML config file.

    Falls back to defaults if no config provided or file not found.
    """
    defaults = {
        "max_critical": 0,
        "max_high": 10,
        "max_total": 100,
        "max_files_with_errors": 20,
        "min_rating": "C",
        "max_complexity": 15,
        "max_duplicate_lines": 100,
    }

    if not config_path or not os.path.exists(config_path):
        return defaults

    try:
        import tomllib
        with open(config_path, "rb") as f:
            config = tomllib.load(f)
        thresholds = config.get("thresholds", {})
        merged = defaults.copy()
        merged.update({k: v for k, v in thresholds.items() if v is not None})
        return merged
    except Exception:
        return defaults


def evaluate_thresholds(
    findings: List[Dict[str, Any]],
    metrics: Dict[str, Any],
    thresholds: Dict[str, Any],
) -> Tuple[bool, List[Dict[str, Any]]]:
    """Evaluate findings and metrics against configured thresholds.

    Returns (passed: bool, violations: list).
    Each violation: {
        "threshold": "max_critical",
        "actual": 3,
        "limit": 0,
        "message": "Exceeded max critical findings: 3 > 0"
    }
    """
    violations: List[Dict[str, Any]] = []

    # Count by severity
    severity_counts: Dict[str, int] = {"critical": 0, "high": 0, "medium": 0, "low": 0}
    for f in findings:
        sev = f.get("severity", "low").lower()
        severity_counts[sev] = severity_counts.get(sev, 0) + 1

    total = len(findings)

    # Check max_critical
    max_critical = thresholds.get("max_critical", 0)
    crit_count = severity_counts.get("critical", 0) + severity_counts.get("error", 0)
    if crit_count > max_critical:
        violations.append({
            "threshold": "max_critical",
            "actual": crit_count,
            "limit": max_critical,
            "message": f"Exceeded max critical findings: {crit_count} > {max_critical}",
        })

    # Check max_high
    max_high = thresholds.get("max_high", 10)
    high_count = severity_counts.get("high", 0) + severity_counts.get("warning", 0)
    if high_count > max_high:
        violations.append({
            "threshold": "max_high",
            "actual": high_count,
            "limit": max_high,
            "message": f"Exceeded max high-severity findings: {high_count} > {max_high}",
        })

    # Check max_total
    max_total = thresholds.get("max_total", 100)
    if total > max_total:
        violations.append({
            "threshold": "max_total",
            "actual": total,
            "limit": max_total,
            "message": f"Exceeded max total findings: {total} > {max_total}",
        })

    # Check max_files_with_errors
    max_files = thresholds.get("max_files_with_errors", 20)
    files_with_errors = len(set(f.get("file", "") for f in findings
                                if f.get("severity") in ("error", "critical")))
    if files_with_errors > max_files:
        violations.append({
            "threshold": "max_files_with_errors",
            "actual": files_with_errors,
            "limit": max_files,
            "message": f"Exceeded max files with errors: {files_with_errors} > {max_files}",
        })

    # Check min_rating (A-E) — nếu metrics có rating
    ratings = metrics.get("ratings", {})
    if ratings and "min_rating" in thresholds:
        min_rating = thresholds["min_rating"]
        rating_order = {"A": 5, "B": 4, "C": 3, "D": 2, "E": 1}
        min_score = rating_order.get(min_rating, 3)
        for dim, rating in ratings.items():
            actual_score = rating_order.get(rating, 0)
            if actual_score < min_score:
                violations.append({
                    "threshold": "min_rating",
                    "actual": rating,
                    "limit": min_rating,
                    "message": f"Rating {dim}={rating} below minimum {min_rating}",
                })

    passed = len(violations) == 0
    return passed, violations
```

**Tích hợp vào pipeline**: Trong `__main__.py`, sau khi assemble report, gọi `evaluate_thresholds()` với findings và metrics. Nếu threshold config có path từ CLI `--thresholds`, dùng nó; nếu không, dùng mặc định. Thêm threshold results vào report:

```python
report["thresholds"] = {
    "passed": passed,
    "violations": violations,
    "config": thresholds_config,
}
```

**Exit code**: Nếu `--fail-on-threshold` flag được set và threshold không pass → exit code = 1.

#### 2.2 `--explain` flag (~1.5h)

**Ý tưởng**: Khi `--explain` được truyền, scan output ra STDOUT dạng text thay vì chỉ ghi file. Mỗi finding hiển thị:
- Rule ID + message
- File:line
- Severity
- Category (ISO 25010)
- Tại sao finding này xuất hiện (dựa trên rule metadata)

**Implementation trong `__main__.py`:**

```python
def print_explain(findings: List[dict], thresholds_result: Optional[dict] = None) -> None:
    """Print human-readable explanation of findings to STDOUT."""
    if not findings:
        print("✓ No findings detected.")
        return

    # Group by severity
    print(f"\n{'='*60}")
    print(f"  VexCode Scan — Explain Report")
    print(f"{'='*60}")
    print(f"  Total: {len(findings)} finding(s)\n")

    by_severity: Dict[str, List[dict]] = {}
    for f in findings:
        by_severity.setdefault(f.get("severity", "unknown"), []).append(f)

    for severity in ["error", "warning", "info", "unknown"]:
        items = by_severity.get(severity, [])
        if not items:
            continue
        print(f"  [{severity.upper()}] — {len(items)} finding(s)")
        print(f"  {'-'*56}")
        for f in items:
            print(f"    Rule:    {f.get('rule_id', 'N/A')}")
            print(f"    File:    {f.get('file', 'N/A')}:{f.get('line', 'N/A')}")
            print(f"    Message: {f.get('message', 'N/A')}")
            print(f"    Category:  {f.get('category', 'N/A')}")
            if f.get('cwe_id'):
                print(f"    CWE:     {f.get('cwe_id')}")
            print()

    # Threshold results
    if thresholds_result and not thresholds_result.get("passed", True):
        print(f"\n  {'='*60}")
        print(f"  ❌ THRESHOLD VIOLATIONS")
        print(f"  {'='*60}")
        for v in thresholds_result.get("violations", []):
            print(f"    - {v['message']}")
        print()

    print(f"{'='*60}\n")
```

**Tích hợp CLI flag**: Thêm `--explain` vào argument parser. Khi có flag, sau khi scan, gọi `print_explain()` ra STDOUT trước khi ghi file.

#### 2.3 Config settings.toml — thresholds section

```toml
[thresholds]
max_critical = 0
max_high = 10
max_total = 100
max_files_with_errors = 20
min_rating = "C"
```

#### 2.4 Tests (~1h)

**test_thresholds.py**:
- Test load thresholds với config → merge với defaults
- Test evaluate: vượt threshold → violations list
- Test evaluate: dưới threshold → passed = True
- Test evaluate: empty findings → passed
- Test explain output format (capture stdout)

---

## Day 3 — Custom Rules, valid_exts, Taxonomy, Benchmark

**ISO Impact**: Functional Suitability (+10%), Security (+10%), Operability (+5%), Compatibility (+5%), Transferability (+5%)
**Effort**: ~5h

### Mục tiêu
1. Tạo 8 custom Semgrep rules bao phủ 5 categories (Security, Functional Suitability, Operability)
2. Mở rộng `valid_exts` trong resolver.py cho Compatibility
3. Cập nhật taxonomy constants cho 4 missing categories (Transferability mapping)
4. Chạy benchmark trên real project — ghi số liệu cho Chương 4

### Files affected

| File | Action |
|------|--------|
| `semgrep-rules/custom/no-hardcoded-creds.yaml` | **Create** — Security |
| `semgrep-rules/custom/no-print-statements.yaml` | **Create** — Maintainability |
| `semgrep-rules/custom/no-insecure-http.yaml` | **Create** — Security |
| `semgrep-rules/custom/no-self-comparison.yaml` | **Create** — Functional Suitability |
| `semgrep-rules/custom/no-mutable-defaults.yaml` | **Create** — Functional Suitability |
| `semgrep-rules/custom/check-unchecked-return.yaml` | **Create** — Functional Suitability |
| `semgrep-rules/custom/no-silent-except.yaml` | **Create** — Operability |
| `semgrep-rules/custom/no-bare-except.yaml` | **Create** — Operability |
| `packages/engine/src/engine/core/scanner.py` | Modify — thêm custom rules path |
| `packages/engine/conf/settings.toml` | Modify — thêm `semgrep_rules_path` |
| `packages/engine/src/engine/pipeline/resolver.py` | Modify — mở rộng `valid_exts` cho Compatibility |
| `packages/engine/src/engine/config/iso25010_taxonomy.py` | Modify — thêm 4 missing category constants + mappings |
| `scripts/benchmark.py` | **Create** — benchmark script |
| `process/features/vexcode/reports/benchmark_22-06-26.md` | **Create** — benchmark results |

### Implementation

#### 3.1 Tạo `semgrep-rules/custom/` directory và rules (~2.5h)

**— Nhóm Security & Maintainability (3 rules, 1h) —**

**Rule 1**: `no-hardcoded-creds.yaml` — Phát hiện hardcoded password/token/secret trong Python

```yaml
rules:
  - id: no-hardcoded-creds
    pattern-either:
      - pattern: 'password = "..."'
      - pattern: 'passwd = "..."'
      - pattern: 'secret = "..."'
      - pattern: 'api_key = "..."'
      - pattern: 'API_KEY = "..."'
      - pattern: 'token = "..."'
      - pattern: 'SECRET_KEY = "..."'
    message: "Hardcoded credential detected: $VALUE. Use environment variables or a secrets manager."
    severity: error
    languages:
      - python
    metadata:
      category: security
      cwe: "CWE-798"
      iso_25010: security
      iso_subcategory: confidentiality
```

**Rule 2**: `no-print-statements.yaml` — Phát hiện `print()` trong production code (trừ `__main__`)

```yaml
rules:
  - id: no-print-statements
    pattern: print(...)
    message: "print() statement found in non-main code. Use logger instead."
    severity: warning
    languages:
      - python
    paths:
      exclude:
        - "*/__main__.py"
        - "*_test.py"
        - "test_*.py"
    metadata:
      category: maintainability
      iso_25010: maintainability
      iso_subcategory: analyzability
```

**Rule 3**: `no-insecure-http.yaml` — Phát hiện HTTP (non-HTTPS) requests

```yaml
rules:
  - id: no-insecure-http
    pattern-either:
      - pattern: 'requests.get("http://...")'
      - pattern: 'requests.post("http://...")'
      - pattern: 'urllib.request.urlopen("http://...")'
    message: "Insecure HTTP request detected. Use HTTPS instead."
    severity: error
    languages:
      - python
    metadata:
      category: security
      cwe: "CWE-319"
      iso_25010: security
      iso_subcategory: integrity
```

**— Nhóm Functional Suitability (3 rules, 1h) —**

**Rule 4**: `no-self-comparison.yaml` — Phát hiện so sánh biến với chính nó (luôn đúng/luôn sai)

```yaml
rules:
  - id: no-self-comparison
    pattern-either:
      - pattern: '$X == $X'
      - pattern: '$X != $X'
      - pattern: '$X > $X'
      - pattern: '$X < $X'
      - pattern: '$X >= $X'
      - pattern: '$X <= $X'
    message: "Self-comparison detected: '$X == $X' is always true/false. Verify this is intended behavior."
    severity: error
    languages:
      - python
      - javascript
      - typescript
      - java
      - go
    metadata:
      category: correctness
      cwe: "CWE-570"
      iso_25010: functional_suitability
      iso_subcategory: functional_correctness
```

**Rule 5**: `no-mutable-defaults.yaml` — Phát hiện mutable default arguments trong Python

```yaml
rules:
  - id: no-mutable-defaults
    patterns:
      - pattern: |
          def $FUNC($PARAMS=$MUTABLE):
            ...
      - metavariable-pattern:
          metavariable: $MUTABLE
          pattern-either:
            - pattern: '[]'
            - pattern: '{}'
            - pattern: 'set()'
            - pattern: 'datetime.now()'
    message: "Mutable default argument '$MUTABLE' in function '$FUNC'. This is evaluated once at definition time and shared across all calls."
    severity: warning
    languages:
      - python
    metadata:
      category: correctness
      cwe: "CWE-665"
      iso_25010: functional_suitability
      iso_subcategory: functional_correctness
```

**Rule 6**: `check-unchecked-return.yaml` — Phát hiện gọi function mà không dùng kết quả trả về (cho các function quan trọng)

```yaml
rules:
  - id: check-unchecked-return
    patterns:
      - pattern-inside: |
          $FUNC(...)
      - pattern: 'os.system(...)'
      - pattern: 'subprocess.call(...)'
      - pattern: 'shutil.rmtree(...)'
      - pattern: 'os.remove(...)'
    message: "Unchecked return value of '$FUNC'. Ignoring the result may silently hide failures."
    severity: warning
    languages:
      - python
    metadata:
      category: correctness
      cwe: "CWE-252"
      iso_25010: functional_suitability
      iso_subcategory: functional_correctness
```

**— Nhóm Operability (2 rules, 30 phút) —**

**Rule 7**: `no-silent-except.yaml` — Phát hiện `except: pass` gây nuốt lỗi âm thầm

```yaml
rules:
  - id: no-silent-except
    patterns:
      - pattern: |
          try:
            ...
          except:
            ...
      - pattern-not: |
          except $EXCEPTION as $E:
            ...
    message: "Bare except detected (will catch KeyboardInterrupt+SystemExit). Use 'except Exception as e:' and handle the error."
    severity: error
    languages:
      - python
    metadata:
      category: operability
      cwe: "CWE-391"
      iso_25010: operability
      iso_subcategory: error_handling
```

**Rule 8**: `no-bare-except.yaml` — Phát hiện `except:` không chỉ định loại exception

```yaml
rules:
  - id: no-bare-except
    patterns:
      - pattern: |
          try:
            ...
          except:
            ...
      - pattern-not: |
          except $EXCEPTION as $E:
            ...
    message: "Bare except detected (will catch KeyboardInterrupt+SystemExit). Use 'except Exception as e:' and handle the error."
    severity: error
    languages:
      - python
    metadata:
      category: operability
      cwe: "CWE-391"
      iso_25010: operability
      iso_subcategory: error_handling
```

#### 3.2 Tích hợp custom rules vào Semgrep scan (~30 phút)

**Trong `scanner.py`** (core scanner, not pipeline):

```python
# Thêm tham số --semgrep-rules vào CLI
def run_scan(target: str, use_mock: bool = False, files: Optional[List[str]] = None,
             semgrep_rules_path: Optional[str] = None) -> Dict[str, Any]:
    ...
    cmd = ["semgrep", "scan", "--json", "--quiet"]

    if semgrep_rules_path:
        cmd.extend(["--config", semgrep_rules_path])

    if use_mock:
        cmd.append("--config")
        cmd.append("auto")
    ...
```

**Cập nhật settings.toml:**

```toml
[semgrep]
rules_path = "semgrep-rules/custom"
```

#### 3.3 Mở rộng `valid_exts` cho Compatibility (~30 phút)

**Trong `resolver.py`**:

```python
# Before
valid_exts = {".py", ".js", ".jsx", ".ts", ".tsx"}

# After — thêm extension cho Compatibility (co-existence với nhiều ngôn ngữ/format)
valid_exts = {
    ".py", ".js", ".jsx", ".ts", ".tsx",  # existing code
    ".java", ".go", ".rs", ".rb",       # ngôn ngữ backend phổ biến
    ".yaml", ".yml", ".toml", ".json",  # config formats — Compatibility
    ".md", ".rst",                       # documentation formats — Compatibility
}
```

**Lưu ý**: Resolver chỉ track file có extension trong `valid_exts`. Việc mở rộng này giúp VexCode compatible với nhiều loại project hơn. Các extension mới được thêm vào metadata check (phát hiện) nhưng KHÔNG tự động scan — Semgrep core quyết định file nào được scan dựa trên language support.

#### 3.4 Cập nhật taxonomy constants cho Transferability (~15 phút)

**Trong `iso25010_taxonomy.py`**:

```python
# Thêm category constants cho 4 missing categories
CATEGORY_FUNCTIONAL_SUITABILITY = "functional_suitability"
CATEGORY_OPERABILITY = "operability"
CATEGORY_COMPATIBILITY = "compatibility"
CATEGORY_TRANSFERABILITY = "transferability"

# Thêm vào ISO_METADATA_FIELDS mapping
ISO_METADATA_KEYS: dict[str, str] = {
    # Phase 1 — existing
    "security": "Security",
    "reliability": "Reliability",
    "maintainability": "Maintainability",
    "performance": "Performance Efficiency",
    # Phase 2 — added now
    "functional_suitability": "Functional Suitability",
    "operability": "Operability",
    "compatibility": "Compatibility",
    "transferability": "Transferability",
}

# Thêm vào ISO_SUBCATEGORIES mapping (optional, tối thiểu)
ISO_SUBCATEGORIES: dict[str, str] = {
    # Security subcategories (existing)
    "confidentiality": "Confidentiality",
    "integrity": "Integrity",
    "availability": "Availability",
    "accountability": "Accountability",
    "authenticity": "Authenticity",
    # Functional Suitability subcategories
    "functional_completeness": "Functional Completeness",
    "functional_correctness": "Functional Correctness",
    "functional_appropriateness": "Functional Appropriateness",
    # Operability subcategories
    "appropriateness_recognizability": "Appropriateness Recognizability",
    "learnability": "Learnability",
    "ease_of_use": "Ease of Use",
    "helpfulness": "Helpfulness",
    "technical_accessibility": "Technical Accessibility",
    "user_engagement": "User Engagement",
    "user_error_protection": "User Error Protection",
    "user_interface_aesthetics": "User Interface Aesthetics",
    # Compatibility subcategories
    "co_existence": "Co-existence",
    "interoperability": "Interoperability",
    # Transferability subcategories
    "portability": "Portability",
    "adaptability": "Adaptability",
    "installability": "Installability",
    "replaceability": "Replaceability",
}
```

#### 3.5 Benchmark script (~1h)

**Script mới**: `scripts/benchmark.py`

```python
#!/usr/bin/env python3
"""Benchmark VexCode scan performance for Chương 4 DATN report.

Usage:
    python scripts/benchmark.py [--target <dir>] [--output <file>]
"""

import subprocess
import time
import json
import sys
from pathlib import Path


def benchmark_scan(target: str, label: str, extra_args: list = None) -> dict:
    """Run a scan and return timing + findings count."""
    cmd = [sys.executable, "-m", "engine", "--target", target, "--output", ".benchmark-tmp.json"]
    if extra_args:
        cmd.extend(extra_args)

    start = time.perf_counter()
    result = subprocess.run(cmd, capture_output=True, text=True, timeout=300)
    elapsed = time.perf_counter() - start

    # Clean up temp file
    Path(".benchmark-tmp.json").unlink(missing_ok=True)

    findings_count = 0
    # Parse output for findings count
    try:
        with open(".benchmark-tmp.json") as f:
            report = json.load(f)
            findings_count = len(report.get("findings", []))
    except (FileNotFoundError, json.JSONDecodeError):
        pass

    return {
        "label": label,
        "time_seconds": round(elapsed, 2),
        "findings": findings_count,
        "exit_code": result.returncode,
        "error": result.stderr[:500] if result.returncode != 0 else None,
    }


def main():
    target = sys.argv[1] if len(sys.argv) > 1 else "."
    output = sys.argv[2] if len(sys.argv) > 2 else "benchmark-results.json"

    results = []

    # Test 1: Sequential (single-thread AI)
    results.append(benchmark_scan(target, "sequential"))

    # Test 2: Parallel AI (parallel_workers=3)
    results.append(benchmark_scan(target, "parallel",
                                  ["--parallel-workers", "3"]))

    # Test 3: With Gitleaks
    results.append(benchmark_scan(target, "with-gitleaks",
                                  ["--gitleaks"]))

    # Test 4: Fast scan (git changes only)
    results.append(benchmark_scan(target, "fast-scan",
                                  ["--fast"]))

    # Summary
    print("\n" + "=" * 60)
    print("  VexCode Benchmark Results")
    print("=" * 60)
    print(f"  Target: {target}\n")
    print(f"  {'Test':<20} {'Time':<10} {'Findings':<10}")
    print(f"  {'-'*40}")
    for r in results:
        status = "❌" if r["exit_code"] != 0 else "✓"
        print(f"  {r['label']:<18} {r['time_seconds']:<8}s {r['findings']:<8} {status}")
    print()

    # Save JSON
    with open(output, "w") as f:
        json.dump(results, f, indent=2)
    print(f"  Results saved to {output}")
    print("=" * 60)


if __name__ == "__main__":
    main()
```

**Kết quả benchmark được lưu vào `process/features/vexcode/reports/benchmark_22-06-26.md`** để dùng trong Chương 4.

Expected output format cho report:
```markdown
# VexCode Benchmark — <date>

**Target**: <project>
**Commit**: <sha>

## Test Results

| Test | Time (s) | Findings | Status |
|------|----------|----------|--------|
| Sequential | 15.2 | 42 | ✓ |
| Parallel (3 workers) | 6.1 | 42 | ✓ |
| With Gitleaks | 17.8 | 46 | ✓ |
| Fast scan | 1.2 | 5 | ✓ |
| With custom rules | 16.5 | 48 | ✓ |

## Speedup
- Parallel vs Sequential: 2.5x
- Fast vs Full scan: 12.7x

## ISO 25010 Coverage (expanded to 7/8 categories)
| Category | Findings | Source |
|----------|----------|--------|
| Security | Gitleaks + 3 custom rules | Day 1 + Day 3 |
| Maintainability | threshold engine ratings + no-print rule | Day 2 + Day 3 |
| Functional Suitability | 3 correctness rules (self-comp, mutable-default, unchecked-return) | Day 3 |
| Operability | 2 error-handling rules (silent-except, bare-except) | Day 3 |
| Reliability | Memory checks, concurrency handling | Day 2 (existing) |
| Performance Efficiency | Parallel scan benchmark | All days |
| Compatibility | valid_exts mở rộng, taxonomy updated | Day 3 |
| Transferability | Taxonomy constants + mappings | Day 3 |
```

#### 3.6 Tests

- Test custom rules với file mẫu chứa hardcoded cred → finding ra đúng
- Test custom rules với file sạch → 0 findings
- Test correctness rules (no-self-comparison, no-mutable-defaults, check-unchecked-return) với file mẫu
- Test operability rules (no-silent-except, no-bare-except) với file mẫu
- Test valid_exts mở rộng: resolver chấp nhận .java, .go, .yaml, .md
- Test taxonomy: 4 category constants mới có trong ISO_METADATA_KEYS
- Test benchmark script dry-run (không cần target thật)

---

## Acceptance Criteria

| # | Criterion | Test |
|---|-----------|------|
| 1 | `vexcode scan --target <dir>` vẫn hoạt động, 0 regression | Run test suite |
| 2 | `vexcode scan --format md` sinh file .md đọc được | Manual check |
| 3 | `vexcode scan --gitleaks` phát hiện secret (test trên repo có secret mẫu) | Manual run |
| 4 | `vexcode scan --thresholds conf/thresholds.toml` fail đúng threshold | Manual run |
| 5 | `vexcode scan --explain` hiển thị explain text ra STDOUT | Manual run |
| 6 | Custom Semgrep rules (security) phát hiện hardcoded cred/print/http | Manual run |
| 7 | Correctness rules (no-self-comparison, no-mutable-defaults, check-unchecked-return) ra findings trên file mẫu | Manual run |
| 8 | Operability rules (no-silent-except, no-bare-except) ra findings trên file mẫu | Manual run |
| 9 | `valid_exts` mở rộng: resolver track .java, .go, .yaml, .md files | Unit test |
| 10 | 4 category constants mới (functional_suitability, operability, compatibility, transferability) có trong ISO_METADATA_KEYS | Unit test |
| 11 | Benchmark script ra số liệu cụ thể | Python run |
| 12 | Markdown report có sections: Summary, By Severity, By Category, Finding Details | Manual check |
| 13 | Gitleaks skip gracefully khi không có git repo hoặc chưa install | Manual run |
| 14 | Threshold violations exit code != 0 | Manual run |

---

## Blast Radius

**Low-Medium risk**:
- Gitleaks integration là new code, không sửa existing flow — chỉ append
- Markdown export là new function, không ảnh hưởng `write_report()` hiện tại
- Threshold engine là module mới, không thay đổi logic cũ — chỉ thêm evaluate step ở cuối pipeline
- `--explain` là output flag, không ảnh hưởng report JSON
- Custom rules là Semgrep config, không sửa Semgrep code
- `valid_exts` mở rộng trong resolver.py là additive (thêm keys, không xóa)
- Taxonomy constants mới trong `iso25010_taxonomy.py` là additive (thêm dict entries, không sửa cũ)
- **Nguy cơ duy nhất**: refactor `__main__.py` để gọi threshold + explain có thể ảnh hưởng flow

**High risk items**:
- Không có — tất cả đều là additive changes

---

## Verification Evidence

Sẽ thu thập sau mỗi phase:

1. **Day 1**:
   - `python -m pytest tests/test_gitleaks.py -v` — pass
   - `python -m pytest tests/test_markdown_export.py -v` — pass
   - Manual: `vexcode scan --target packages/engine --format md` → file .md tồn tại
   - Manual: `vexcode scan --target . --gitleaks` → có security findings hoặc skip message

2. **Day 2**:
   - `python -m pytest tests/test_thresholds.py -v` — pass
   - Manual: `vexcode scan --target . --thresholds conf/thresholds.toml` → exit code 0
   - Manual: `vexcode scan --target . --thresholds conf/thresholds.toml --fail-on-threshold` → exit code 1 khi vi phạm
   - Manual: `vexcode scan --target . --explain` → STDOUT có explain text
   - `python -m pytest tests/ -v` — 0 regression

5. **Day 3**:
   - Manual: `semgrep --config semgrep-rules/custom/ packages/engine/` → findings từ ít nhất 3/8 rules
   - Manual: Test correctness rules với file mẫu (self-comparison, mutable-default, unchecked-return)
   - Manual: Test operability rules với file mẫu (silent-except, bare-except)
   - Unit test: `test_resolver_valid_exts` — .java, .go, .yaml, .md được chấp nhận
   - Unit test: `test_taxonomy_constants` — 4 category constants mới tồn tại
   - `python scripts/benchmark.py --target packages/engine` → số liệu cụ thể
   - Benchmark report lưu vào `process/features/vexcode/reports/`
   - `python -m pytest tests/ -v` — 0 regression

---

## Resume and Execution Handoff

**Để start**: thực hiện tuần tự từ Day 1 → Day 3.

**Mỗi ngày**: làm các task trong phase tương ứng, verify acceptance criteria, báo cáo kết quả.

**Nếu 1 task bị block** (VD: Gitleaks không install được, Semgrep không support custom rules path):
1. Ghi nhận blocker vào phase notes
2. Chuyển sang task song song/độc lập khác
3. Quay lại blocker sau, nếu vẫn blocked → skip và báo cáo

**Nếu còn thời gian** sau 3 ngày:
- Thêm benchmark chart (visual cho Chương 4)
- Viết section mẫu cho report Chapter 4 dựa trên số liệu thu được
