# Graphite — AI Code Review & Stacked PR Workflow

> Cập nhật: 12/06/2026
> Website: https://graphite.dev
> Mô hình: Freemium (Free + Team $12/user/tháng)

---

## 1. Graphite là gì?

Graphite khác biệt hoàn toàn so với CodeRabbit và Qodo — **bản chất nó là workflow tool**, AI review chỉ là tính năng phụ.

### Core Identity (không AI)

Graphite nổi tiếng với **stacked PR workflow** — một workflow dành cho trunk-based development:

```
Graphite CLI (gt) ──────────────────────────
├── Stacked PRs:
│   ├── feature-branch-1 → feature-branch-2 → feature-branch-3
│   ├── Mỗi nhánh là 1 PR riêng, xếp chồng lên nhau
│   └── git rebase tự động giữa các branch trong stack
│
├── Smart squash: tự squash commits khi merge
├── Dashboard: quản lý tất cả stacked PRs
└── Trunk-based development workflow
```

Stacked PR giải quyết vấn đề: team lớn, feature dài ngày, conflict nhiều. Thay vì 1 PR 5000 lines → 3 PR nhỏ xếp chồng.

---

## 2. Graphite Review — AI Feature

Graphite Review là tính năng AI được thêm vào sau, không phải core product.

### Luồng hoạt động

```
Developer push code lên Graphite branch
       │
       ▼
Graphite Review triggered ──────────────────────────────────
│
├── Layer 1 - Static Analysis (< 1 giây):
│   ├── Gọi ESLint / Prettier (nếu project có)
│   ├── TypeScript type checking output parsing
│   └── Regex scanners (secret, API key patterns)
│
├── Layer 2 - LLM Review (2-5 giây):
│   ├── Chỉ phân tích diff (không đọc full file ngữ cảnh)
│   ├── Dùng model GPT-4o
│   ├── Focus areas:
│   │   ├── Style & convention inconsistencies
│   │   ├── Potential bugs (null check, edge case thiếu)
│   │   ├── Performance issues (N+1, redundant computation)
│   │   └── Best practices
│   └── Output: inline comments + suggestions
│
├── Layer 3 - Auto-fix (click apply):
│   ├── Không chỉ comment → tạo sẵn code block sửa lỗi
│   ├── Apply trực tiếp từ UI
│   └── Chỉ hỗ trợ fix đơn giản (rename, add null check)
│
└── Integration với Graphite workflow:
    ├── Review kết quả ngay trong `gt` CLI
    ├── Gợi ý tách PR khi file changes quá lớn
    └── Tắt/mở trong dashboard mỗi repo
```

### Điểm mạnh

| Khía cạnh | Đánh giá |
|-----------|---------|
| **Tốc độ** | 🟢 Nhanh nhất trong 3 tool (chỉ diff, không full context) |
| **Auto-fix** | 🟢 Click apply ngay, không cần copy code |
| **CLI integration** | 🟢 Có `gt` CLI, review ngay trong terminal |
| **Stacked PR aware** | 🟢 Hiểu được dependency giữa các PR trong stack |
| **Phân tích file quá lớn** | 🟢 Gợi ý tách PR (unique feature) |

### Điểm yếu

| Khía cạnh | Đánh giá |
|-----------|---------|
| **Độ sâu review** | 🔴 Chỉ diff, không đọc full context → miss nhiều bug |
| **Security** | 🔴 Chỉ regex scanner cơ bản, không có dataflow |
| **Reproducible** | 🔴 LLM không deterministic |
| **Metric/Rating** | 🔴 Không có |
| **Dashboard chất lượng** | 🔴 Chỉ có PR management, không có quality metrics |
| **Language support** | 🟡 Chủ yếu JS/TS/Python (hỗ trợ ESLint, Prettier) |

---

## 3. ISO 25010 Coverage

| Tiêu chí | Mức | Ghi chú |
|----------|-----|---------|
| **Functional Suitability** | 🔴 Rất thấp | Chỉ diff-level logic check |
| **Performance Efficiency** | 🔴 Thấp | Pattern cơ bản (N+1 query detection) |
| **Compatibility** | ❌ | Không |
| **Usability** | ❌ | Không |
| **Reliability** | 🟡 Trung bình | Null check, edge case cơ bản |
| **Security** | 🟡 Thấp | Regex scanner (secret detection) |
| **Maintainability** | 🟡 Trung bình | Style check qua ESLint, convention |
| **Portability** | ❌ | Không |
| **Transaction Integrity** | ❌ | Không |

---

## 4. Cách Graphite bù đắp điểm yếu

Graphite **không cố gắng trở thành static analysis tool**. Thay vào đó:

| Điểm yếu | Cách bù đắp |
|----------|------------|
| Không có depth | Graphite cho rằng depth không quan trọng bằng **context** — họ integrate với tool có sẵn (ESLint, TS Compiler) và focus vào workflow |
| Không có rating | Không cần rating vì mục đích là **PR review nhanh**, không phải quality tracking |
| Không có full context | Dùng LLM để hiểu intent từ limited context — trade-off chấp nhận được cho PR nhỏ |
| Thiếu security depth | Ngầm assume developer dùng thêm dedicated security tool riêng |

**Triết lý**: *"The best code review is the one that happens fast, doesn't block the developer, and catches the most common mistakes."*

---

## 5. Bài học cho AI Code Review project

### Có thể học hỏi

1. **Auto-fix suggestion**: Hiện project có "Apply Fix" button — có thể nâng cấp với AI-generated fix blocks như Graphite
2. **CLI review feedback**: Cho phép xem review results ngay trong terminal (Graphite làm rất tốt)
3. **Stacked PR analysis**: Nếu project dùng trunk-based development, cần biết file nào thay đổi trong PR nào
4. **File size warning**: Cảnh báo khi 1 file changes quá lớn → suggest chia nhỏ

### Không nên học

1. **Skip full context**: Project mình phải scan full codebase (không phải PR), nên cần full context
2. **Thiếu metrics**: Project mình đang xây quality tracking dashboard — Graphite không có
