# Lộ Trình Chất Lượng Theo ISO/IEC 25010

> **Bối cảnh**: Các công cụ linter (Ruff, Bandit, ESLint, Radon) đã được tạm treo — IDE sẽ xử lý. Roadmap này tập trung vào những gì công cụ có thể làm mà IDE không làm được: phân tích cross-cutting, bảo mật, kiến trúc, governance, và AI.

---

## 1. Bảng Tổng Quan

| # | Đặc tính | Hiện tại | Mục tiêu | Khoảng cách | Nỗ lực |
|---|----------|----------|----------|-------------|--------|
| 1 | **R** — Reliability | 35% | 85% | +50% | 2 ngày |
| 2 | **F** — Functional Suitability | 40% | 60% | +20% | 4 ngày |
| 3 | **S** — Security | 40% | 75% | +35% | 3 ngày |
| 4 | **M** — Maintainability | 30% | 55% | +25% | 4 ngày |
| 5 | **U** — Operability | 45% | 70% | +25% | 4 ngày |
| 6 | **P** — Performance Efficiency | 50% | 65% | +15% | 2 ngày |
| 7 | **C** — Compatibility | 40% | 50% | +10% | 1 ngày |
| 8 | **T** — Transferability | 30% | 45% | +15% | 2 ngày |

> **Trung bình**: 39% hiện tại → 63% mục tiêu (+24%)
> **Tổng nỗ lực**: ~22 ngày (3 tuần rưỡi)

---

## 2. Thứ Tự Ưu Tiên

```
MỨC 1 — NỀN TẢNG (không làm thì không ai dùng)
  R ─── Reliability ─── 7 bugs, validation, graceful degradation

MỨC 2 — GIÁ TRỊ CỐT LÕI (lý do tồn tại của tool)
  F ─── Functional Suitability ─── dedup, custom rules, threshold gates
  S ─── Security ─── Gitleaks, custom Semgrep rules
  M ─── Maintainability ─── threshold engine, trend chart, AI refactor

MỨC 3 — TRẢI NGHIỆM (làm người dùng quay lại)
  U ─── Operability ─── rating A-E, export, --explain

MỨC 4 — TỐI ƯU (làm tool nhanh hơn, phủ rộng hơn)
  P ─── Performance ─── exclude dirs, batch analysis
  C ─── Compatibility ─── language auto-detection

MỨC 5 — MỞ RỘNG (dễ triển khai, dễ tích hợp)
  T ─── Transferability ─── Docker, CI/CD
```

---

## 3. Chi Tiết Từng Đặc Tính

### 3.1 R — Reliability (Hiện tại: 35% → Mục tiêu: 85%)

**Ý nghĩa**: Tool không crash, xử lý được mọi tình huống bất thường, graceful degradation khi dependency thiếu.

**Hiện trạng — mất 65% vì:**

| Mất điểm | Nguyên nhân | File |
|----------|-------------|------|
| -20% | Không check venv tồn tại trước khi spawn Semgrep | `bridge.js` |
| -15% | Không validate target path | `__main__.py` |
| -10% | Không guard file nhị phân/quá lớn trong Lizard | `complexity.py` |
| -10% | Không xử lý Retry-After header khi 429 | `ai_resolver.py` |
| -10% | Không có timeout cho từng tool trong pipeline | `pipeline/scanner.py` |

**Kế hoạch:**

```
Phase 1 (Ngày 1-2):
├── 1.2 Venv check (bridge.js)             → +15%
├── 1.3 Target path validation (__main__.py) → +15%
├── 1.4 Binary/oversized file guard        → +10%
├── 1.7 Retry-After 429 handling           → +5%
├── Tool timeout mechanism                 → +5%
└── Tổng: +50%
```

**Còn lại 15%** không đạt: testing đầy đủ trên mọi OS, mọi phiên bản Python — cần CI/CD để đảm bảo.

---

### 3.2 F — Functional Suitability (Hiện tại: 40% → Mục tiêu: 60%)

**Ý nghĩa**: Tool phát hiện lỗi chính xác, phân loại đúng, kết quả đáng tin cậy.

**Hiện trạng — mất 60% vì:**

| Mất điểm | Nguyên nhân |
|----------|-------------|
| -20% | Không có dedup — cùng một finding từ nhiều nguồn không được gộp |
| -15% | Không có threshold engine — findings chỉ mang tính tham khảo, không chặn được |
| -15% | Không có custom Semgrep rules — chỉ dùng auto mode |
| -10% | Schema finding chưa có category để phân loại (security/reliability/...) |

**Kế hoạch:**

