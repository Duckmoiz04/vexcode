# Chương 1: Tổng quan về đề tài

---

## 1.1. Bối cảnh và lý do chọn đề tài

Trong bối cảnh công nghệ phần mềm phát triển nhanh như hiện nay, các hệ thống ngày càng mở rộng cả về quy mô lẫn độ phức tạp. Điều này đặt ra bài toán làm sao để duy trì chất lượng và sự ổn định của phần mềm xuyên suốt vòng đời phát triển.

Quy trình rà soát mã nguồn (Code Review) là một trong những giải pháp cho bài toán đó. Code Review không đơn thuần là tìm lỗi cú pháp, mà còn giúp phát hiện sớm các lỗ hổng logic, đánh giá độ phức tạp và đảm bảo mã nguồn tuân thủ quy chuẩn chung của tổ chức trước khi đưa vào vận hành.

Các công cụ quét mã nguồn tĩnh (Static Analysis) như SonarQube, ESLint, Semgrep đã được dùng phổ biến để tự động hóa một phần việc này. Ưu điểm của chúng là tốc độ xử lý nhanh và có thể quét diện rộng trên toàn bộ mã nguồn. Tuy nhiên, hạn chế cố hữu là các công cụ này chỉ hoạt động dựa trên tập luật có sẵn, dẫn đến tỷ lệ cảnh báo sai (false positive) khá cao và không thể hiểu được ý đồ thiết kế hay logic nghiệp vụ của lập trình viên. Do đó, phần lớn việc rà soát vẫn phải phụ thuộc vào con người, điều này tốn kém thời gian và dễ bỏ sót lỗi khi dự án có quy mô lớn.

Sự ra đời của các Mô hình ngôn ngữ lớn (LLMs) đã mở ra một hướng tiếp cận mới cho bài toán này. Với khả năng phân tích ngữ cảnh liên tệp tin và suy luận logic, LLM không chỉ phát hiện lỗi mà còn có thể đề xuất giải pháp sửa đổi hoàn chỉnh, thay vì chỉ báo lỗi như các công cụ truyền thống. Điều này thúc đẩy sự ra đời của nhiều giải pháp Code Review tích hợp AI như CodeRabbit, Qodo, Claude Code, hay Cursor trên thị trường.

Dù vậy, các giải pháp này vẫn tồn tại một số rào cản. Về chi phí, các công cụ thương mại thường có giá cao đối với lập trình viên làm việc độc lập hoặc nhóm phát triển nhỏ. Ngoài ra, cơ chế hoạt động tự hành của agent AI dễ dẫn đến các vòng lặp quét lặp đi lặp lại, tiêu thụ lượng lớn token qua mỗi lần gọi API và khiến chi phí vận hành khó kiểm soát.

Bên cạnh đó, các giải pháp Code Review có AI chạy trên máy cá nhân hiện nay hầu như đều thiếu một dashboard trung tâm. Người dùng phải duyệt từng cảnh báo qua khung chat hoặc Terminal, tự phân loại mức độ nghiêm trọng, và không có cơ chế theo dõi trạng thái lỗi (đã sửa, bỏ qua hay chờ xử lý). Giải pháp đề xuất là xây dựng một Dashboard trực quan giúp tự động gom nhóm, phân loại findings, hiển thị vị trí và đề xuất sửa lỗi chi tiết, đồng thời cho phép lập trình viên phê duyệt, từ chối hoặc hội thoại với AI để làm rõ ngữ cảnh ngay tại đó.

Xuất phát từ thực tiễn đó, đề tài "Xây dựng công cụ tự động đánh giá mã nguồn sử dụng LLMs" được lựa chọn làm đồ án tốt nghiệp với mục tiêu cải thiện quy trình rà soát mã nguồn, nâng cao hiệu suất của lập trình viên và đảm bảo chất lượng sản phẩm phần mềm.

## 1.2. Mục tiêu của đề tài

Mục tiêu tổng quát của đồ án là xây dựng một hệ thống AI Code Review hoàn chỉnh, kết hợp cả static analysis truyền thống và trí tuệ nhân tạo, có khả năng phát hiện lỗi, phân tích nguyên nhân, đánh giá mức độ nghiêm trọng dựa trên ngữ cảnh và đề xuất giải pháp sửa lỗi cho mã nguồn. Các mục tiêu cụ thể bao gồm:

Xây dựng CLI tool: Giao diện dòng lệnh cho phép người dùng chạy scan, xem kết quả và quản lý cấu hình nhanh chóng, không cần mở trình duyệt.

Xây dựng Analysis Engine: Pipeline phân tích mã nguồn bốn giai đoạn: quét tĩnh với Opengrep, làm giàu ngữ cảnh qua GitNexus knowledge graph, phân tích và đề xuất sửa lỗi bằng AI, và tổng hợp báo cáo.

Xây dựng Web Dashboard: Giao diện web trực quan cho phép xem báo cáo, tương tác với từng finding, chat với AI, và áp dụng bản sửa lỗi chỉ với một cú nhấp chuột.

Tích hợp đa AI provider: Hỗ trợ nhiều nhà cung cấp AI (OpenAI, Anthropic, Google, NVIDIA NIM, 9router) để người dùng chủ động lựa chọn, không bị phụ thuộc vào một vendor duy nhất.

Bốn thành phần này kết hợp tạo thành một quy trình khép kín: từ scan, phân tích, đề xuất sửa lỗi đến hiển thị kết quả và áp dụng bản sửa, tất cả đều thực hiện được từ một giao diện thống nhất.

