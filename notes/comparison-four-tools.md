# So sánh 4 công cụ: SonarQube vs Graphite vs Qodo vs CodeRabbit

> Cập nhật: 12/06/2026
> Mục đích: So sánh toàn diện dưới góc nhìn ISO/IEC 25010, xếp hạng mức độ đánh giá từng tiêu chí, phân tích cách bù đắp điểm yếu, và rút ra bài học cho AI Code Review project.

---

## 1. Tổng quan 4 công cụ

| Tiêu chí | SonarQube | Graphite | Qodo | CodeRabbit |
|----------|-----------|---------|------|-----------|
| **Loại** | Static analysis platform | Workflow + AI review | AI multi-agent review | AI review |
| **Cơ chế chính** | Rule engine (deterministic) | LLM + ESLint | Multi-agent LLM + dataflow | 2-layer: static + LLM |
| **Deterministic?** | ✅ Có | ❌ Không | ❌ Không | ❌ Không |
| **Rating/Metric?** | ✅ A→E + Debt Ratio | ❌ | ❌ | ❌ |
| **Quality Gate?** | ✅ Pass/Fail | ❌ | ❌ | ❌ |
| **Technical Debt?** | ✅ SQALE | ❌ | ❌ | ❌ |
| **PR-level review?** | ❌ (scan full) | ✅ | ✅ | ✅ |
| **Conversation?** | ❌ | ❌ | ❌ | ✅ |
| **Auto-fix?** | ❌ | ✅ Click apply | ✅ Suggestion | ✅ Suggestion |
| **Test generation?** | ❌ | ❌ | ✅ Qodo Test | ❌ |
| **CLI?** | ❌ (sonar-scanner) | ✅ `gt` CLI | ❌ | ❌ |
| **Dashboard?** | ✅ Project dashboard | ✅ PR management | ✅ PR management | ✅ PR management |
| **Price** | CE free / DC $150/yr | Free + Team $12/user | Free + Pro $15/user | Free + Pro $20/user |

---

## 2. Coverage theo ISO/IEC 25010 — Thang điểm

**Thang điểm**: 0 = không hỗ trợ, 1 = rất thấp, 2 = thấp, 3 = trung bình, 4 = khá, 5 = tốt, 6 = rất tốt

| # | ISO 25010 Characteristic | SonarQube | Graphite | Qodo | CodeRabbit | Trung bình |
|---|-------------------------|-----------|---------|------|-----------|-----------|
| 1 | **Functional Suitability** | ⭐⭐ | ⭐ | ⭐⭐⭐ | ⭐⭐⭐ | 2.25 |
| 2 | **Performance Efficiency** | ⭐⭐ | ⭐ | ⭐⭐ | ⭐⭐ | 1.75 |
| 3 | **Compatibility** | ⭐ | 0 | 0 | 0 | 0.25 |
| 4 | **Usability** | ⭐ | 0 | 0 | 0 | 0.25 |
| 5 | **Reliability** | ⭐⭐⭐⭐⭐⭐ | ⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐ | 3.50 |
| 6 | **Security** | ⭐⭐⭐⭐⭐⭐ | ⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐ | 3.75 |
| 7 | **Maintainability** | ⭐⭐⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐ | 3.75 |
| 8 | **Portability** | ⭐⭐ | 0 | 0 | 0 | 0.50 |
| 9 | **Transaction Integrity** | ⭐ | 0 | 0 | 0 | 0.25 |
| | **Tổng điểm** | **27/54** | **9/54** | **15/54** | **14/54** | |

### Ý nghĩa

| Công cụ | Điểm | Xếp hạng |
|---------|------|---------|
| **SonarQube** | 27/54 (50%) | Dẫn đầu về breadth — nhưng vẫn chỉ cover được 3/9 tiêu chí ở mức tốt |
| **Qodo** | 15/54 (28%) | Nhờ multi-agent + dataflow security |
| **CodeRabbit** | 14/54 (26%) | LLM context hiểu 1 phần logic |
| **Graphite** | 9/54 (17%) | Chỉ làm PR review nhẹ |

> **Kết luận quan trọng**: Không tool nào cover quá 50% ISO 25010. Static analysis vốn có giới hạn cố hữu: 5/9 tiêu chí (Compatibility, Usability, Portability, Transaction Integrity, 1 phần Performance) không thể kiểm tra bằng static code analysis — cần runtime testing.

---

## 3. Chi tiết từng tiêu chí — Cách 4 tool đánh giá

### Tiêu chí 1: Functional Suitability

