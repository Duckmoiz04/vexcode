# Lộ Trình Triển Khai — AI Code Review (ISO 25010 Edition)

> **3 mốc thời gian**: 2 ngày sửa lỗi + 1 tuần tính năng chính + 1 tuần tính năng phụ

---

## Ánh Xạ ISO/IEC 25010

8 đặc tính chất lượng được đề cập trong roadmap này:

| Ký hiệu | Đặc tính | Ý nghĩa trong code review |
|---------|----------|---------------------------|
| **F** | Functional Suitability | Khả năng phát hiện lỗi chính xác, đầy đủ |
| **R** | Reliability | Chịu lỗi tốt, không crash khi tool thiếu |
| **P** | Performance Efficiency | Tốc độ quét, tối ưu tài nguyên |
| **U** | Operability (Usability) | Dễ dùng — CLI flags, dashboard UX |
| **C** | Compatibility | Hỗ trợ nhiều ngôn ngữ, nền tảng |
| **S** | Security | Quét lỗ hổng bảo mật, secret, dependency |
| **M** | Maintainability | Độ phức tạp, naming, style, technical debt |
| **T** | Transferability | Dễ cài đặt, cấu hình, tái sử dụng |

Mỗi tính năng bên dưới đều có tag `[F/R/P/U/C/S/M/T]` cho biết nó ảnh hưởng tới đặc tính nào.

---

## Giai Đoạn 1: Sửa Lỗi Hệ Thống Hiện Tại (2 Ngày)

Mục tiêu: **ổn định pipeline hiện có** — không thêm công cụ mới, chỉ sửa những thứ đang hoạt động chưa đúng.

### 1.1 Scanner: Tự động phát hiện ngôn ngữ & bỏ qua file không liên quan `[P][F]`

**Vấn đề hiện tại**: `scanner.py` chạy Semgrep trên toàn bộ thư mục target, bao gồm `.venv`, `node_modules`, `__pycache__`. Semgrep auto mode quét mọi ngôn ngữ — lãng phí.

**Sửa**:
```python
# Trong scanner.py, thêm ignore patterns trước khi gọi Semgrep
EXCLUDE_DIRS = [".venv", "node_modules", "__pycache__", ".git", ".agents", ".claude", ".codex"]
cmd = ["semgrep", "scan", "--json", "--quiet"]
for d in EXCLUDE_DIRS:
    cmd.extend(["--exclude-dir", d])
cmd.append(target_path)
```

**ISO 25010**: Performance Efficiency (P) — giảm thời gian quét vô ích. Functional Suitability (F) — tránh false positives từ thư viện bên thứ ba.

**Công sức**: ~30 phút

### 1.2 CLI: Kiểm tra Python venv trước khi scan `[R][U]`

**Vấn đề hiện tại**: `bridge.js` spawn Python với đường dẫn cố định `.venv/Scripts/python.exe`. Nếu chưa có venv, lỗi không được báo rõ ràng.

**Sửa**:
```javascript
// Trong bridge.js, kiểm tra venv tồn tại trước khi spawn
function ensureVenv(engineDir) {
  const venvPython = getPythonPath(engineDir);
  if (!existsSync(venvPython)) {
    throw new Error(`Python venv chưa được khởi tạo. Chạy: cd packages/engine && python -m venv .venv`);
  }
}
```

**ISO 25010**: Reliability (R) — lỗi rõ ràng thay vì crash mơ hồ. Operability (U) — thông báo hướng dẫn sửa.

**Công sức**: ~30 phút

### 1.3 Engine: Validation đầu vào — target path, output path `[R]`

**Vấn đề hiện tại**: `__main__.py` không validate `--target` có tồn tại không, `--output` có ghi được không.

**Sửa**:
```python
# Trong validate_args()
if not args.target or not Path(args.target).exists():
    parser.error(f"Target path does not exist: {args.target}")
if args.output:
    output_dir = Path(args.output).parent
    if not output_dir.exists():
        output_dir.mkdir(parents=True, exist_ok=True)
```

**ISO 25010**: Reliability (R) — fail sớm với message rõ ràng thay vì crash giữa chừng.

**Công sức**: ~30 phút

### 1.4 Lizard: Chặn crash trên file binary/lớn `[R]`

**Vấn đề hiện tại**: `complexity.py` dùng `lizard.analyze_file()` trên mọi file — crash nếu file binary hoặc quá lớn.

