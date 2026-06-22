# Kế hoạch phát triển VexCode — Future Roadmap

> Dựa trên phân tích gap với các công cụ Code Review hiện có (SonarQube, CodeRabbit, Qodo).

---

## Giai đoạn 1 — Ngắn hạn (1–2 tháng)

### 1.1. Biểu đồ xu hướng chất lượng theo thời gian

VexCode đã có cross-scan tracking và lưu `scan_index.json`. Cần thêm UI hiển thị dạng line chart để developer thấy số lỗi tăng/giảm qua các lần quét.

*Tham khảo*: SonarQube Project Activity

### 1.2. Quality Gate (ngưỡng chất lượng)

Cho phép đặt ngưỡng (ví dụ: ≤ 5 lỗi ERROR, độ phức tạp trung bình < 15), hiển thị cảnh báo khi vượt ngưỡng. Config trong Dashboard Settings.

*Tham khảo*: SonarQube Quality Gate

### 1.3. Security Hotspot Review

Phân loại riêng các lỗi bảo mật cần người xác nhận thay vì tự động xử lý. Thêm tab riêng trên Dashboard.

*Tham khảo*: SonarQube Security Hotspot

---

## Giai đoạn 2 — Trung hạn (3–6 tháng)

### 2.1. Tích hợp Pull Request (GitHub / GitLab)

Tự động chạy VexCode khi có PR mới, đăng kết quả dưới dạng comment. Cơ chế: webhook GitHub/GitLab → Backend → pipeline → post comment. Hỗ trợ cập nhật khi PR có commit mới.

*Tham khảo*: CodeRabbit, Qodo, SonarQube PR Decoration

### 2.2. Phát hiện code duplication

Phát hiện code trùng lặp, đề xuất tái cấu trúc. Tích hợp công cụ như PMD-CPD, jscpd vào pipeline.

*Tham khảo*: SonarQube Duplications, Codacy

---

## Giai đoạn 3 — Dài hạn (6–12 tháng)

### 3.1. CI/CD Pipeline Integration

GitHub Action / GitLab CI template chạy VexCode trong pipeline. Chặn build nếu quality gate không đạt. Upload kết quả SARIF lên GitHub Security tab.

*Tham khảo*: SonarQube Scanner for CI, CodeRabbit GitHub App

### 3.2. Tích hợp code coverage

Nhận kết quả coverage từ CI (JaCoCo, Istanbul, pytest-cov), hiển thị trên Dashboard với mapping vùng chưa test và lỗi tiềm ẩn.

*Tham khảo*: SonarQube Coverage, CodeClimate

### 3.3. Thông báo (Notification)

Gửi thông báo Slack/Email/webhook khi: scan hoàn tất, quality gate vi phạm, có lỗi nghiêm trọng mới.

---

## Đã xét — Không ưu tiên

| Tính năng | Lý do |
|-----------|-------|
| Plugin IDE (VS Code, JetBrains) | Phạm vi quá lớn, cần team riêng |
| Quét dependency (Snyk, Dependabot) | Khác hướng mục tiêu cốt lõi |
| Fine-tune LLM riêng | Chi phí cao, chưa đủ dữ liệu |

## Lộ trình

```
Q3 2026 (T7-9):  Biểu đồ xu hướng + Quality Gate + Security Hotspot
Q4 2026 (T10-12): GitHub PR Integration + Code Duplication
Q1 2027 (T1-3):   GitLab PR Integration
Q2 2027 (T4-6):   CI/CD Pipeline + Code Coverage
Q3 2027 (T7-9):   Notifications + Tinh chỉnh tổng thể
```