```
Phase 2 (Ngày 5-6 trên implementation-roadmap):
├── 1.5 Dedup key (rule_id + file + line)  → +10%
├── 2.4 Threshold engine (evaluate & fail) → +10%
├── 3.2 Custom Semgrep rules               → +10%
└── Finding category classification        → +5%
```

**Còn lại 40%** không đạt: không có Ruff (Python-specific patterns), không có ESLint (JS/TS patterns), không có Bandit (Python security patterns). IDE handle phần này.

---

### 3.3 S — Security (Hiện tại: 40% → Mục tiêu: 75%)

**Ý nghĩa**: Quét lỗ hổng bảo mật, secret, misconfiguration. **Đây là điểm mạnh nhất của tool so với IDE.**

**Hiện trạng — mất 60% vì:**

| Mất điểm | Nguyên nhân |
|----------|-------------|
| -25% | Chưa có Gitleaks — không quét được secret/credentials trong codebase |
| -15% | Chưa có custom Semgrep rules riêng cho security |
| -10% | Chưa có dependency vulnerability scanning (Trivy) |
| -10% | AI resolver không handle rate limit đúng cách |

**Kế hoạch:**

```
Phase 2 (Ngày 4):
├── 2.2 Gitleaks integration               → +25%
├── 3.2 Custom Semgrep security rules      → +10%

Phase 3 (Ngày 10):
├── 3.1 (Bandit treo) → thay bằng dependency scan cơ bản → +5%
└── Retry-After 429 (đã fix ở Phase 1)     → +5%
```

**Còn lại 25%** không đạt: Trivy full dependency scanning (database ~50MB, heavy), Bandit Python security (treo), threat modeling nâng cao.

---

### 3.4 M — Maintainability (Hiện tại: 30% → Mục tiêu: 55%)

**Ý nghĩa**: Đo lường và kiểm soát độ phức tạp, nợ kỹ thuật, chất lượng code theo thời gian.

**Hiện trạng — mất 70% vì:**

| Mất điểm | Nguyên nhân |
|----------|-------------|
| -25% | Lizard chỉ informative, không có threshold → metrics vô dụng |
| -15% | Không có trend → không biết code đang cải thiện hay xấu đi |
| -10% | Không có AI refactor suggestions |
| -10% | Không có dedup → findings lộn xộn |
| -10% | Không có maintainability index (Radon treo) |

**Kế hoạch:**

```
Phase 2 (Ngày 5-6):
├── 2.4 Threshold engine (complexity gates) → +25%
├── 1.5 Dedup                               → +10%

Phase 3 (Ngày 12-13):
├── 3.7 Health trend chart                  → +10%
├── 3.6 AI refactor suggestions             → +5%
├── 2.6 Rating A-E (maintainability axis)   → +5%
```

**Còn lại 45%** không đạt: Radon MI (treo), full technical debt quantification, SonarQube-style SQALE — cần những công cụ chuyên sâu hơn.

---

### 3.5 U — Operability (Hiện tại: 45% → Mục tiêu: 70%)

**Ý nghĩa**: Dashboard dễ dùng, CLI rõ ràng, báo cáo hữu ích.

**Hiện trạng — mất 55% vì:**

| Mất điểm | Nguyên nhân |
|----------|-------------|
| -15% | Health score là 1 con số mơ hồ → cần rating A-E chi tiết |
| -10% | Dashboard rỗng khi findings=0 |
| -10% | Không có export (markdown/HTML) |
| -10% | Không có trend chart → không thấy lịch sử |
| -5% | Không có --explain flag |
| -5% | Không có batch analysis UI |

**Kế hoạch:**

```
Phase 1 (Ngày 2):
├── 1.6 Empty state dashboard              → +10%

Phase 2 (Ngày 7):
├── 2.6 Rating A-E (3 trục)                → +15%

Phase 3 (Ngày 10-14):
├── 3.4 Markdown/HTML export               → +10%
├── 3.7 Trend chart                        → +10%
├── 3.8 --explain flag                     → +5%
├── 3.5 Batch analysis                     → +2%
```

**Còn lại 30%** không đạt: IDE integration (VS Code extension, GitHub App), real-time collaborative review, custom dashboard widgets.

---

### 3.6 P — Performance Efficiency (Hiện tại: 50% → Mục tiêu: 65%)

**Ý nghĩa**: Tool quét nhanh, không lãng phí tài nguyên.

**Hiện trạng — mất 50% vì:**

| Mất điểm | Nguyên nhân |
|----------|-------------|
| -20% | Quét cả .venv, node_modules (chưa có exclude dirs) |
| -10% | Lizard chạy trên mọi file không giới hạn kích thước |
| -10% | Không có batch analysis → mỗi lần scan độc lập |
| -5% | Pipeline tuần tự → tools chạy lần lượt |
| -5% | Scan timeout không có → tool treo vô hạn |