| Tool | Điểm | Cách đánh giá | Sub-characteristics |
|------|------|--------------|-------------------|
| **SonarQube** | ⭐⭐ | Rule BUG phát hiện logic pattern sai: điều kiện luôn true/false, so sánh vô nghĩa, toán tử sai | Functional correctness (1 phần) |
| **Graphite** | ⭐ | LLM check diff-level logic → chỉ phát hiện lỗi đơn giản | Functional correctness (rất hạn chế) |
| **Qodo** | ⭐⭐⭐ | LLM review từng function + Agent 3 chuyên logic → phát hiện off-by-one, edge case, error handling | Functional correctness + boundary analysis |
| **CodeRabbit** | ⭐⭐⭐ | LLM đọc full context file → hiểu function flow → phát hiện logic inconsistency | Functional correctness (LLM hiểu business logic) |
| **Giới hạn chung** | | **Không tool nào kiểm tra được Completeness** (code có đầy đủ chức năng không) và **Appropriateness** (code có đúng nghiệp vụ không) | |

### Tiêu chí 2: Performance Efficiency

| Tool | Điểm | Cách đánh giá |
|------|------|--------------|
| **SonarQube** | ⭐⭐ | Rule CODE_SMELL phát hiện pattern chậm: string concat, boxing, collection.size() |
| **Graphite** | ⭐ | LLM phát hiện N+1 query pattern cơ bản |
| **Qodo** | ⭐⭐ | LLM phát hiện redundant computation, bad data structure |
| **CodeRabbit** | ⭐⭐ | LLM phát hiện performance anti-pattern |
| **Giới hạn chung** | | **Không tool nào đo actual performance** — tất cả chỉ pattern recognition. Cần profiler (cProfile, Chrome DevTools) |

### Tiêu chí 3: Compatibility

| Tool | Điểm | Cách đánh giá |
|------|------|--------------|
| **SonarQube** | ⭐ | Rule phát hiện deprecated API → có thể gây incompatibility |
| **Graphite** | 0 | Không |
| **Qodo** | 0 | Không |
| **CodeRabbit** | 0 | Không |
| **Giới hạn chung** | | **Cần runtime testing** cross-browser, cross-platform, cross-version |

### Tiêu chí 4: Usability

| Tool | Điểm | Cách đánh giá |
|------|------|--------------|
| **SonarQube** | ⭐ | Rule S2068 (hardcoded credentials) — 1 số interpretation coi là usability |
| **Graphite** | 0 | Không |
| **Qodo** | 0 | Không |
| **CodeRabbit** | 0 | Không |
| **Giới hạn chung** | | **Cần UX testing, accessibility audit (axe-core, Lighthouse), manual review** |

### Tiêu chí 5: Reliability

| Tool | Điểm | Cách đánh giá | Sub-characteristics |
|------|------|--------------|-------------------|
| **SonarQube** | ⭐⭐⭐⭐⭐⭐ | **Mạnh nhất**: 9 sub-categories BUG, dataflow analysis, symbolic execution. Reliability Rating A→E | Fault tolerance (✅), Maturity (△), Recoverability (△) |
| **Graphite** | ⭐⭐ | LLM check null pointer, edge case cơ bản | Fault tolerance hạn chế |
| **Qodo** | ⭐⭐⭐ | Agent 3 logic review + Agent 2 static analysis → phát hiện null check, resource leak, error handling | Fault tolerance (khá hơn Graphite) |
| **CodeRabbit** | ⭐⭐⭐ | LLM với full context → phát hiện logic error, race condition, null pointer | Fault tolerance (depth nhờ context) |
| **Ghi chú** | | SonarQube dẫn đầu nhờ **symbolic execution** — LLM không thể sánh về deterministic bug detection | |

### Tiêu chí 6: Security

| Tool | Điểm | Cách đánh giá | Sub-characteristics |
|------|------|--------------|-------------------|
| **SonarQube** | ⭐⭐⭐⭐⭐⭐ | **Mạnh nhất**: OWASP + CWE + SANS mapping, dataflow taint tracking, Security Hotspot workflow. 300+ rules Python | Confidentiality (✅), Integrity (✅), Authenticity (△) |
| **Graphite** | ⭐⭐ | Regex scanner (secret detection) + LLM cơ bản | Confidentiality (regex) |
| **Qodo** | ⭐⭐⭐⭐ | **Agent 4 chuyên security**: dataflow tracking + taint analysis + OWASP prompting + dependency scan | Confidentiality (✅), Integrity (✅, 1 phần) |
| **CodeRabbit** | ⭐⭐⭐ | LLM OWASP prompting + regex scanner | Confidentiality (✅, 1 phần) |
| **Ghi chú** | | Qodo depth nhất trong AI tools nhờ agent chuyên trách + dataflow | |

