# Qodo (formerly CodiumAI) — AI Code Review & Test Generation

> Cập nhật: 12/06/2026
> Website: https://qodo.ai
> Mô hình: Freemium (Free + Pro $15/user/tháng)
> Tên cũ: CodiumAI (đổi tên thành Qodo năm 2024)

---

## 1. Qodo là gì?

Qodo là **AI-powered code review agent** tập trung vào 2 mảng chính:
1. **Qodo Review** — PR code review (cạnh tranh trực tiếp với CodeRabbit)
2. **Qodo Test** — Tự động generate unit test từ code

Điểm đặc biệt: Qodo dùng **multi-agent architecture** — mỗi agent chuyên trách 1 khía cạnh, chạy song song.

---

## 2. Kiến trúc Multi-Agent

```
Pull Request mới (GitHub/GitLab/Bitbucket)
       │
       ▼
Qodo Orchestrator ──────────────────────────────────────────
│                                    
├── Agent 1: Code Understanding
│   ├── Parse diff + file tree + imports
│   ├── Xây dựng dependency graph cục bộ
│   ├── Xác định function nào bị ảnh hưởng
│   └── Output: context map cho các agents khác
│
├── Agent 2: Static Analysis (deterministic)
│   ├── SQL injection detection (dataflow tracking)
│   ├── Secret scanning (regex pattern)
│   ├── Type mismatch detection
│   └── Syntax validation
│   │
│   └── Output: list findings với file:line
│
├── Agent 3: Logic Review (LLM-based)
│   ├── Gửi từng function + context → LLM
│   ├── Functional logic errors
│   ├── Boundary conditions (off-by-one, empty state)
│   ├── Error handling (catch, fallback, retry)
│   └── Business logic inconsistency
│   │
│   └── Output: comment + suggestion per finding
│
├── Agent 4: Security Review (LLM + dataflow)
│   ├── Taint tracking: input → function → output
│   ├── OWASP pattern recognition
│   ├── Authentication/authorization check
│   └── Dependency vulnerability (scan requirements.txt)
│   │
│   └── Output: Security tab riêng
│
├── Agent 5: Improvement Suggestions
│   ├── Nếu phát hiện issue → generate code fix
│   ├── Code suggestion block (GitHub suggestion format)
│   └── Chỉ active khi bật "Code Improvement mode"
│
└── Agent 6: Test Generation (Qodo Test) — optional
    ├── Phân tích function signature + logic
    ├── Generate unit test (pytest, jest, etc.)
    ├── Edge case generation
    └── Coverage analysis: "còn thiếu test cho X branch"
```

### Luồng dữ liệu giữa các agent

```
Agent 1 (Understanding)
    │
    ▼
Agent 2 (Static) ── song song ── Agent 3 (Logic) ── song song ── Agent 4 (Security)
    │                      │                          │
    ▼                      ▼                          ▼
    └────────── Aggregate kết quả ──────────────────────┘
                        │
                        ▼
            Agent 5 (Improvement) → code suggestions
            Agent 6 (Tests)       → test generation
                        │
                        ▼
            Output: PR comments (multi-tab)
              ├── Code Review tab
              ├── Security tab
              └── Test Suggestions tab
```

---

## 3. Qodo Review Output Format

Qodo review chia output thành **3 tabs riêng biệt**:

### Tab 1: Code Review (tổng hợp từ Agent 2 + 3)
```
## PR Overview
- 15 files changed, +342 / -89 lines
- Affected modules: auth, billing, api-gateway

## Issues Found
### Logic Issue (Medium) - auth/login.ts:45
Suggestion: Kiểm tra user tồn tại trước khi hash password
```suggestion
const user = await findUser(email);
if (!user) return { error: 'USER_NOT_FOUND' };
```

### Logic Issue (Low) - billing/invoice.ts:102
Suggestion: Thêm retry logic cho payment gateway call
catches exception hiện tại nhưng không retry
```

