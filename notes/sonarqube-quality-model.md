# SonarQube & ISO/IEC 25010 — Phân tích chi tiết

> Cập nhật: 12/06/2026
> Mục đích: Đánh giá SonarQube dưới góc nhìn tiêu chuẩn chất lượng quốc tế ISO/IEC 25010:2011 + ISO 25023:2016

---

## 1. ISO/IEC 25010 — 8 Product Quality Characteristics

ISO/IEC 25010:2011 định nghĩa **8 characteristics** chính, mỗi characteristic có nhiều **sub-characteristics**. ISO 25023:2016 định nghĩa measures để đo lường — trong đó có **Transaction Integrity**. Tổng cộng **9 tiêu chí**:

| # | Characteristic | Sub-characteristics |
|---|---------------|-------------------|
| 1 | **Functional Suitability** | Functional completeness, Functional correctness, Functional appropriateness |
| 2 | **Performance Efficiency** | Time behaviour, Resource utilisation, Capacity |
| 3 | **Compatibility** | Co-existence, Interoperability |
| 4 | **Usability** | Appropriateness recognisability, Learnability, Operability, User error protection, UI aesthetics, Accessibility |
| 5 | **Reliability** | Maturity, Availability, Fault tolerance, Recoverability |
| 6 | **Security** | Confidentiality, Integrity, Non-repudiation, Accountability, Authenticity |
| 7 | **Maintainability** | Modularity, Reusability, Analysability, Modifiability, Testability |
| 8 | **Portability** | Adaptability, Installability, Replaceability |
| 9 | **Transaction Integrity** (ISO 25023) | Data consistency, Rollback correctness, Concurrency control |

---

## 2. SonarQube coverage theo ISO 25010

### ✅ Đáp ứng TỐT — Có thể đánh giá tự động ở mức production

| # | Tiêu chí | Mức | Sub-characteristics | Cách triển khai |
|---|---------|-----|---------------------|----------------|
| **5** | **Reliability** | 🟢 Rất tốt | **Fault tolerance** (✅), Maturity (△), Recoverability (△) | Rule type = **BUG**. Phát hiện null pointer, resource leak, unreachable code, infinite loop, exception handling lỗi, type confusion. Tính **Reliability Rating A→E** dựa trên count bugs theo severity. |
| **6** | **Security** | 🟢 Rất tốt | **Confidentiality** (✅), **Integrity** (✅), **Authenticity** (△), Accountability (❌), Non-repudiation (❌) | Rule type = **VULNERABILITY + SECURITY_HOTSPOT**. Mapping OWASP Top 10 + CWE + SANS Top 25. Phát hiện injection, XSS, hardcoded credentials, crypto weak, path traversal, CSRF, XXE. Tính **Security Rating A→E** + **Security Review Rating** riêng cho hotspots. |
| **7** | **Maintainability** | 🟢 Rất tốt | **Analysability** (✅), **Modifiability** (✅), **Modularity** (✅), **Reusability** (△), Testability (❌) | Rule type = **CODE_SMELL**. Cognitive Complexity, Technical Debt, Duplication, Code size, Naming convention, Cyclomatic Complexity, Coupling. Tính **Maintainability Rating A→E** qua Debt Ratio (SQALE). |

### ⚠️ Đáp ứng MỘT PHẦN — Có thể ước lượng nhưng không đầy đủ

| # | Tiêu chí | Mức | Sub-characteristics | Cách triển khai |
|---|---------|-----|---------------------|----------------|
| **1** | **Functional Suitability** | 🔴 Thấp | Functional correctness (✅ 1 phần), Completeness (❌), Appropriateness (❌) | Một số BUG rules phát hiện logic sai (điều kiện luôn true/false, toán tử sai, so sánh vô nghĩa). Nhưng **không thể kiểm tra business logic** — giới hạn cố hữu của static analysis. |
| **2** | **Performance Efficiency** | 🟡 Trung bình | Time behaviour (△), Resource utilisation (△), Capacity (❌) | Một số CODE_SMELL rules phát hiện patterns chậm: string concat trong loop, boxing/unboxing, collection.size(). **Không chạy benchmark**, không đo actual performance. |
| **4** | **Usability** | 🔴 Rất thấp | Operability (△ 1 phần), User error protection (❌), UI aesthetics (❌), Accessibility (❌), Learnability (❌), Recognisability (❌) | Hầu như **không có gì**. Usability cần UX testing, không phải static analysis. |
| **8** | **Portability** | 🟡 Trung bình | Adaptability (△), Installability (❌), Replaceability (❌) | Rule phát hiện platform-specific code (Python 2 vs 3, path separator). Một số rule về deprecated API. Không kiểm tra khả năng cài đặt hay thay thế module. |

### ❌ Không đáp ứng