**Sửa**:
```python
# Trong analyze_file_complexity(), thêm guard
MAX_FILE_SIZE = 1024 * 1024  # 1MB
if os.path.getsize(file_path) > MAX_FILE_SIZE:
    return {"complexity": 0, "cognitive_complexity": 0, "loc": 0, "level": "LOW", "functions": []}
if not is_text_file(file_path):
    return default_metrics()
```

**ISO 25010**: Reliability (R) — không crash trên file không đọc được.

**Công sức**: ~30 phút

### 1.5 Findings: De-duplication cơ bản trước khi lưu `[F][M]`

**Vấn đề hiện tại**: Cùng một lỗi có thể xuất hiện nhiều lần từ Semgrep hoặc từ các nguồn khác — không có dedup.

**Sửa**: Trong `run_analysis()`, thêm bước dedup trước `assemble_report()`:
```python
def deduplicate_findings(findings: list) -> list:
    seen = set()
    unique = []
    for f in findings:
        key = (f["rule_id"], f["file"], f["line"])
        if key not in seen:
            seen.add(key)
            unique.append(f)
    return unique
```

**ISO 25010**: Functional Suitability (F) — không inflated findings. Maintainability (M) — dễ đọc báo cáo.

**Công sức**: ~30 phút

### 1.6 Dashboard: Health score hiển thị sai khi không có findings `[U]`

**Vấn đề hiện tại**: Khi `findings.length === 0`, `computeDashboardStats()` trả về `healthScore: 100` — đúng, nhưng các chart vẫn hiển thị "0" thay vì "No data".

**Sửa**: Trong `HealthScoreChart.tsx` và `CategoryBreakdown.tsx`, thêm empty state khi tất cả giá trị = 0.

**ISO 25010**: Operability (U) — UX rõ ràng khi chưa có dữ liệu.

**Công sức**: ~1 giờ

### 1.7 AI Resolver: Xử lý rate limit 429 một cách thông minh hơn `[R]`

**Vấn đề hiện tại**: `ai_resolver.py` xử lý 429 với exponential backoff (15s, 30s), nhưng không check `Retry-After` header.

**Sửa**:
```python
def post_with_retry(url, headers, data, max_retries=AI_MAX_RETRIES):
    for attempt in range(max_retries + 1):
        response = requests.post(url, headers=headers, json=data)
        if response.status_code == 429:
            retry_after = int(response.headers.get("Retry-After", 15))
            sleep(retry_after + random.uniform(0, 5))
            continue
        ...
```

**ISO 25010**: Reliability (R) — tôn trọng rate limit của server, giảm retry vô ích.

**Công sức**: ~30 phút

**Tổng Phase 1: ~4-5 giờ (2 ngày)**

---

## Giai Đoạn 2: Tính Năng Chính (1 Tuần)

### 2.1 Ruff — Python Linter 700+ rules `[F][M][C]`

**Mục tiêu**: Thêm Ruff vào pipeline, phát hiện style issues, unused imports, deprecated patterns.

**Triển khai**:
```python
# ruff_scanner.py — 60 dòng
def run_ruff(target_path: str, config: str | None = None) -> list[dict]:
    cmd = ["ruff", "check", "--output-format", "json", target_path]
    if config:
        cmd.extend(["--config", config])
    result = subprocess.run(cmd, capture_output=True, text=True)
    findings = json.loads(result.stdout)
    return [normalize_ruff_finding(f) for f in findings]
```

| ISO | Đóng góp |
|-----|----------|
| **F** | Phát hiện thêm ~700 rule Python mà Semgrep không có |
| **M** | Linting + format → code dễ đọc, dễ bảo trì |
| **C** | Ruff hỗ trợ Python 3.12+ đầy đủ, tích hợp pyproject.toml |

**Công sức**: 4 giờ

### 2.2 Gitleaks — Secret Scanning trong git history `[S]`

**Mục tiêu**: Quét toàn bộ lịch sử git để tìm secret, key, token đã commit nhầm.

| ISO | Đóng góp |
|-----|----------|
| **S** | Phát hiện secret trong git history — Semgrep không làm được |

**Triển khai**: Gọi `gitleaks detect --source <target> --report-format json`. Nếu không có git repo → skip với cảnh báo.

**Công sức**: 3 giờ

### 2.3 Radon — Maintainability Index thay Lizard `[M]`

**Mục tiêu**: Thay thế Lizard bằng Radon để có Maintainability Index chuẩn NASA + Halstead metrics.

| ISO | Đóng góp |
|-----|----------|
| **M** | Maintainability Index (0-100) — metric chính cho khả năng bảo trì |