### Tab 2: Security (riêng biệt, từ Agent 4)
```
## Security Analysis
### Medium - auth/login.ts:12
SQL injection risk detected
Input email được dùng trực tiếp trong query
Recommendation: Sử dụng parameterized query

### Low - config.py:5
Hardcoded secret key
```

### Tab 3: Test Suggestions (từ Agent 6, nếu có)
```
## Test Suggestions
### `calculateDiscount()` needs tests for:
1. Giá trị biên: discount = 0, 100, -1
2. User type: premium, regular, guest
3. Error state: expired coupon, invalid code
```

---

## 4. Điểm mạnh

| Khía cạnh | Đánh giá |
|-----------|---------|
| **Độ sâu security** | 🟢 Dataflow tracking (ngang Semgrep) + LLM — tốt nhất trong 3 tool |
| **Multi-agent** | 🟢 Dễ mở rộng: thêm agent mới không ảnh hưởng agent cũ |
| **Parallel execution** | 🟢 Agents chạy song song → giảm latency |
| **Test generation** | 🟢 Unique feature (CodeRabbit & Graphite không có) |
| **Security tab riêng** | 🟢 Tách biệt security findings khỏi code review thường |
| **Model flexibility** | 🟢 Mỗi agent dùng model khác nhau (GPT-4 cho logic, model nhỏ cho static) |

---

## 5. Điểm yếu

| Khía cạnh | Đánh giá |
|-----------|---------|
| **Tốc độ** | 🔴 Chậm nhất trong 3 tool (nhiều agents) |
| **Reproducible** | 🔴 LLM không deterministic |
| **Metric/Rating** | 🔴 Không có quality score hay debt tracking |
| **Cost** | 🔴 Nhiều LLM calls → tốn token hơn |
| **Complex output** | 🟡 3 tabs có thể gây information overload |
| **CLI support** | 🔴 Không có CLI (chỉ GitHub/GitLab app) |

---

## 6. Cách Qodo phân loại severity

| Mức | Ý nghĩa | Agent xử lý |
|-----|---------|------------|
| **Critical** | Lỗi bảo mật hoặc logic chắc chắn sai, production sẽ crash | Agent 2 + 4 |
| **High** | Lỗi nghiêm trọng, production có thể crash trong điều kiện cụ thể | Agent 3 |
| **Medium** | Code smell, best practice, có thể gây lỗi trong tương lai | Agent 2 + 3 |
| **Low** | Style, convention, readability | Agent 2 |
| **Info** | Thông tin, suggestion | Agent 5 |

---

## 7. ISO 25010 Coverage

| Tiêu chí | Mức | Ghi chú |
|----------|-----|---------|
| **Functional Suitability** | 🟡 Trung bình | Logic review + test generation |
| **Performance Efficiency** | 🔴 Thấp | Pattern cơ bản |
| **Compatibility** | ❌ | Không |
| **Usability** | ❌ | Không |
| **Reliability** | 🟡 Trung bình | Logic error detection |
| **Security** | 🟢 Khá | Dataflow tracking + OWASP |
| **Maintainability** | 🟡 Trung bình | Code style + suggestion |
| **Portability** | ❌ | Không |
| **Transaction Integrity** | ❌ | Không |

---

## 8. Bài học cho AI Code Review project

### Có thể học hỏi

1. **Multi-agent architecture**: Tách static analysis, logic review, security review thành các pipeline riêng — giống Qodo. Project mình đã có scanner → enricher → resolver → reporter, có thể thêm "logic review agent" riêng
2. **Security tab riêng**: Tách findings security ra 1 tab/ui riêng thay vì trộn chung
3. **Test generation**: Qodo Test ý tưởng hay — mình có thể thêm "generate test suggestion" dựa trên code complexity
4. **Dataflow tracking**: Semgrep hiện tại chạy auto — có thể thêm custom rules với **dataflow mode** (`mode: taint`) cho security depth

### Không nên học

1. **Thiếu metrics**: Giống Graphite, Qodo không có quality tracking — project mình vẫn cần health score, rating
2. **Phụ thuộc LLM cho static analysis**: Pattern cơ bản (secret, injection) nên dùng deterministic rule, không nên gọi LLM
