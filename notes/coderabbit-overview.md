# CodeRabbit — AI-Powered PR Code Review

> Cập nhật: 12/06/2026
> Website: https://coderabbit.ai
> Mô hình: Freemium (Free + Pro $20/user/tháng)
> Model: GPT-4 / Claude / Gemini (có thể chọn)

---

## 1. CodeRabbit là gì?

CodeRabbit là **AI code review tool phổ biến nhất hiện nay** trong phân khúc PR-level review. Nó hoạt động như GitHub/GitLab App — tự động review mỗi khi có PR mới hoặc push mới.

CodeRabbit nổi tiếng vì:
- **Thoroughness**: Review khá sâu so với các tool AI review khác
- **Conversation mode**: Developer có thể reply comment → CodeRabbit trả lời, giải thích, điều chỉnh
- **PR Walkthrough**: Tóm tắt trực quan toàn bộ PR bằng sơ đồ sequence + changelog

---

## 2. Luồng hoạt động

```
Pull Request mới (GitHub/GitLab)
       │
       ▼
CodeRabbit nhận webhook ────────────────────────────────────
│
├── Bước 1: Context Gathering
│   ├── git diff (files changed, lines added/removed)
│   ├── Đọc full file bị ảnh hưởng (không chỉ diff lines)
│   ├── File tree + project structure
│   ├── Lịch sử PR (comments, commits, reviews trước)
│   └── Output: context package cho LLM
│
├── Bước 2: Two-Layer Analysis
│   │
│   ├── Layer 1 - Fast Path (deterministic, < 100ms):
│   │   ├── Regex scanners (secret, API key, TODO/FIXME)
│   │   ├── AST validators (tree-sitter) cho syntax
│   │   ├── Import resolution (file nào dùng file nào)
│   │   └── ESLint/Ruff/Pylint output parsing (nếu integrate)
│   │   └── Output: findings deterministic (chắc chắn đúng)
│   │
│   └── Layer 2 - LLM Path (1-5 giây mỗi review unit):
│       ├── Chia diff thành "review units"
│       │   ├── Mỗi function/hunk là 1 unit riêng
│       │   └── Mỗi unit gửi kèm context (file, imports, dependencies)
│       │
│       ├── Prompt template cho mỗi loại review:
│       │   ├── "Check logic errors in this function: {code}"
│       │   ├── "Check security issues: {code}"
│       │   ├── "Check best practices: {code}"
│       │   ├── "Check performance: {code}"
│       │   └── "Check readability: {code}"
│       │
│       └── Output: list issues với confidence score
│
├── Bước 3: Aggregation & Post-processing
│   ├── Dedup (cùng 1 lỗi xuất hiện ở nhiều prompts → gộp)
│   ├── Prioritize (critical → info)
│   ├── Generate suggestion blocks (GitHub suggestion format)
│   └── Generate Review Summary (overall PR description)
│
└── Bước 4: Post comments lên PR
    ├── 📄 Review Summary (tóm tắt tổng quan PR)
    ├── 💬 Inline comments tại từng dòng code
    ├── 🔧 Suggestion blocks (click apply)
    ├── 📊 Walkthrough tab (sequence diagram, flow chart)
    └── 🗣️ Conversation (reply → CodeRabbit giải thích)
```

---

## 3. CodeRabbit Output Format

### Review Summary
```
## 📝 PR Overview
- **Files changed**: 12 (+245 / -67 lines)
- **Affected modules**: api-gateway, auth-service, user-db
- **Risk level**: Medium

## 🚨 Critical Issues (2)
1. `auth/login.ts:45` — SQL injection risk: input không được sanitize
2. `api/rate-limit.ts:88` — Race condition: 2 async writes không lock

## ⚠️ Warnings (5)
1. `user/db.ts:12` — Missing input validation
2. ...

## ℹ️ Suggestions (8)
1. `billing/invoice.ts:102` — Extract magic number thành const
2. ...

## 📊 Walkthrough
[Sequence Diagram showing flow của PR changes]
```