| # | Tiêu chí | Lý do |
|---|---------|-------|
| **3** | **Compatibility** | Co-existence và Interoperability không thể kiểm tra bằng static analysis. SonarQube có thể phát hiện deprecated API (ảnh hưởng compatibility) nhưng rất hạn chế. |
| **9** | **Transaction Integrity** | Đảm bảo ACID, rollback, concurrency control cần runtime testing hoặc code review tay. |

---

## 3. Cách SonarQube tổ chức rules — Rule Taxonomy

Mỗi rule trong SonarQube có 4 metadata quyết định cách phân loại và tính điểm:

```yaml
Rule:
  key: "python:S2259"        # Mã rule: ngôn_ngữ:STT
  type: "BUG" | "VULNERABILITY" | "CODE_SMELL" | "SECURITY_HOTSPOT"
  severity: "BLOCKER" | "CRITICAL" | "MAJOR" | "MINOR" | "INFO"
  tags: ["cwe-89", "owasp-a1", "injection", "sans-top25"]
  defaultDebtRemFn:
    baseEffort: "5min"
    type: "LINEAR" | "LINEAR_OFFSET" | "CONSTANT"
```

Dựa vào `type` → xếp vào 1 trong 3 Software Quality dimensions:

| type | Dimension |
|------|-----------|
| `BUG` | Reliability |
| `VULNERABILITY` | Security |
| `CODE_SMELL` | Maintainability |
| `SECURITY_HOTSPOT` | Security (riêng) |

Tags phân loại thành sub-categories. Cây taxonomy đầy đủ:

```
Multi-criteria tags ─────────────────────────────────────────
├── "cwe-{number}"      → mã CWE (cwe-89, cwe-79...)
├── "owasp-a1"..."a10"  → OWASP Top 10 2021
├── "sans-top25"        → SANS/CWE Top 25
└── "pci-dss"           → PCI Data Security Standard

Reliability tags ────────────────────────────────────────────
├── "pitfall", "null-pointer", "leak", "resource"
├── "multi-threading", "recursion", "type-dependent"
├── "error-handling", "serialization"
├── "overflow", "zero", "unused", "dead-code"
└── "suspicious"

Security tags ───────────────────────────────────────────────
├── "injection", "xss", "csrf", "auth", "crypto"
├── "ddos", "privacy", "rails", "spring"
└── Specific CWE tags per rule

Maintainability tags ────────────────────────────────────────
├── "brain-overload", "convention", "design"
├── "bad-practice", "confusing", "clumsy"
├── "performance", "lock-in", "certification"
├── "unpredictable", "pitfall", "suspicious"
└── "user-experience"
```

---

## 4. Cách SonarQube tính toán bên trong từng tiêu chí

### 4.1 Reliability — Cách tính

**9 sub-categories của BUG**:

| Sub-category | Tag | Ví dụ rule |
|-------------|-----|-----------|
| Null-pointer dereference | `null-pointer`, `pitfall` | `S2259` |
| Resource leak | `leak`, `resource` | `S2095` |
| Infinite loop / recursion | `recursion`, `bug` | `S2190` |
| Type confusion / cast error | `type-dependent`, `confusing` | `S1944` |
| Unreachable code | `unused`, `dead-code` | `S1763` |
| Integer overflow / division by zero | `overflow`, `zero` | `S3516` |
| Exception handling lỗi | `error-handling`, `catch` | `S1751` |
| Concurrency / threading | `multi-threading`, `lock` | `S2886` |
| Serialization / I/O | `serialization`, `io` | `S2674` |

**Công thức Reliability Rating**:

```
reliabilityRating(bugs[]):
    if any blocker → E
    if any critical → D
    if any major → C
    if any minor/info → B
    else → A
```

> Chỉ cần 1 blocker bug là kéo rating xuống E, bất kể có 1000 minor bug.

### 4.2 Security — Cách tính

**Sub-categories theo CWE**:

| CWE Family | Security Sub-category | Rule count (Python) |
|-----------|----------------------|--------------------|
| CWE-78, 88, 94 | Injection (SQL, OS, LDAP) | ~12 |
| CWE-79, 80, 87 | XSS | ~15 |
| CWE-22, 23, 36 | Path Traversal | ~5 |
| CWE-326, 327, 328 | Cryptography | ~8 |
| CWE-287, 384 | Authentication | ~7 |
| CWE-352 | CSRF | ~3 |
| CWE-200, 209 | Information Disclosure | ~6 |
| CWE-798, 259 | Hardcoded Credentials | ~3 |
| CWE-295, 297 | SSL/TLS | ~5 |
| CWE-611, 776 | XXE | ~3 |
| CWE-502 | Deserialization | ~4 |

**Công thức Security Rating** — giống Reliability, dùng VULNERABILITY count.

**Security Review Rating** riêng cho SECURITY_HOTSPOT:

```
A: 100% reviewed
B: ≥ 80%
C: ≥ 50%
D: > 0%
E: 0% (không review hotspot nào)
```