**Triển khai**:
- Giữ nguyên schema output của `analyze_file_complexity()`
- Thêm `maintainability_index`, `halstead_volume`, `halstead_difficulty`
- Xóa dependency `lizard`, thêm `radon`

**Công sức**: 4 giờ

### 2.4 Threshold Engine — Quality Gates chặn merge `[F][U]`

**Mục tiêu**: Biến metrics thành hành động — cấu hình ngưỡng, fail scan nếu vượt quá.

| ISO | Đóng góp |
|-----|----------|
| **F** | Scan không chỉ phát hiện mà còn đánh giá — PASS/FAIL rõ ràng |
| **U** | `--fail-on-threshold` flag + API cấu hình |

**Triển khai**:
```toml
# conf/settings.toml
[thresholds]
max_complexity = 15
max_cognitive = 30
min_maintainability = 50
max_severity_error = 0
max_severity_warning = 100
```

```python
# thresholds.py
def evaluate_thresholds(metrics, findings) -> dict:
    violations = []
    # Check complexity
    for file, m in metrics.get("files", {}).items():
        for func in m.get("functions", []):
            if func["complexity"] > max_complexity:
                violations.append({...})
    # Check severity counts
    error_count = sum(1 for f in findings if f.get("severity") == "error")
    if error_count > max_severity_error:
        violations.append({...})
    return {"passed": len(violations) == 0, "violations": violations}
```

**Công sức**: 5 giờ

### 2.5 AI Resolver: Nâng cấp payload — gửi file-level context thay vì 5 dòng `[F]`

**Mục tiêu**: AI hiện tại chỉ gửi 5 dòng code xung quanh finding — không đủ context. Gửi toàn bộ function chứa finding.

**Sửa**: Trong `ai_resolver.py`, khi đọc surrounding code, mở rộng từ 5 dòng lên toàn bộ function:
```python
# Thay vì read_surrounding_code(file, line, context_lines=5)
# Dùng AST để tìm function boundaries
def extract_function_context(file_path: str, target_line: int) -> str:
    with open(file_path) as f:
        source = f.read()
    tree = ast.parse(source)
    for node in ast.walk(tree):
        if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)):
            if node.lineno <= target_line <= node.end_lineno:
                return source[node.lineno - 1:node.end_lineno]
    return read_surrounding_code(file_path, target_line, 5)
```

| ISO | Đóng góp |
|-----|----------|
| **F** | AI đưa ra gợi ý chính xác hơn với context đầy đủ |

**Công sức**: 3 giờ

### 2.6 Dashboard: Per-dimension rating A-E (thay single health score) `[U][M]`

**Mục tiêu**: Dashboard hiển thị xếp hạng riêng cho Security / Reliability / Maintainability thay vì 1 con số mơ hồ.

| ISO | Đóng góp |
|-----|----------|
| **U** | Người dùng thấy ngay khía cạnh nào yếu — dễ ưu tiên sửa |
| **M** | Maintainability rating dựa trên complexity + style findings |

**Triển khai**: Kế thừa `computeDashboardStats()` hiện tại — thêm 3 rating A-E theo công thức SonarQube:
```typescript
function computeRating(totalDeduction: number): 'A'|'B'|'C'|'D'|'E' {
  if (totalDeduction <= 5)  return 'A';
  if (totalDeduction <= 10) return 'B';
  if (totalDeduction <= 20) return 'C';
  if (totalDeduction <= 50) return 'D';
  return 'E';
}
```

**Công sức**: 4 giờ

**Tổng Phase 2: ~27 giờ (3.5 ngày — làm trong 1 tuần có lề)**

---

## Giai Đoạn 3: Tính Năng Phụ — Ăn Điểm & Dễ Triển Khai (1 Tuần)

### 3.1 Bandit — Python AST Security `[S]`

**Mục tiêu**: Quét Python security patterns cụ thể (hardcoded password, SQLi, pickle, assert, yaml.load).

| ISO | Đóng góp |
|-----|----------|
| **S** | Bandit phát hiện SQL injection, hardcoded password, pickle, assert trong production |

**Vì sao Phase 3**: Bandit và Ruff có overlap ~30% — Ruff mới là ưu tiên cao hơn. Bandit là phần bổ sung.

**Triển khai**: Gọi `bandit -r -f json target` + parse output. ~60 dòng, 2 giờ.

**Công sức**: 2 giờ

### 3.2 Semgrep Rules Tùy Chỉnh `[F][S]`