### Tiêu chí 7: Maintainability

| Tool | Điểm | Cách đánh giá | Sub-characteristics |
|------|------|--------------|-------------------|
| **SonarQube** | ⭐⭐⭐⭐⭐⭐ | **Mạnh nhất**: 12+ sub-categories CODE_SMELL, Cognitive Complexity, Technical Debt, Duplication, Naming, Coupling. Maintainability Rating A→E | Analysability (✅), Modifiability (✅), Modularity (✅), Reusability (△) |
| **Graphite** | ⭐⭐⭐ | ESLint/Prettier integration + LLM style check | Analysability (style + convention) |
| **Qodo** | ⭐⭐⭐ | Agent 2 + 3: code style, best practice, suggestion | Analysability + Modifiability |
| **CodeRabbit** | ⭐⭐⭐ | LLM: naming, readability, complexity, duplication | Analysability + Modifiability |
| **Ghi chú** | | SonarQube vượt trội nhờ **Cognitive Complexity** (phát minh riêng) và **Debt Ratio** — LLM không có metric tương đương | |

### Tiêu chí 8: Portability

| Tool | Điểm | Cách đánh giá |
|------|------|--------------|
| **SonarQube** | ⭐⭐ | Rule phát hiện platform-specific code (path separator, Python 2 vs 3, deprecated API) |
| **Graphite** | 0 | Không |
| **Qodo** | 0 | Không |
| **CodeRabbit** | 0 | Không |
| **Giới hạn chung** | | **Cần platform testing** thực tế |

### Tiêu chí 9: Transaction Integrity (ISO 25023)

| Tool | Điểm | Cách đánh giá |
|------|------|--------------|
| **SonarQube** | ⭐ | Rule S2232 (commit/rollback) — Java chủ yếu |
| **Graphite** | 0 | Không |
| **Qodo** | 0 | Không |
| **CodeRabbit** | 0 | Không |
| **Giới hạn chung** | | **Cần runtime ACID testing** |

---

## 4. Cách 4 tool bù đắp điểm yếu

### SonarQube

| Điểm yếu | Cách bù đắp |
|----------|------------|
| Không hiểu business logic | Không bù — chấp nhận giới hạn, chỉ làm static analysis |
| False positive | Cơ chế "Mark as False Positive" + Issue lifecycle |
| Không phát hiện lỗi mới (zero-day pattern) | Cập nhật rule liên tục, cộng đồng contribute |
| Không phân tích được logic phức tạp | Quality Gate + rating khuyến khích code đơn giản |
| Không có PR-level review | SonarQube for IDE plugin + SonarLint cho local |

→ **Triết lý**: Đo lường được, reproducible, predictable — cái được của deterministic.

### Graphite

| Điểm yếu | Cách bù đắp |
|----------|------------|
| Thiếu depth review | Tập trung vào **tốc độ** — developer không bị chặn quá lâu |
| Không có rating | Không cần — mục đích là PR review nhanh, không phải quality tracking |
| Không có security depth | Assume developer có dedicated security tool riêng |
| LLM không deterministic | Chấp nhận, vì "better to catch 80% fast than 95% slow" |

→ **Triết lý**: *"Speed over depth. The best review is the one that doesn't block the developer."*

### Qodo

| Điểm yếu | Cách bù đắp |
|----------|------------|
| Chậm (nhiều agents) | Chạy parallel agents → giảm latency |
| Thiếu metric | Bù bằng **test generation** — unique feature không tool nào có |
| LLM không reproducible | Static analysis agent (Agent 2) deterministic cho 1 phần |
| Cost nhiều LLM calls | Dùng model khác nhau cho agent khác nhau (model nhỏ cho static, GPT-4 cho logic) |

→ **Triết lý**: *"Multi-agent specialization beats single generalist agent — split and conquer."*

### CodeRabbit

| Điểm yếu | Cách bù đắp |
|----------|------------|
| Thiếu deterministic | Two-layer: regex + static layer 1 deterministic |
| Không reproducible | Conversation mode cho phép dev hỏi lại → LLM adjust |
| Token cost | Chia thành review units → token-efficient |
| Single agent | LLM mạnh (GPT-4/Claude) bù đắp cho việc thiếu specialization |
| Không có metric | PR Walkthrough + Summary — visualization thay vì con số |

