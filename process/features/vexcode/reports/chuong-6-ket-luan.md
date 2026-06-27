# Chương 6: Kết luận

---

## 6.1. Kết quả đạt được

Đồ án đã xây dựng thành công hệ thống AI Code Review với các tính năng chính sau.

Hệ thống quét mã nguồn tự động sử dụng Opengrep để phát hiện lỗi bảo mật, lỗi cấu trúc và vấn đề chất lượng trên ba ngôn ngữ lập trình JavaScript, TypeScript và Python. Hệ thống hỗ trợ chế độ quét nhanh chỉ xử lý file thay đổi trong git, giúp tiết kiệm thời gian đáng kể cho các dự án lớn.

Hệ thống làm giàu ngữ cảnh cho từng finding bằng Knowledge Graph GitNexus, cung cấp thông tin về symbol, caller, và blast radius. Dữ liệu này giúp lập trình viên hiểu được phạm vi ảnh hưởng của lỗi trước khi sửa.

Hệ thống phân loại findings theo tiêu chuẩn ISO/IEC 25010 với bốn danh mục Security, Reliability, Maintainability và Performance Efficiency. Bộ phân loại sử dụng chiến lược deterministic với mapping từ CWE ID và rule_id, đảm bảo kết quả nhất quán và có thể kiểm tra được.

Hệ thống tích hợp với 4 nhà cung cấp AI (OpenAI, Anthropic, Google, NVIDIA NIM, 9router) để phân tích findings và đề xuất sửa lỗi. AI resolution chạy song song với cơ chế retry và fallback, đảm bảo hệ thống luôn trả về kết quả ngay cả khi AI API gặp lỗi.

Hệ thống cung cấp cả hai giao diện CLI và web dashboard. Web dashboard có real-time progress tracking qua SSE, giao diện trực quan với các tính năng lọc, tìm kiếm, xem mã nguồn, và áp dụng bản sửa chỉ với một cú nhấp chuột.

## 6.2. Đóng góp của đồ án

Đồ án đóng góp một giải pháp hybrid kết hợp phân tích tĩnh, Knowledge Graph và mô hình ngôn ngữ lớn để tự động hóa quy trình Code Review. Cách tiếp cận này khác với các công cụ hiện có ở hai điểm.

Thứ nhất, hệ thống kết hợp Opengrep (phân tích tĩnh) với GitNexus (Knowledge Graph) và LLM (AI resolution) trong một pipeline thống nhất. Mỗi tầng bổ sung thông tin cho tầng sau: Opengrep phát hiện lỗi, GitNexus cung cấp ngữ cảnh, LLM đề xuất cách sửa. Sự kết hợp này tận dụng thế mạnh của từng công nghệ: tốc độ và độ chính xác của phân tích tĩnh, khả năng hiểu cấu trúc của Knowledge Graph, và khả năng hiểu ngữ cảnh của LLM.

Thứ hai, kiến trúc hybrid Node.js/Python/React cho phép mỗi tầng sử dụng nền tảng phù hợp nhất với nhiệm vụ của mình. Node.js xử lý CLI và API nhờ I/O bất đồng bộ. Python xử lý pipeline phân tích nhờ hệ sinh thái thư viện phong phú. React xây dựng giao diện người dùng hiện đại.

Thứ ba, hệ thống áp dụng khung đánh giá chất lượng ISO/IEC 25010 làm cơ sở phân loại và đánh giá findings. Việc ánh xạ findings vào các danh mục chất lượng giúp lập trình viên ưu tiên xử lý các lỗi theo đúng mức độ ảnh hưởng đến chất lượng phần mềm.

## 6.3. Hạn chế

Bên cạnh những kết quả đạt được, hệ thống còn tồn tại một số hạn chế:

- **Phạm vi ngôn ngữ**: Hệ thống mới được thử nghiệm trên JavaScript, TypeScript và Python. Các ngôn ngữ khác như Java, Go, Rust chưa được kiểm chứng.
- **Phụ thuộc Internet**: Tính năng AI resolution yêu cầu kết nối internet. Khi mất kết nối, hệ thống chỉ trả về đề xuất mock, làm giảm giá trị sử dụng.
- **Chưa có CI/CD integration**: Hệ thống chạy thủ công, chưa thể tích hợp vào quy trình tự động như GitHub Actions hay GitLab CI.
- **Chưa hỗ trợ đa người dùng**: Toàn bộ trạng thái là per-machine, chưa có cơ chế cộng tác nhóm, phân công hay theo dõi tiến độ xử lý lỗi.
- **Chưa tích hợp Pull Request**: Hoạt động trên file local, chưa thể tự động review và comment trên pull request.
- **Chưa có giao diện quản lý rule**: Người dùng muốn tùy chỉnh rule phát hiện lỗi phải viết rule Semgrep thủ công.
- **Chưa có theo dõi xu hướng**: Các báo cáo độc lập theo thời điểm, chưa có biểu đồ so sánh chất lượng dự án qua nhiều lần quét.
- **Kiểm thử nền tảng**: Hệ thống mới chỉ được kiểm thử trên Windows, chưa xác nhận hoạt động ổn định trên Linux hay macOS.

## 6.4. Hướng phát triển

Đồ án có thể được phát triển thêm theo một số hướng sau.

Mở rộng lên 8 tiêu chí ISO/IEC 25010. Hiện tại hệ thống mới hỗ trợ 4 danh mục Phase 1. Phase 2 sẽ bổ sung Functional Suitability, Compatibility, Usability và Portability. Code cho Phase 2 đã được định nghĩa trong iso25010_taxonomy.py, cần kích hoạt và mở rộng mapping rule.

Tích hợp CI/CD pipeline. Hiện tại hệ thống chạy thủ công qua CLI hoặc web dashboard. Tích hợp với GitHub Actions, GitLab CI, hoặc Jenkins sẽ cho phép quét tự động mỗi khi có pull request. Cần thêm tính năng ghi comment tự động vào PR với kết quả scan và đề xuất sửa lỗi.

Hỗ trợ thêm ngôn ngữ lập trình. Hiện tại hệ thống hỗ trợ JavaScript, TypeScript và Python. Có thể mở rộng sang Java, Go, Rust, Ruby, C/C++ thông qua cấu hình luật Opengrep và mở rộng complexity metrics.

Nâng cấp AI Agent. Hướng phát triển dài hạn là chuyển từ mô hình LLM-as-tool sang LLM-as-agent, nơi AI có khả năng đọc hiểu toàn bộ dự án, tự động quyết định cần kiểm tra những gì, và thực hiện các bước sửa lỗi một cách tự chủ. Mô hình Multi-Agent với nhiều agent chuyên biệt (phát hiện lỗi, đề xuất sửa, kiểm tra chất lượng) cũng là một hướng nghiên cứu tiềm năng.

Cải thiện hiệu suất. Cần kiểm thử trên dự án lớn (trên 10.000 file) để xác định bottleneck và tối ưu. Có thể thêm incremental scan dựa trên cache để tránh quét lại các file không thay đổi.

Hỗ trợ đa nền tảng. Cần kiểm thử trên Linux và macOS để đảm bảo hệ thống hoạt động ổn định trên cả ba nền tảng. Có thể đóng gói Docker image để đơn giản hóa việc triển khai.

## 6.5. Nhận xét

Đồ án đã đạt được mục tiêu đề ra: xây dựng một hệ thống AI Code Review kết hợp phân tích tĩnh và mô hình ngôn ngữ lớn, với khả năng phát hiện lỗi và đề xuất sửa lỗi tự động. Hệ thống sử dụng kiến trúc hybrid linh hoạt, hỗ trợ nhiều AI provider, và áp dụng khung đánh giá chất lượng ISO/IEC 25010.

Kết quả kiểm thử cho thấy hệ thống hoạt động ổn định với 107 CLI tests và 224 web tests đều pass. Các hạn chế chi tiết đã được trình bày ở mục 6.3. Các hướng phát triển trong tương lai gồm mở rộng lên 8 tiêu chí ISO/IEC 25010, tích hợp CI/CD, hỗ trợ thêm ngôn ngữ, và nâng cấp lên AI Agent.