## 1.3. Đối tượng, phạm vi nghiên cứu và giới hạn

Đồ án tập trung nghiên cứu bốn thành phần chính. Các thành phần này được chọn dựa trên yêu cầu của bài toán: cần một công cụ quét tĩnh để phát hiện lỗi, một hệ thống đồ thị kiến thức để hiểu ngữ cảnh mã nguồn, mô hình ngôn ngữ lớn để phân tích và đề xuất sửa lỗi, và cuối cùng là kiến trúc hệ thống để kết hợp tất cả thành một sản phẩm hoàn chỉnh. Bốn thành phần này có mối quan hệ mật thiết với nhau: Opengrep cung cấp dữ liệu đầu vào, GitNexus bổ sung ngữ cảnh cấu trúc, LLM đưa ra đề xuất thông minh, và kiến trúc hybrid đảm bảo các thành phần vận hành trơn tru:

Static Code Analysis: Nghiên cứu Opengrep, công cụ quét tĩnh mã nguồn theo rules, cách xây dựng rules và tích hợp vào pipeline.

Code Knowledge Graph: Nghiên cứu GitNexus, hệ thống trích xuất AST và xây dựng đồ thị phụ thuộc cho mã nguồn.

Large Language Models: Nghiên cứu cách ứng dụng LLM để phát hiện lỗi, phân tích mã, và đề xuất giải pháp sửa lỗi.

Kiến trúc ứng dụng hybrid: Nghiên cứu cách kết hợp Node.js (CLI + REST API), Python (analysis engine), và React (frontend).

Về phạm vi ứng dụng, hệ thống hướng đến việc quét và phân tích các dự án phần mềm vừa và nhỏ. Người dùng mục tiêu là lập trình viên cá nhân hoặc nhóm phát triển nhỏ chưa có quy trình code review bài bản. Hệ thống phù hợp với cả môi trường phát triển local lẫn các tổ chức muốn giữ code nội bộ.

Bên cạnh đó, đồ án cũng có những giới hạn nhất định. Mặc dù các công cụ sử dụng như Opengrep và GitNexus đã hỗ trợ nhiều ngôn ngữ lập trình, hệ thống mới chỉ được thử nghiệm trên JavaScript, TypeScript và Python. Hệ thống hiện chưa tích hợp CI/CD pipeline như GitHub Actions hay GitLab CI, và chạy trên máy đơn nên chưa hỗ trợ chế độ server multi-user. Tính năng phân tích và đề xuất sửa lỗi bằng AI yêu cầu thiết bị phải có kết nối internet để gọi đến các nhà cung cấp AI (AI Provider). Ngoài ra, hệ thống mới chỉ được kiểm thử trên Windows, chưa xác nhận khả năng hoạt động trên Linux hay macOS.

## 1.4. Phương pháp nghiên cứu

**Nghiên cứu tài liệu:** Khảo sát các công cụ Code Review hiện có (SonarQube, CodeRabbit, Qodo, Claude Code) để xác định ưu nhược điểm và cơ hội cải tiến. Bên cạnh đó, cần tìm hiểu các nền tảng lý thuyết liên quan. Kết quả của giai đoạn này làm cơ sở cho việc thiết kế giải pháp.

**Phát triển thực nghiệm:** Xây dựng hệ thống VexCode qua các bước: thiết kế kiến trúc tổng thể, phát triển pipeline phân tích bốn giai đoạn, xây dựng CLI và REST API, phát triển web dashboard. Bốn giai đoạn của pipeline bao gồm:

- **Scanner:** Quét mã nguồn bằng công cụ phân tích tĩnh.
- **Enricher:** Làm giàu kết quả quét với ngữ cảnh từ đồ thị tri thức.
- **Resolver:** Phân tích độ phức tạp mã nguồn, gọi mô hình ngôn ngữ lớn.
- **Reporter:** Tổng hợp kết quả thành báo cáo có cấu trúc.

**Đánh giá thực nghiệm:** Thử nghiệm hệ thống trên các dự án phần mềm thực tế, đo đạc các chỉ số về độ chính xác của phát hiện lỗi, chất lượng đề xuất sửa lỗi và hiệu năng xử lý. Kết quả đánh giá được tổng hợp và phân tích ở Chương 5.

## 1.5. Bố cục luận văn

Nội dung chính của báo cáo đồ án gồm các chương như sau:

- **Chương 1 - Tổng quan về đề tài:** Đặt vấn đề, xác định mục tiêu, phạm vi nghiên cứu và phương pháp thực hiện.
- **Chương 2 - Cơ sở lý thuyết:** Trình bày các nền tảng lý thuyết: Code Review, ISO/IEC 25010, phân tích tĩnh, đồ thị tri thức và mô hình ngôn ngữ lớn.
- **Chương 3 - Phân tích thiết kế hệ thống:** Phân tích bài toán Code Review tự động, xác định yêu cầu hệ thống, đề xuất kiến trúc và thiết kế chi tiết từng thành phần.
- **Chương 4 - Triển khai thực nghiệm:** Trình bày môi trường phát triển, công nghệ sử dụng và các kết quả triển khai cụ thể.
- **Chương 5 - Kết quả và đánh giá:** Phân tích kết quả thử nghiệm, đánh giá chất lượng phát hiện lỗi, hiệu năng và trải nghiệm người dùng.
- **Chương 6 - Kết luận:** Tóm tắt kết quả đạt được, nêu hạn chế và đề xuất hướng phát triển.