→ **Triết lý**: *"Context is king. A great generalist with full context beats multiple specialists with partial context."*

---

## 5. So sánh tổng quan — Bảng quyết định

| Bạn cần | Chọn |
|---------|------|
| **Quality metric + tracking** dài hạn | **SonarQube** |
| **PR review nhanh**, không block dev | **Graphite** |
| **Security depth** + AI review | **Qodo** (dataflow + multi-agent) |
| **Review sâu nhất** cho PR phức tạp | **CodeRabbit** (full context + conversation) |
| **Auto-generate test** | **Qodo** |
| **CLI-first workflow** | **Graphite** |
| **CI/CD quality gate** | **SonarQube** |
| **Rẻ nhất** | **CodeRabbit** (Free) hoặc **SonarQube CE** (free self-host) |

---

## 6. Bài học cho AI Code Review project

### 6.1 Kiến trúc hybrid đề xuất

Từ phân tích 4 tool, kiến trúc tối ưu cho project:

```
AI Code Review ───── Hybrid Architecture ──────────────────────────
│
├── Layer 1: Static Analysis (Deterministic) ← SonarQube pattern
│   ├── Semgrep (pattern matching + dataflow)  ← Đã có
│   ├── Ruff (800+ lint rules)                 ← Cần thêm
│   ├── trivy (dependency CVE)                 ← Cần thêm
│   ├── gitleaks (secret detection)            ← Cần thêm
│   └── Radon (complexity metrics)             ← Cần thêm (thay Lizard)
│
├── Layer 2: Metrics & Rating ← SonarQube pattern
│   ├── Technical Debt calculation
│   ├── A→E rating cho Reliability / Security / Maintainability
│   ├── Quality Gate (pass/fail)
│   └── Health score dashboard ← Đã có 1 phần
│
├── Layer 3: AI Review ← CodeRabbit + Qodo pattern
│   ├── LLM-based logic review (Agent 3 của Qodo)
│   ├── AI-generated remediation ← Đã có skeleton
│   ├── Confidence score per finding
│   ├── Conversation mode (tại sao cái này là lỗi?)
│   └── Review units (chia function nhỏ)
│
└── Layer 4: Workflow ← Graphite pattern
    ├── PR-level scan (git diff → chỉ scan file changed)
    ├── Auto-fix suggestions (click apply)
    └── File size warning
```

### 6.2 Cụ thể: Các tính năng nên thêm

| Tính năng | Học từ | Ưu tiên | Nỗ lực |
|-----------|--------|---------|--------|
| **Phân loại finding** (Bug/Vuln/Smell) | SonarQube | 🔴 Cao | 2-4 giờ — mapping rule_id → type |
| **Rating A→E** thay vì health score | SonarQube | 🔴 Cao | 4-6 giờ — thay đổi dashboard |
| **Quality Gate** (pass/fail CI) | SonarQube | 🔴 Cao | 6-8 giờ — threshold config |
| **Conversation mode** (hỏi về finding) | CodeRabbit | 🟡 Trung bình | 8-12 giờ — UI + API backend |
| **Confidence score** per finding | CodeRabbit | 🟡 Trung bình | 2-3 giờ — thêm field vào finding |
| **Auto-fix suggestion** (AI gen) | Graphite | 🟡 Trung bình | 6-10 giờ — nâng cấp AI resolver |
| **PR-level scan** (git diff) | Graphite | 🟢 Thấp | 2-3 giờ — đã có --fast mode |
| **Test generation** | Qodo | 🟢 Thấp | 20+ giờ — feature lớn |

### 6.3 Các nguyên tắc cần giữ

| Nguyên tắc | Lý do | Vi phạm từ tool nào? |
|-----------|-------|--------------------|
| **Deterministic cho pattern biết trước** | Security + reliability pattern cần reproducible | CodeRabbit (dùng LLM cho mọi thứ) |
| **Metric phải measurable** | Không metric → không thể cải thiện | Graphite (không có rating) |
| **Quality Gate phải pass/fail** | CI/CD cần gate rõ ràng | Qodo (không có gate) |
| **LLM chỉ là optional layer** | Cost + reproducibility | CodeRabbit (core là LLM) |

---

## 7. Hiện tại project đang ở đâu?

### ✅ Đã có