**Mục tiêu**: Thêm rules Semgrep riêng cho dự án — bắt pattern auto mode bỏ sót.

| ISO | Đóng góp |
|-----|----------|
| **F** | Custom rules bắt pattern đặc thù của dự án |
| **S** | Rule cấm `exec()`, `eval()`, `pickle.loads()` không qua sanitize |

**Triển khai**:
1. Tạo `packages/engine/semgrep-rules/` với 3 rules mẫu
2. Cập nhật `scanner.py` thêm `--config semgrep-rules/` vào lệnh gọi Semgrep

**Công sức**: 3 giờ (3 rules)

### 3.3 Fast Scan bằng Git Diff Tree (thay vì single level) `[P]`

**Mục tiêu**: `--fast` hiện tại chỉ lấy file changed từ `git status --porcelain` — bỏ sót file trong thư mục mới.

| ISO | Đóng góp |
|-----|----------|
| **P** | Quét nhanh chính xác hơn — không bỏ sót file mới |

**Sửa**:
```python
def _detect_fast_scan_files(target: str) -> list[str] | None:
    # Dùng git diff --name-only HEAD~1 HEAD để lấy file thay đổi
    # Kết hợp với git ls-files --others --exclude-standard cho file untracked
    result = subprocess.run(
        ["git", "diff", "--name-only", "HEAD~1", "HEAD"],
        capture_output=True, text=True, cwd=target
    )
    changed = result.stdout.strip().split("\n")
    untracked = subprocess.run(
        ["git", "ls-files", "--others", "--exclude-standard"],
        capture_output=True, text=True, cwd=target
    )
    return [f for f in changed + untracked.stdout.strip().split("\n") if f]
```

**Công sức**: 1 giờ

### 3.4 Báo Cáo Dạng Markdown / HTML Export `[U]`

**Mục tiêu**: Export report ra file markdown hoặc HTML để chia sẻ / attach vào PR.

| ISO | Đóng góp |
|-----|----------|
| **U** | Người dùng có thể share kết quả scan mà không cần mở dashboard |

**Triển khai**: Thêm CLI flag `--format markdown|html|json`:
- Markdown: bảng findings, thống kê, khuyến nghị
- HTML: dashboard tĩnh (inline CSS + JS)

**Công sức**: 4 giờ

### 3.5 Batch Analysis — Quét Nhiều Target Cùng Lúc `[P][U]`

**Mục tiêu**: Cho phép quét nhiều thư mục/dự án trong 1 lệnh.

| ISO | Đóng góp |
|-----|----------|
| **P** | Quét N projects cùng lúc — tiết kiệm thời gian |
| **U** | `vexcode scan --target dir1 dir2 dir3 --output-dir ./reports/` |

**Triển khai**: Thay đổi `--target` thành `--targets` (multiple), chạy pipeline song song với `concurrent.futures.ProcessPoolExecutor`.

**Công sức**: 3 giờ

### 3.6 AI: Gợi ý Tự Động Tổ Chức Lại Code `[M]`

**Mục tiêu**: AI không chỉ gợi ý sửa lỗi mà còn gợi ý tái cấu trúc code.

| ISO | Đóng góp |
|-----|----------|
| **M** | Gợi ý extract function, đổi tên biến, giảm complexity |

**Triển khai**: Prompt mới `SYSTEM_PROMPT_REFACTOR` gửi hàm có complexity > 15, yêu cầu AI gợi ý cách tách nhỏ.

**Công sức**: 3 giờ

### 3.7 Lưu Lịch Sử Thay Đổi Health Score Theo Thời Gian `[U]`

**Mục tiêu**: Dashboard hiển thị chart health score theo thời gian — thấy tiến bộ sau mỗi lần scan.

| ISO | Đóng góp |
|-----|----------|
| **U** | Thấy xu hướng chất lượng — motivation cho team |

**Triển khai**: Mỗi report đã có timestamp. Backend thêm endpoint `GET /api/reports/:project/trend` trả về health score over time. Frontend vẽ line chart.

**Công sức**: 5 giờ

### 3.8 CLI: `--explain` Flag — Giải Thích Finding `[U]`

**Mục tiêu**: Chạy `vexcode scan --explain` để AI giải thích từng finding bằng tiếng Việt / ngôn ngữ người dùng.

| ISO | Đóng góp |
|-----|----------|
| **U** | Developer hiểu lỗi ngay cả khi không quen thuộc với rule |

**Triển khai**: Qua CLI, gọi AI với prompt: `"Giải thích finding {rule_id} ở file {file}:{line} bằng tiếng Việt, dễ hiểu"`.

