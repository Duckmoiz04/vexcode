# Hướng phát triển tiếp theo — AI Code Review

Ngày: 2026-06-10
Trạng thái: Draft — chờ thảo luận

---

## Tình trạng hiện tại

- ✅ Phase 1-6: AI Code Review core hoàn thành
- ✅ Code-quality-refactor: hoàn thành (ESLint + Prettier + Ruff, modularization, 147 tests, type safety)
- ✅ `d567728` committed
- Dự án đang ở trạng thái hoàn thiện, chờ feature mới hoặc cải tiến

---

## Nhóm 1 — CI/CD & Chất lượng (impact cao, effort thấp)

### 1. GitHub Actions CI
- Chạy `npm test`, `npm run build`, Python unittest, ESLint, Ruff trên mỗi push/PR
- Dự án hiện **không có CI** — lỗ hổng lớn nhất
- Effort: thấp (~1-2 giờ). Tệp `.github/workflows/` duy nhất.

### 2. Husky + lint-staged
- Tự động chạy ESLint + Prettier + Ruff trên staged file trước commit
- Effort: rất thấp. Cài 2 package + 1 config file.

### 3. Enforce linters (lên error thay vì warn)
- Hiện ESLint/Ruff đang ở chế độ warn-only do scope refactor giới hạn
- Effort: trung bình (~3-4 giờ tùy số lượng warn).

---

## Nhóm 2 — Tính năng mới (impact cao, effort đa dạng)

### 4. Xác thực (Authentication) cho Dashboard
- Web UI hiện không có login — ai cũng truy cập được
- Thêm basic auth hoặc JWT session
- Effort: trung bình (~4-6 giờ)

### 5. Export báo cáo (PDF/HTML)
- Hiện chỉ xem được trên dashboard. Thêm nút export để share kết quả scan
- Effort: thấp (~2-3 giờ). Dùng Puppeteer hoặc template HTML → PDF.

### 6. So sánh scan (Diff Mode)
- So sánh 2 kết quả scan để thấy finding mới/đã fix
- Effort: trung bình-cao (~6-8 giờ)

### 7. Custom Semgrep rules
- Bundle rules phù hợp với dự án Việt Nam (encoding, security patterns phổ biến)
- Effort: thấp (~2 giờ)

---

## Nhóm 3 — Kiểm thử & Độ tin cậy

### 8. E2E tests với Playwright
- Test luồng scan → UI → apply fix bằng browser thật
- Effort: trung bình (~4-6 giờ)

### 9. Benchmark / Stress test
- Đo tốc độ scan với codebase lớn, tối ưu pipeline
- Effort: trung bình (~3-5 giờ)

---

## Nhóm 4 — DevOps & Phân phối

### 10. Docker hóa toàn bộ ứng dụng
- Dockerfile + docker-compose với CLI + Python engine + Web UI
- Effort: trung bình (~4-5 giờ)

### 11. npm publish CLI tool
- Đóng gói `packages/cli-global` lên npm
- Effort: thấp (~2 giờ)

---

## Đề xuất ưu tiên

Bắt đầu với **CI/CD (GitHub Actions)** — khoảng trống rõ ràng nhất, effort thấp.

Sau đó tùy mục tiêu:
- **Sản phẩm hoàn thiện** → Authentication + Export báo cáo
- **Chất lượng** → Husky + enforce linters + E2E tests
- **Mở rộng** → Docker + npm publish