### Inline Comment
```typescript
// CodeRabbit comment tại dòng 45 của auth/login.ts
// 🚨 SQL Injection Risk (Medium confidence)
// 
// Input `email` được dùng trực tiếp trong SQL query.
// Sử dụng parameterized query để tránh injection.
//
// ```suggestion
// const result = await db.query('SELECT * FROM users WHERE email = $1', [email]);
// ```
```

### Conversation Mode
```
Developer: "This is a false positive — email is already sanitized"
CodeRabbit: "You're right, I see the sanitizeEmail() call at line 30.
Let me re-analyze... Confirmed, this is low risk. 
Recommendation: Add input validation as defense-in-depth."
```

---

## 4. Cơ chế phân loại

| Confidence | Ý nghĩa | Cách xử lý |
|-----------|---------|-----------|
| **High** | Static analysis hoặc LLM rất chắc chắn | Show ngay, không hỏi |
| **Medium** | LLM reasonably sure | Show kèm explanation |
| **Low** | LLM không chắc, "might be an issue" | Ẩn trong "All Issues" tab |

---

## 5. Điểm mạnh

| Khía cạnh | Đánh giá |
|-----------|---------|
| **Context-aware** | 🟢 Đọc full file ngữ cảnh, không chỉ diff lines |
| **Conversational** | 🟢 Developer reply → LLM hiểu và điều chỉnh |
| **Multi-model** | 🟢 Chọn GPT-4, Claude, Gemini theo nhu cầu |
| **PR Walkthrough** | 🟢 Sequence diagram tự động — unique feature |
| **Tốc độ** | 🟡 Trung bình (30s-2p, nhanh hơn Qodo) |
| **Dễ integrate** | 🟢 GitHub/GitLab app, 1 click cài |

---

## 6. Điểm yếu

| Khía cạnh | Đánh giá |
|-----------|---------|
| **Reproducible** | 🔴 LLM không deterministic |
| **Metric/Rating** | 🔴 Không có quality score, không debt |
| **Token cost** | 🔴 PR lớn → context tốn kém, bị giới hạn window |
| **Miss pattern hôm qua** | 🔴 LLM không có memory — không nhớ issue đã phát hiện hôm qua |
| **Không có chuyên môn hóa** | 🟡 Single agent làm tất cả (không multi-agent như Qodo) |
| **Không có CLI** | 🔴 Chỉ web-based |

---

## 7. So sánh với SonarQube

| Khía cạnh | CodeRabbit | SonarQube |
|-----------|-----------|-----------|
| **Cơ chế chính** | LLM + regex static | Rule engine (deterministic) |
| **Reproducible?** | ❌ | ✅ |
| **Rating?** | ❌ | ✅ A→E |
| **Technical Debt?** | ❌ | ✅ |
| **Quality Gate?** | ❌ | ✅ |
| **Context hiểu code** | ✅ LLM hiểu business logic | ❌ Chỉ AST pattern |
| **PR-level review** | ✅ PR-native | ❌ Scan full |
| **Zero FP?** | ❌ | ❌ (có FP, nhưng predictable) |

---

## 8. ISO 25010 Coverage

| Tiêu chí | Mức | Ghi chú |
|----------|-----|---------|
| **Functional Suitability** | 🟡 Trung bình | LLM hiểu 1 phần business logic |
| **Performance Efficiency** | 🔴 Thấp | Pattern cơ bản |
| **Compatibility** | ❌ | Không |
| **Usability** | ❌ | Không |
| **Reliability** | 🟡 Trung bình | Logic error + null check |
| **Security** | 🟡 Trung bình | OWASP prompting + regex |
| **Maintainability** | 🟡 Trung bình | Style + best practice |
| **Portability** | ❌ | Không |
| **Transaction Integrity** | ❌ | Không |

---

## 9. Bài học cho AI Code Review project

### Có thể học hỏi

1. **Two-layer analysis**: Fast deterministic path + deep LLM path — giống hệt kiến trúc mình có thể áp dụng. Layer 1 = Semgrep + Ruff (nhanh, chắc chắn), Layer 2 = AI resolver (LLM cho findings phức tạp)
2. **Conversation mode**: Cho phép dev hỏi "tại sao cái này là lỗi?" → AI giải thích. Project mình có thể thêm feature này cho findings chi tiết
3. **PR Walkthrough**: Sequence diagram + tóm tắt trực quan — rất có ích khi review findings
4. **Confidence score**: Thêm mức độ tin cậy cho mỗi finding (High/Medium/Low) giúp dev ưu tiên review
5. **Review units**: Chia code thành từng unit nhỏ để LLM review — giảm token cost + tăng accuracy

### Không nên học

1. **Thiếu deterministic**: Project mình đã có static analysis deterministic — giữ lại, chỉ thêm LLM như optional layer
2. **Thiếu metrics**: Giống 2 tool kia — project mình vẫn cần health score, quality gate
3. **Memory-less LLM**: Cần caching để không lặp lại findings giữa các lần scan