**Kế hoạch:**

```
Phase 1 (Ngày 1):
├── 1.1 Exclude dirs (.venv, node_modules, .git...) → +20%

Phase 2:
├── 1.4 File size guard (đã tính trong R)           → +10%

Phase 3 (Ngày 11):
├── 3.5 Batch analysis                              → +5%
├── 3.3 Fast scan git diff (đã có, cần cải thiện)  → +5%
```

**Còn lại 35%** không đạt: parallel tool execution, result caching, incremental analysis engine — architectural changes lớn.

---

### 3.7 C — Compatibility (Hiện tại: 40% → Mục tiêu: 50%)

**Ý nghĩa**: Hỗ trợ nhiều ngôn ngữ lập trình, hoạt động trên nhiều nền tảng.

**Hiện trạng — mất 60% vì:**

| Mất điểm | Nguyên nhân |
|----------|-------------|
| -25% | valid_exts chỉ có .py/.js/.jsx/.ts/.tsx (resolver.py) |
| -15% | CLI/dashboard không có language auto-detection |
| -10% | Resolution prompt không ngữ cảnh hóa theo ngôn ngữ |
| -10% | Metric không được chuẩn hóa theo ngôn ngữ (complexity threshold khác nhau) |

**Kế hoạch:**

```
Phase 3 (Ngày 11):
├── 3.2 Custom Semgrep rules (multi-language)       → +10%
├── Expand valid_exts (thêm .go, .rs, .java...)     → +5%
└── AI prompt context hóa theo ngôn ngữ             → +5%
```

**Còn lại 50%** không đạt: ESLint (JS/TS, treo), Golangci-lint (Go, treo), Clippy (Rust, treo), per-language metric profiles.

---

### 3.8 T — Transferability (Hiện tại: 30% → Mục tiêu: 45%)

**Ý nghĩa**: Dễ cài đặt, cấu hình, tích hợp vào quy trình CI/CD.

**Hiện trạng — mất 70% vì:**

| Mất điểm | Nguyên nhân |
|----------|-------------|
| -25% | Không có Docker image → môi trường khó tái tạo |
| -20% | Không có GitHub Actions / GitLab CI template |
| -15% | Engine không có pyproject.tomp (src layout hiện tại) |
| -10% | Tài liệu cài đặt còn thiếu |


**Kế hoạch:**

```
Phase 3 (Cuối):
├── GitHub Actions example workflow              → +10%
├── Cải thiện documentation/README              → +5%
├── pyproject.toml nếu cần                      → +5%
```

**Còn lại 55%** không đạt: Docker image (cần Dockerfile + CI build), VS Code extension, pre-commit hook, Homebrew/tarball distribution.

---

## 4. Lộ Trình Tích Hợp

```
Tuần 1 (Phase 1): R ─────────────── 7 bugs → 35%→85%
  ├── R, P (exclude dirs)
  └── U (empty state)

Tuần 2 (Phase 2): F ─── S ─── M ─── U
  ├── F: dedup + threshold engine
  ├── S: Gitleaks + custom Semgrep rules
  ├── M: threshold gates + rating A-E
  └── U: rating A-E dashboard

Tuần 3 (Phase 3): U ─── P ─── C ─── T
  ├── U: export + trend + --explain
  ├── P: batch analysis + fast scan
  ├── C: expand extensions + multi-language
  └── T: CI/CD + docs
```

---

## 5. Radar Chart (Hiện Tại vs Mục Tiêu)

```
              F (Functional)
                40
              /    \
             /      \
    T (Trans) 30     \ 35 R (Reliability)
          \           /
           \         /
            \  45   50
         U (Operab.) P (Performance)
               \
                \
           40    40
         C (Compat) S (Security)
               \
                30
              M (Maintainability)

Màu: ██ Hiện tại  ░░ Khoảng cách  ▒▒ Không đạt (do treo linter)
```

---

## 6. Nguyên Tắc Cắt Giảm

Nếu cần rút ngắn thời gian, cắt theo thứ tự:

1. **C (Compatibility)** — +5% vì IDE đã hỗ trợ ngôn ngữ
2. **T (Transferability)** — +5% vì team tự biết cài đặt
3. **P (Performance Efficiency)** — +10%, performance chấp nhận được khi dự án nhỏ
4. **U (Operability)** — Giữ rating A-E, trend, export. Có thể cắt --explain và batch analysis
5. **M (Maintainability)** — Giữ threshold engine. Có thể cắt trend chart và AI refactor
6. **S (Security)** — KHÔNG CẮT
7. **F (Functional Suitability)** — KHÔNG CẮT
8. **R (Reliability)** — KHÔNG CẮT