```
Layer 1 - Static Analysis:
  ├── Semgrep scan (auto registry, 2918 rules) ✅
  ├── Mock scan (test mode) ✅
  ├── Fast scan (git status --porcelain) ✅
  ├── GitNexus enrichment (AST graph context) ✅
  └── Lizard complexity (CCN, cognitive, LOC) ✅

Layer 3 - AI Review:
  ├── 9router AI resolver (remediation suggestion) ✅ (skeleton)
  └── Naming audit (AI naming quality) ✅

Dashboard:
  ├── Findings list + filters ✅
  ├── Complexity leaderboards ✅
  ├── Code inspector (per-file metrics) ✅
  └── Health score (0-100) ✅

CLI:
  ├── scan/analyze command ✅
  ├── serve (dashboard) ✅
  └── --mock-scan, --mock-ai, --fast ✅
```

### ❌ Còn thiếu (theo thứ tự ưu tiên)

```
Layer 1 - Static Analysis (OSS tools):
  ├── Ruff: 800+ maintainability rules ❌ (dễ nhất + lợi ích cao nhất)
  ├── trivy: dependency CVE scanning ❌
  ├── gitleaks: secret detection ❌
  └── Radon: complexity metrics (thay Lizard) ❌

Layer 2 - Metrics & Rating:
  ├── Phân loại finding: Bug / Vulnerability / Code Smell ❌
  ├── Rating A→E cho từng khía cạnh ❌
  ├── Technical Debt calculation ❌
  └── Quality Gate (pass/fail) ❌

Layer 3 - AI Review (nâng cấp):
  ├── Confidence score per finding ❌
  ├── Conversation mode ❌
  └── Auto-fix suggestion (click apply) ❌
```

### 📊 Ước tính tổng thể

| Hạng mục | Trạng thái | % hoàn thành |
|----------|-----------|-------------|
| **Static Analysis Engine** | Cơ bản (Semgrep + Lizard) | ~40% (còn thiếu Ruff, trivy, gitleaks, Radon) |
| **AI Review** | Skeleton (9router + naming audit) | ~25% (còn thiếu confidence, conversation, auto-fix) |
| **Metrics & Dashboard** | 1 health score + findings UI | ~50% (còn thiếu rating, debt, quality gate) |
| **CLI & API** | CLI + Express server | ~80% (cơ bản hoàn chỉnh) |
| **Testing** | 75 Node + 72 Python tests | ~60% (còn thiếu integration test cho tools mới) |
| **Tổng thể** | | **~45%** |

---

## 8. Lộ trình đề xuất (3 giai đoạn)

### Giai đoạn 1 (1-2 tuần) — Static Analysis Depth

| Task | Tool | Nỗ lực | Lợi ích |
|------|------|--------|---------|
| Thêm Ruff | Maintainability (800+ rules) | 2-4 giờ | ✅ Cao nhất — coverage code style + convention |
| Thêm gitleaks | Security (secret detection) | 2-3 giờ | ✅ Phát hiện credential leak |
| Thêm Radon | Maintainability (complexity) | 2-3 giờ | ✅ Chuẩn hóa metrics |
| Phân loại finding | Bug/Vuln/Smell mapping | 2-4 giờ | ✅ Nền tảng cho rating |

### Giai đoạn 2 (2-4 tuần) — Metrics & Rating

| Task | Nỗ lực |
|------|--------|
| Technical Debt calculation | 6-10 giờ |
| Rating A→E cho 3 dimensions | 4-6 giờ |
| Quality Gate config | 6-8 giờ |
| Cập nhật dashboard | 4-6 giờ |

### Giai đoạn 3 (4-8 tuần) — AI Review Nâng cao

| Task | Nỗ lực | Học từ |
|------|--------|--------|
| Confidence score | 2-3 giờ | CodeRabbit |
| Conversation mode | 8-12 giờ | CodeRabbit |
| Auto-fix LLM suggestion | 6-10 giờ | Graphite |
| PR-level analysis | 4-6 giờ | Graphite |

---

## 9. Tổng kết

| Khía cạnh | Nhận xét |
|-----------|---------|
| **Không tool nào cover > 50% ISO 25010** | Static analysis có giới hạn — 5/9 tiêu chí cần runtime |
| **SonarQube dẫn đầu về metric + reproducibility** | 3 tiêu chí ở mức tốt nhất có thể cho static analysis |
| **CodeRabbit + Qodo dẫn đầu về AI depth** | Nhưng thiếu metric, không reproducible |
| **Graphite dẫn đầu về workflow + speed** | AI chỉ là phụ — triết lý khác hẳn |
| **Hướng đi tốt nhất: Hybrid** | Giữ deterministic của SonarQube + thêm LLM layer như CodeRabbit |
| **Project hiện tại đang ở ~45%** | Cốt lõi static analysis đã có, cần thêm OSS tools + metric + AI depth |