### 4.3 Maintainability — Cách tính (phức tạp nhất)

**12+ sub-categories của CODE_SMELL**:

| Sub-category | Tag | Debt mỗi lần |
|-------------|-----|-------------|
| Naming convention | `convention`, `naming` | 5min |
| Code complexity | `brain-overload`, `confusing` | 30min |
| Function/file size | `size` | 10min |
| Duplication | `pitfall`, `clumsy` | 2min/token |
| Comment / documentation | `documentation`, `unused` | 1min |
| Dead code / unused | `unused`, `dead-code` | 2min |
| Coding standard | `bad-practice` | 1min |
| Design / architecture | `design`, `coupling` | 1h |
| Exception handling style | `error-handling` | 10min |
| Suspicious construct | `suspicious` | 5min |
| Performance | `performance` | 2min |
| Modularity | `modularity` | 30min |

**Cognitive Complexity** — phát minh riêng của SonarQube (đo độ khó đọc hiểu, khác CCN):

```
Base increment: +1 cho mỗi cấu trúc (if, for, while, catch, switch)
Nesting increment: +1 cho mỗi cấp nesting thêm
Structural: +4 recursion, +1 catch/break/continue
```

**Công thức Maintainability Rating** (dùng Debt Ratio):

```
sqale_index_minutes  = Σ(effort của tất cả code smells)
development_cost     = LOC × 3.6 phút
debt_ratio           = sqale_index / development_cost

A: ≤ 5%
B: ≤ 10%
C: ≤ 20%
D: ≤ 50%
E: > 50%
```

### 4.4 Cơ chế phát hiện — 3 cấp độ

| Cấp độ | Cơ chế | Độ sâu | Ví dụ |
|--------|--------|--------|-------|
| **Parser-level** (token/AST) | Phân tích cú pháp | Nhanh, chính xác cao | Semicolon thiếu, tên sai convention |
| **Symbolic execution** (dataflow) | Flow-sensitive | Trung bình | Null check sau dereference, taint analysis |
| **Semantic analysis** (type-aware) | Hiểu type system | Sâu, chậm hơn | Method override sai, generic type violation |

---

## 5. Xếp hạng độ khó triển khai cho AI Code Review

### Cấp 1 — Dễ (có tool OSS sẵn)

| Hạng | Tiêu chí ISO | Tool OSS | Lý do |
|------|-------------|---------|-------|
| 1 | Maintainability (code style) | **Ruff** | Rust, 800+ rules, JSON output |
| 2 | Security (secret detection) | **gitleaks** | Go binary, JSON output |
| 3 | Maintainability (complexity) | **Radon** | Python native, thay Lizard |
| 4 | Reliability (type safety) | **mypy** | Python type checker |

### Cấp 2 — Trung bình

| Hạng | Tiêu chí ISO | Tool OSS | Lý do |
|------|-------------|---------|-------|
| 5 | Security (dependency CVE) | **trivy** | Output lớn, cần filter |
| 6 | Maintainability (duplication) | **jscpd** | Cần threshold logic |
| 7 | Maintainability (debt ratio) | **Custom** | Phải tự xây mapping |

### Cấp 3 — Khó

| Hạng | Tiêu chí ISO | Lý do |
|------|-------------|-------|
| 8 | Reliability (full BUG detection) | Cần cross-function taint tracking |
| 9 | Security (full VULN detection) | + OWASP mapping + Hotspot workflow |

### Cấp 4 — Không khả thi với static analysis

| Hạng | Tiêu chí ISO | Lý do |
|------|-------------|-------|
| 10 | Performance Efficiency | Cần profiling runtime |
| 11 | Functional Suitability | Không thể kiểm tra business logic |
| 12 | Usability | Cần UX testing |
| 13 | Compatibility | Cần runtime testing |
| 14 | Portability | Cần platform testing |
| 15 | Transaction Integrity | Cần runtime + database testing |

---

## 6. So sánh với AI Code Review project hiện tại

| Khía cạnh | SonarQube | AI Code Review hiện tại |
|-----------|-----------|------------------------|
| Phân loại issue | Bug / Vulnerability / Code Smell / Hotspot | Tất cả `finding` |
| Severity | 5 mức (Blocker→Info) | 3 mức (Error→Info) |
| Rating | A→E từng khía cạnh | Health score 0–100 tổng hợp |
| Technical Debt | Có (phút + debt ratio) | Không |
| Quality Gate | Pass/Fail rõ ràng | Không |
| New Code vs Overall | Tách riêng | `--fast` mode |
| Issue lifecycle | Open→Confirm→Fix/FP/Accept→Close | Pending→Applied |
| Duplicate detection | Có | Không |
| Dependency CVE | Có | Không |
| Security OWASP mapping | Có (CWE + OWASP tags) | Không |
| Coverage integration | Có (JaCoCo, pytest-cov) | Không |