**Công sức**: 2 giờ

**Tổng Phase 3: ~23 giờ (3 ngày — dư 2 ngày cho việc không lường trước)**

---

## Tổng Quan Theo ISO 25010

| Đặc tính | Phase 1 | Phase 2 | Phase 3 | Tổng |
|----------|---------|---------|---------|------|
| **F** Functional Suitability | Dedup, exclude dirs | Ruff (700+ rules), Threshold, AI context | Custom Semgrep rules | **5 tasks** |
| **R** Reliability | Venv check, validate input, file size guard, 429 handling | — | — | **4 tasks** |
| **P** Performance | Exclude dirs | — | Fast scan git diff, Batch analysis | **2 tasks** |
| **U** Operability | Health score empty state | Rating A-E | Markdown/HTML export, Trend chart, `--explain` | **5 tasks** |
| **C** Compatibility | — | Ruff (Python 3.12+) | — | **1 task** |
| **S** Security | — | Gitleaks | Bandit, Custom rules | **3 tasks** |
| **M** Maintainability | Dedup (clean report) | Ruff (linting), Radon (MI) | AI refactor suggestions | **4 tasks** |
| **T** Transferability | — | — | — | **0 tasks** |

**Ưu tiên theo số tasks**: Functional (5) = Operability (5) > Maintainability (4) > Reliability (4) > Security (3) > Performance (2) > Compatibility (1)

---

## So Sánh Với 4 Công Cụ Đã Phân Tích

| ISO Criteria | SonarQube | Qodo | CodeRabbit | Graphite | **Chúng ta sau roadmap** |
|-------------|-----------|------|------------|----------|--------------------------|
| Functional Suitability | 80% | 65% | 60% | 40% | **75%** (Ruff + Bandit + Gitleaks + custom rules) |
| Reliability | 70% | 50% | 55% | 50% | **85%** (venv check, dedup, validation, 429 handling, file guard) |
| Performance | 60% | 55% | 50% | 60% | **70%** (exclude dirs, fast scan git diff, batch) |
| Operability | 85% | 70% | 75% | 65% | **75%** (rating A-E, trend chart, markdown export, --explain) |
| Compatibility | 60% | 50% | 45% | 40% | **60%** (multi-language sau Phase 5 cũ) |
| Security | 75% | 70% | 55% | 35% | **80%** (Gitleaks + Bandit + custom Semgrep rules) |
| Maintainability | 80% | 60% | 50% | 40% | **85%** (Ruff linting + Radon MI + AI refactor suggestions) |
| Transferability | 50% | 55% | 60% | 70% | **50%** (cần cải thiện — chưa có Docker, chưa CI integration) |

> **Kết luận**: Sau 3 phase, dự án đạt ~72% mức độ bao phủ ISO 25010 trung bình — cạnh tranh với SonarQube (70%) và vượt Qodo (59%), CodeRabbit (56%), Graphite (50%).

---

## Lịch Trình Chi Tiết

```
Ngày 1-2 (Phase 1): Sửa lỗi
├── Sáng ngày 1: 1.1 Exclude dirs + 1.2 Venv check
├── Chiều ngày 1: 1.3 Validate input + 1.4 File size guard
├── Sáng ngày 2: 1.5 Dedup + 1.6 Health score empty state
└── Chiều ngày 2: 1.7 429 handling

Ngày 3-9 (Phase 2): Tính năng chính
├── Ngày 3: 2.1 Ruff (4h)
├── Ngày 4: 2.2 Gitleaks (3h) + 2.3 Radon (4h)
├── Ngày 5-6: 2.4 Threshold engine (5h) + 2.5 AI context (3h)
├── Ngày 7: 2.6 Rating A-E (4h)
├── Ngày 8-9: Dự phòng + test + sửa lỗi phát sinh

Ngày 10-16 (Phase 3): Tính năng phụ
├── Ngày 10: 3.1 Bandit (2h) + 3.2 Custom rules (3h)
├── Ngày 11: 3.3 Fast scan git diff (1h) + 3.4 Markdown export (4h)
├── Ngày 12: 3.5 Batch analysis (3h) + 3.6 AI refactor (3h)
├── Ngày 13: 3.7 Health trend chart (5h)
├── Ngày 14: 3.8 --explain flag (2h) + test
├── Ngày 15-16: Dự phòng + tích hợp + documentation
```

Tổng: **16 ngày** (2 + 7 + 7) — đúng hạn với lề 2 ngày cuối.
