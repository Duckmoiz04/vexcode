# Chương 5: Kết luận và Hướng phát triển

---

## 5.1. Kết quả đạt được

Đồ án đã xây dựng thành công hệ thống AI Code Review (VexCode), đáp ứng cả hai mục tiêu đề ra.

**Mục tiêu 1** — Deep Context-Aware Analysis: Hệ thống triển khai cơ chế lập chỉ mục AST qua GitNexus CLI, truy xuất ngữ cảnh symbol (callers, blast_radius) và bổ sung vào mỗi finding. Kết quả thực nghiệm trên dataset VexCode cho thấy 43/142 findings (30%) được enrich với AST context, cho phép developer hiểu phạm vi ảnh hưởng của lỗi trước khi sửa. Dependency graph (Sigma.js) hiển thị trực quan mối liên kết file → symbol → callers → blast_radius. Dataflow trace hiển thị source → propagators → sink cho security findings. Khi GitNexus unavailable, pipeline fallback graceful không crash.

**Mục tiêu 2** — Đánh giá đa tiêu chuẩn và đề xuất tối ưu: Pipeline đa-scanner (OpenGrep + Gitleaks + OSV) phát hiện tổng cộng 556 findings trên ba dự án (VexCode 142, Juice Shop 130, OpenHands 284), phân loại theo ISO/IEC 25010 với 4 danh mục (Security 205, Maintainability 304, Operability 47). AI Resolution 3-stage (Analyze → Fix → Review) phân loại 2 nhãn — confirmed 455, false_positive 101 — và đề xuất fix code với 100% success rate (2/2 fix, 2/2 review approved). Web Dashboard hiển thị kết quả trực quan với real-time SSE progress tracking, findings list, filter panel, Code Inspector, và chat AI.

Bên cạnh hai mục tiêu chính, đồ án đạt thêm các kết quả phụ: bộ phân loại ISO 25010 deterministic với hơn 150 CWE/keyword mapping; multi-scanner tích hợp trong một pipeline (OpenGrep + Gitleaks + OSV); bảo mật API đáp ứng 5 vector tấn công; SARIF output tương thích VS Code; và kiến trúc hybrid Node.js/Python/React linh hoạt.

---

## 5.2. Đóng góp của đồ án

Đồ án đóng góp một giải pháp hybrid kết hợp phân tích tĩnh, Knowledge Graph và mô hình ngôn ngữ lớn để tự động hóa quy trình Code Review, với hai đóng góp chính.

**Thứ nhất**, hệ thống kết hợp Opengrep (phân tích tĩnh) với GitNexus (Knowledge Graph) và LLM (AI resolution) trong một pipeline thống nhất. Mỗi tầng bổ sung thông tin cho tầng sau: Opengrep phát hiện lỗi, GitNexus cung cấp ngữ cảnh AST (callers, blast_radius), LLM phân loại và đề xuất cách sửa. Sự kết hợp này tận dụng thế mạnh riêng: tốc độ deterministic của phân tích tĩnh, khả năng hiểu cấu trúc chương trình của Knowledge Graph, và khả năng hiểu ngữ cảnh tự nhiên của LLM. Kết quả thực nghiệm cho thấy AI Resolution kết hợp AST context giúp phân loại chính xác false_positive — ví dụ `no-print-statements` và `no-silent-except` được AI nhận diện đúng là linting rules không phải lỗi bảo mật.

**Thứ hai**, hệ thống áp dụng khung đánh giá chất lượng ISO/IEC 25010 làm cơ sở phân loại findings. Việc ánh xạ mỗi finding vào danh mục chất lượng (Security, Reliability, Maintainability, Operability) giúp lập trình viên ưu tiên xử lý theo mức độ ảnh hưởng đến chất lượng phần mềm, thay vì chỉ dựa vào severity level đơn thuần.

---

## 5.3. Hạn chế

**Bảng 5.1.** Tổng hợp hạn chế hệ thống

| Hạn chế | Mức ảnh hưởng |
|---------|---------------|
| GitNexus phải cài thủ công — juice-shop và OpenHands không có AST context | Trung bình |
| AI Smart Gate giới hạn 5 unique rules/lần chạy | Trung bình |
| Chưa đo thời gian scan chính xác (`scan_duration_seconds`) | Thấp |
| Module `ai_resolver.py` lớn (~1003 dòng), cần tách nhỏ | Trung bình |
| Chưa có CI/CD pipeline tự động kiểm thử regression | Trung bình |
| Chỉ kiểm thử trên Windows, chưa xác nhận Linux/macOS | Thấp |
| OSV scanner chỉ chạy khi có lockfile phù hợp | Thấp |
| AI resolution thiếu ground truth benchmark (precision, recall) | Trung bình |
| Chưa có hướng dẫn sử dụng chi tiết cho người mới | Thấp |

---

## 5.4. Hướng phát triển

**Tự động hóa GitNexus**: Tích hợp script auto-install GitNexus CLI để AST enrichment hoạt động tự-contained. Mở rộng enrichment cho cả juice-shop và OpenHands, kỳ vọng đạt tỷ lệ enrich tương tự VexCode (30%+).

**Mở rộng AI Resolution**: Bỏ hoặc tăng giới hạn Smart Gate (5 unique rules), cho phép resolve tất cả rules. Thu thập ground truth từ developer review để đánh giá accuracy định lượng (precision, recall, F1-score). Thêm `scan_duration_seconds` vào report để đo hiệu năng chi tiết.

**Tích hợp CI/CD**: GitHub Actions / GitLab CI workflow tự động scan mỗi pull request. Ghi comment tự động vào PR với kết quả scan và đề xuất sửa lỗi.

**Hỗ trợ thêm ngôn ngữ**: Mở rộng sang Java, Go, Rust, C/C++ thông qua cấu hình luật Opengrep và mở rộng complexity metrics.

**Nâng cấp AI Agent**: Chuyển từ LLM-as-tool sang LLM-as-agent — AI tự đọc hiểu toàn bộ dự án, quyết định kiểm tra gì, và thực hiện sửa lỗi tự chủ. Multi-Agent với nhiều agent chuyên biệt (phát hiện, đề xuất sửa, kiểm tra chất lượng).

**Đóng gói và đa nền tảng**: Docker image đơn giản hóa triển khai. Kiểm thử trên Linux/macOS để đảm bảo cross-platform.

---

## 5.5. Nhận xét

Đồ án đã đạt được cả hai mục tiêu đề ra: (1) Deep Context-Aware Analysis qua GitNexus AST enrichment, và (2) Đánh giá đa tiêu chuẩn ISO/IEC 25010 + AI đề xuất tối ưu. Hệ thống chạy thành công end-to-end trên ba dự án thực tế với 556 findings, AI phân loại 455 confirmed / 101 false_positive, và Deep Context Analysis enrich 30% findings tại dataset có GitNexus. Kiến trúc hybrid Node.js/Python/React linh hoạt, bảo mật API đáp ứng 5 vector tấn công, và so sánh với công cụ cùng loại cho thấy VexCode có ưu thế riêng ở việc kết hợp AI Resolution + AST context + multi-scanner trong một pipeline thống nhất.
