
# Xây dựng công cụ tự động đánh giá mã nguồn sử dụng LLMs

---

# Chương 1. Mở đầu

---

## 1.1. Bối cảnh và lý do chọn đề tài

Trong kỷ nguyên công nghệ hiện nay, sự phát triển mạnh mẽ của ngành công nghệ phần mềm đã thúc đẩy các hệ thống ngày càng mở rộng về quy mô lẫn độ phức tạp, với hàng nghìn tệp tin mã nguồn có mối quan hệ chéo chặt chẽ. Sự tăng trưởng nhanh chóng này đặt ra những yêu cầu khắt khe về việc duy trì chất lượng phần mềm, tối ưu hóa kiến trúc, cũng như đảm bảo tính ổn định của toàn bộ hệ thống trong suốt vòng đời phát triển.

Để đạt được các tiêu chuẩn chất lượng đó, quy trình rà soát mã nguồn (Code Review) đã trở thành một giai đoạn bắt buộc và đóng vai trò xương sống trong kỹ nghệ phần mềm. Code Review không chỉ đơn thuần là tìm kiếm lỗi cú pháp, mà còn là bước thẩm định quan trọng giúp phát hiện sớm lỗ hổng logic, đánh giá độ phức tạp, bảo đảm cấu trúc hệ thống nhất quán, và kiểm tra mã nguồn tuân thủ các quy chuẩn chung của tổ chức trước khi được đưa vào vận hành thực tế.

Trước đây, để tự động hóa quy trình này, các công cụ phân tích tĩnh (Static Analysis) truyền thống như SonarQube, ESLint hay Checkstyle đã được sử dụng rộng rãi và trở thành một phần không thể thiếu trong môi trường phát triển. Phương pháp phân tích tĩnh sở hữu lợi thế lớn về tốc độ xử lý, khả năng quét diện rộng trên toàn bộ kho mã nguồn và trích xuất chính xác cấu trúc cú pháp, đồ thị phụ thuộc của chương trình mà không cần thực thi. Tuy nhiên, điểm yếu cố hữu của các công cụ này là chỉ hoạt động dựa trên các quy tắc và tập luật cứng nhắc có sẵn. Điều này dẫn đến tỷ lệ cảnh báo sai (False Positive) cao, đồng thời hệ thống hoàn toàn thiếu khả năng tư duy để hiểu được ý đồ thiết kế tổng thể hay logic nghiệp vụ phức tạp của lập trình viên. Do đó, quy trình rà soát phần lớn vẫn phải dựa vào con người thông qua các phương pháp thủ công, vốn tốn thời gian, công sức và dễ bỏ sót lỗi liên kết file khi quy mô dự án quá lớn.

Bước sang thời kỳ bùng nổ của Trí tuệ nhân tạo (AI), ngành kỹ nghệ phần mềm đã chứng kiến sự chuyển dịch mạnh mẽ sang tự động hóa thông minh nhờ sự phát triển vượt bậc của các Mô hình ngôn ngữ lớn (Large Language Models — LLMs) và trợ lý AI (AI Agents). Khác với các công cụ hỗ trợ gõ code đơn thuần (Auto-completion), các mô hình LLM tiên tiến hiện nay sở hữu khả năng tư duy logic và hiểu sâu ngữ cảnh liên tệp tin phức tạp. Nhờ năng lực suy luận linh hoạt, AI có thể tự động đọc hiểu cấu trúc toàn bộ dự án để phát hiện lỗ hổng logic chuyên sâu, đồng thời đưa ra giải pháp sửa đổi mã nguồn hoàn chỉnh thay vì chỉ cảnh báo đơn thuần. Sự đột phá này đã thúc đẩy sự ra đời của các giải pháp rà soát mã nguồn tích hợp AI — bao gồm cả các nền tảng phân tích chuyên dụng (CodeRabbit, Qodo) lẫn các trợ lý dòng lệnh và tiện ích mở rộng trong IDE (Claude Code, Aider, Cursor, Continue…).

Mặc dù mang lại nhiều cải tiến, các giải pháp tích hợp AI này vẫn vấp phải những rào cản đáng kể khi đưa vào sử dụng thực tế. Trước hết là rủi ro bảo mật dữ liệu. Phần lớn các công cụ hiện nay, dù vận hành dưới dạng ứng dụng đám mây hay tiện ích mở rộng trong IDE, đều hoạt động theo cơ chế lai (Hybrid) hoặc phụ thuộc vào dịch vụ Cloud. Khi phân tích các lỗi logic phức tạp, hệ thống buộc phải đóng gói và gửi ngữ cảnh mã nguồn qua API lên máy chủ bên thứ ba, gây rủi ro đối với các dự án có tính bảo mật cao hoặc phần mềm độc quyền của doanh nghiệp.

Tiếp theo là gánh nặng về chi phí vận hành. Các công cụ thương mại thường có giá thành cao, đặc biệt với lập trình viên độc lập hoặc nhóm phát triển nhỏ. Do thiếu sự giám sát kịp thời của con người trong từng bước, các công cụ AI hoạt động tự động rất dễ rơi vào vòng lặp quét ngầm lặp đi lặp lại (Agent loop). Việc liên tục gửi kèm lượng lớn ngữ cảnh (Context Window) của toàn bộ dự án qua mỗi vòng lặp khiến lượng token tiêu thụ tăng vọt, dẫn đến chi phí hóa đơn khó kiểm soát.

Không dừng lại ở đó, quy trình tương tác trong môi trường cục bộ vẫn mang tính rời rạc khi các giải pháp Code Review tích hợp AI trên máy cá nhân hiện nay thiếu một bảng điều khiển (Dashboard) trung tâm để gom nhóm, phân loại hay theo dõi vòng đời của lỗi. Mặc dù các tiện ích mở rộng trên IDE cho phép lập trình viên tương tác trực tiếp trên mã nguồn, chúng lại thiếu góc nhìn tổng quan để quản lý tập trung. Người dùng phải duyệt từng cảnh báo riêng lẻ qua khung chat hoặc Terminal, tự phân loại mức độ nghiêm trọng và thiếu cơ chế theo dõi trạng thái lỗi. Trải nghiệm thiếu tính đồng bộ này có thể làm phân tán sự tập trung và giảm hiệu suất rà soát tổng thể.

Từ các vấn đề trên, có thể thấy một khoảng trống công nghệ rõ rệt khi thị trường đang thiếu vắng một giải pháp Code Review kết hợp được ưu điểm của cả hai hướng đi. Hệ thống cần cân bằng giữa hiệu năng và độ hữu dụng: nhanh, nhẹ, vận hành hoàn toàn cục bộ nhằm bảo mật và tối ưu chi phí, đồng thời sở hữu giao diện quản lý tập trung vốn là thế mạnh của các nền tảng hiện đại.

Do đó, giải pháp dự kiến hướng tới một bảng điều khiển (Dashboard) trực quan, tự động gom nhóm và phân loại lỗi, cho phép lập trình viên dễ dàng nhận diện vị trí, nguyên nhân và các đề xuất chỉnh sửa chi tiết. Người dùng có thể chủ động phê duyệt, từ chối hoặc tiếp tục hội thoại với AI để làm rõ ngữ cảnh lỗi. Việc này kỳ vọng giúp con người can thiệp sớm nhằm hạn chế vòng lặp AI không cần thiết, tối ưu hóa quy trình làm việc tại một nơi duy nhất.

Chính vì những lý do trên, đề tài "Xây dựng công cụ tự động đánh giá mã nguồn sử dụng LLMs" đã được lựa chọn nghiên cứu và thực hiện. Mục tiêu cốt lõi là xây dựng một hệ thống hoàn chỉnh nhằm cải thiện quy trình rà soát mã nguồn, góp phần nâng cao năng suất của lập trình viên và nâng cao chất lượng kỹ thuật trong các dự án phát triển phần mềm — hiện thực hóa một giải pháp Code Review kết hợp cân bằng giữa năng lực của AI và khả năng kiểm soát của con người.


---

### 1.2. Mục tiêu đề tài

Mục tiêu tổng quát của đề tài là xây dựng một công cụ tự động đánh giá mã nguồn tích hợp AI, có khả năng vận hành hoàn toàn trên môi trường cục bộ nhằm phát hiện, phân loại và đề xuất sửa chữa các lỗi tiềm ẩn trong mã nguồn, đồng thời cung cấp giao diện quản lý tập trung để theo dõi vòng đời của các cảnh báo.

Các mục tiêu cụ thể bao gồm:

- **Thứ nhất**, nghiên cứu tổng quan về quy trình Code Review truyền thống, các phương pháp phân tích tĩnh và động, cũng như các mô hình chất lượng phần mềm theo tiêu chuẩn ISO 25010, từ đó xác định những hạn chế cốt lõi của các giải pháp hiện có.

- **Thứ hai**, tìm hiểu các mô hình ngôn ngữ lớn (LLMs) và cơ chế suy luận của chúng trong bối cảnh phân tích mã nguồn, bao gồm các phương pháp tối ưu hóa ngữ cảnh, quản lý token và tích hợp API.

- **Thứ ba**, thiết kế và xây dựng một kiến trúc hệ thống dạng pipeline gồm bốn giai đoạn: (1) quét mã nguồn bằng công cụ phân tích tĩnh OpenGrep để phát hiện lỗi cú pháp và bảo mật, (2) bóc tách cấu trúc AST và xây dựng đồ thị tri thức bằng GitNexus, (3) sử dụng LLM để phân tích ngữ cảnh và đề xuất sửa chữa, (4) tổng hợp và hiển thị báo cáo lên Dashboard.

- **Thứ tư**, phát triển một giao diện Dashboard trực quan cho phép lập trình viên xem danh sách lỗi đã được phân loại, xem chi tiết đề xuất sửa chữa, phê duyệt hoặc từ chối từng cảnh báo, và hội thoại với AI qua cơ chế Ask AI để làm rõ ngữ cảnh.

- **Thứ năm**, triển khai các cơ chế tối ưu hóa chi phí vận hành, bao gồm quản lý token thông minh, kiểm soát độ sâu phân tích và lưu trữ bộ nhớ hội thoại để tránh các vòng lặp AI không cần thiết.

- **Thứ sáu**, đánh giá hiệu quả của hệ thống thông qua các kịch bản thử nghiệm thực tế, so sánh kết quả giữa phương pháp phân tích tĩnh thuần túy và phương pháp kết hợp AI, đồng thời đo lường độ chính xác của các đề xuất sửa chữa.


---

### 1.3. Đối tượng và phạm vi nghiên cứu

**Đối tượng nghiên cứu**

Đối tượng nghiên cứu của đề tài là quy trình rà soát mã nguồn tự động (Automated Code Review) trong phát triển phần mềm, tập trung vào việc ứng dụng các mô hình ngôn ngữ lớn (LLMs) để nâng cao khả năng phát hiện lỗi logic và đề xuất sửa chữa so với các phương pháp phân tích tĩnh truyền thống. Các thành phần chính được nghiên cứu bao gồm: cơ chế hoạt động của các công cụ phân tích tĩnh (Static Analysis), đồ thị tri thức (Knowledge Graph) trong biểu diễn cấu trúc mã nguồn, và năng lực suy luận ngữ cảnh của các mô hình LLM trong việc đánh giá chất lượng mã nguồn.

**Phạm vi nghiên cứu**

Về mặt lý thuyết, đề tài tập trung vào các khái niệm và mô hình liên quan trực tiếp đến bài toán đánh giá mã nguồn: tiêu chuẩn chất lượng phần mềm ISO 25010, phương pháp phân tích tĩnh với cơ chế pattern-matching, đồ thị tri thức trong biểu diễn quan hệ giữa các thành phần mã nguồn, và các mô hình ngôn ngữ lớn (LLMs) với khả năng suy luận ngữ cảnh. Ngoài ra, mô hình TELPA (Technology-Enhanced Language Proficiency Assessment) cũng được tham khảo như một khung lý thuyết cho cách tiếp cận hybrid kết hợp giữa công cụ truyền thống và AI.

Về mặt thực nghiệm, đề tài xây dựng một hệ thống hoàn chỉnh có tên VexCode với các giới hạn sau:

- **Ngôn ngữ mã nguồn hỗ trợ**: Python, JavaScript, TypeScript — là ba ngôn ngữ phổ biến trong nhóm ngôn ngữ thông dịch và có hệ sinh thái phát triển nhanh, nơi lỗi logic dễ phát sinh do thiếu kiểm tra kiểu tĩnh ở mức độ sâu. Tuy nhiên, kiến trúc hệ thống được thiết kế mở rộng để có thể bổ sung thêm ngôn ngữ (Java, Go, Rust, C/C++) với chi phí thấp.

- **Mô hình LLM sử dụng**: Các mô hình thương mại và mã nguồn mở truy cập qua OpenRouter và NVIDIA NIM, bao gồm Claude (Anthropic), GPT (OpenAI) và các mô hình mã nguồn mở (Llama, Qwen, DeepSeek). Hệ thống không huấn luyện hay fine-tune mô hình riêng mà tận dụng năng lực suy luận có sẵn thông qua cơ chế prompt engineering.

- **Phạm vi kiểm thử**: Hệ thống được thử nghiệm trên các dự án mã nguồn mở có sẵn và các bộ dữ liệu lỗi chuẩn hóa. Không áp dụng cho các hệ thống thời gian thực, hệ thống nhúng hoặc các yêu cầu đặc thù về miễn nhiễm lỗi (fault tolerance) cấp độ cao.

- **Môi trường triển khai**: Hệ thống vận hành trên môi trường desktop (Windows, macOS, Linux), không bao gồm triển khai dưới dạng dịch vụ đám mây hoặc tích hợp CI/CD pipeline ở phạm vi doanh nghiệp.


---

### 1.4. Phương pháp nghiên cứu

Đề tài sử dụng kết hợp các phương pháp nghiên cứu lý thuyết và thực nghiệm nhằm đảm bảo tính khoa học và khả năng ứng dụng thực tế của sản phẩm.

**Phương pháp nghiên cứu lý thuyết**

Trước hết, đề tài tiến hành thu thập, tổng hợp và phân tích các tài liệu khoa học liên quan đến lĩnh vực Code Review, phân tích mã nguồn tĩnh, chất lượng phần mềm, đồ thị tri thức và các mô hình ngôn ngữ lớn. Các nguồn tham khảo bao gồm sách chuyên ngành, bài báo khoa học từ các hội nghị uy tín (ICSE, FSE, ASE, NeurIPS), tài liệu kỹ thuật từ các dự án mã nguồn mở và tài liệu chính thức từ các nhà cung cấp công nghệ. Kết quả của quá trình này là khung lý thuyết nền tảng được trình bày trong Chương 2.

**Phương pháp phân tích và thiết kế hệ thống**

Hệ thống được thiết kế theo hướng tiếp cận kiến trúc pipeline, chia quy trình xử lý thành các giai đoạn độc lập có thể thay thế và mở rộng. Mỗi giai đoạn được phân tích yêu cầu chức năng và phi chức năng, sau đó thiết kế chi tiết về luồng dữ liệu, cấu trúc module, giao diện API và cơ chế tương tác giữa các thành phần. Kết quả thiết kế được mô hình hóa bằng sơ đồ khối, sơ đồ lớp và sơ đồ tuần tự.

**Phương pháp thực nghiệm và phát triển phần mềm**

Hệ thống được phát triển theo quy trình RIPER-5 (Research, Innovate, Plan, Execute, Review) — một quy trình phát triển phần mềm tinh gọn kết hợp giữa nghiên cứu và thực hành. Các công nghệ được lựa chọn dựa trên tiêu chí phù hợp với bài toán và khả năng vận hành cục bộ:

- Python 3.12 cho bộ phân tích (engine) nhờ hệ sinh thái thư viện phong phú về AST parsing và xử lý ngôn ngữ tự nhiên.
- Node.js 18 (ESM) cho backend nhờ khả năng xử lý bất đồng bộ và hệ sinh thái npm phong phú.
- React 19 với TypeScript cho frontend nhờ kiến trúc component và khả năng quản lý trạng thái phức tạp.

**Phương pháp kiểm thử và đánh giá**

Để đánh giá hiệu quả của hệ thống, đề tài sử dụng ba hình thức kiểm thử:

- **Kiểm thử đơn vị (Unit Test)**: Kiểm tra từng module riêng lẻ bằng Vitest cho Node.js và React, pytest cho Python.
- **Kiểm thử tích hợp (Integration Test)**: Kiểm tra luồng xử lý từ đầu đến cuối trên pipeline, đảm bảo dữ liệu được truyền chính xác qua các giai đoạn.
- **Đánh giá độ chính xác của AI (Human-reviewed Fix Accuracy)**: Các đề xuất sửa chữa từ AI được con người đánh giá và phân loại thành ba mức: Đúng, Đúng một phần, Sai. Kết quả được thống kê và so sánh giữa các mô hình LLM khác nhau.

**Phương pháp so sánh đối chứng**

Để chứng minh hiệu quả của việc kết hợp AI, đề tài thực hiện so sánh nội bộ giữa hai chế độ của cùng một hệ thống VexCode: (1) chế độ chỉ sử dụng OpenGrep (phân tích tĩnh thuần túy) và (2) chế độ đầy đủ với AI enrichment. Việc so sánh trên cùng một nền tảng giúp loại bỏ các yếu tố nhiễu và đưa ra kết luận khách quan về đóng góp của AI trong quy trình phát hiện lỗi.


---

### 1.5. Bố cục báo cáo

Báo cáo được tổ chức thành năm chương với nội dung như sau:

- **Chương 1 — Mở đầu**: Trình bày bối cảnh, lý do chọn đề tài, mục tiêu, đối tượng, phạm vi, phương pháp nghiên cứu và bố cục báo cáo.

- **Chương 2 — Cơ sở lý thuyết**: Hệ thống hóa các khái niệm nền tảng bao gồm quy trình Code Review, mô hình chất lượng phần mềm ISO 25010, phân tích mã nguồn tĩnh, đồ thị tri thức, trí tuệ nhân tạo và mô hình ngôn ngữ lớn, mô hình TELPA, và tổng quan các công nghệ liên quan.

- **Chương 3 — Phân tích, thiết kế và triển khai hệ thống**: Trình bày yêu cầu hệ thống, kiến trúc tổng thể, pipeline xử lý bốn giai đoạn, lựa chọn công nghệ, thiết kế chi tiết về lưu trữ, giao diện và API, các cơ chế vận hành (SSE stream, chat memory, token optimization, cross-scan tracking, graceful fallback), và triển khai từng thành phần (Python Engine, Node.js Backend, React Frontend).

- **Chương 4 — Thử nghiệm và đánh giá**: ...

- **Chương 5 — Kết luận**: Tổng kết các kết quả đạt được, chỉ ra những hạn chế còn tồn tại và đề xuất hướng phát triển trong tương lai.


---

# Chương 2. Cơ sở lý thuyết

---

### 2.1. Tổng quan về Code Review

**2.1.1. Khái niệm và vai trò của Code Review**

Code Review (rà soát mã nguồn) là quy trình kiểm tra có hệ thống mã nguồn của một dự án phần mềm bởi một hoặc nhiều người khác ngoài tác giả, nhằm phát hiện lỗi, đảm bảo chất lượng và duy trì tính nhất quán trong toàn bộ hệ thống. Đây là một trong những hoạt động quan trọng nhất trong kỹ nghệ phần mềm, được xem như một "cánh cổng chất lượng" trước khi mã nguồn được hợp nhất vào nhánh chính.

Theo nghiên cứu kinh điển của Fagan (1976) về kiểm tra phần mềm có cấu trúc (Software Inspections), việc phát hiện lỗi ở giai đoạn sớm có thể giảm chi phí sửa lỗi từ 10 đến 100 lần so với phát hiện ở giai đoạn vận hành. Nghiên cứu hiện đại hơn của McIntosh và cộng sự (2014) cũng chỉ ra rằng các dự án có quy trình Code Review chặt chẽ có tỷ lệ lỗi hậu kỳ thấp hơn đáng kể.

Code Review đóng vai trò quan trọng trong các khía cạnh sau:

- **Phát hiện lỗi sớm**: Giúp phát hiện lỗi logic, lỗi bảo mật, lỗi xử lý ngoại lệ trước khi mã nguồn đi vào sản xuất.
- **Chia sẻ kiến thức**: Tạo cơ hội cho các thành viên trong nhóm hiểu sâu hơn về các phần khác nhau của hệ thống.
- **Duy trì chuẩn mực**: Đảm bảo mã nguồn tuân thủ coding convention, kiến trúc và các tiêu chuẩn chất lượng của tổ chức.
- **Cải thiện thiết kế**: Các nhận xét trong Code Review thường dẫn đến các cải tiến về thiết kế và kiến trúc.

**2.1.2. Các hình thức Code Review**

Trong thực tế phát triển phần mềm, có ba hình thức Code Review chính:

- **Code Review thủ công (Manual Review)**: Lập trình viên đọc mã nguồn của đồng nghiệp và đưa ra nhận xét. Hình thức này cho chất lượng cao nhất nhưng tốn nhiều thời gian và phụ thuộc vào kinh nghiệm của người review.

- **Công cụ phân tích tĩnh (Static Analysis Tools)**: Các công cụ tự động như ESLint, SonarQube, OpenGrep quét mã nguồn dựa trên tập luật có sẵn. Hình thức này nhanh, toàn diện nhưng thiếu khả năng hiểu ngữ cảnh logic.

- **Công cụ tích hợp AI (AI-assisted Code Review)**: Kết hợp giữa phân tích tĩnh và mô hình ngôn ngữ lớn để hiểu ngữ cảnh và đưa ra đề xuất sửa lỗi thông minh. Đây là hướng tiếp cận mới nhất, đang được nghiên cứu và phát triển mạnh mẽ.

**2.1.3. Thách thức trong Code Review hiện đại**

Với sự phát triển của các dự án phần mềm quy mô lớn, Code Review đối mặt với nhiều thách thức:

- **Khối lượng lớn thay đổi (Large Changesets)**: Các Pull Request có thể chứa hàng trăm file thay đổi, vượt quá khả năng đọc hiểu của con người trong một phiên làm việc.
- **Thiếu ngữ cảnh liên tệp tin**: Người review phải hiểu mối quan hệ giữa nhiều file để đánh giá tác động của một thay đổi.
- **Áp lực thời gian**: Trong môi trường phát triển nhanh (Agile, DevOps), thời gian cho Code Review thường bị nén lại.
- **Độ chín về kiến thức miền**: Người review cần có kiến thức sâu về cả công nghệ lẫn nghiệp vụ để đưa ra đánh giá chính xác.

Chính những thách thức này đặt ra nhu cầu cấp thiết về các công cụ hỗ trợ thông minh, có khả năng tự động hóa một phần hoặc toàn bộ quy trình Code Review, giúp con người tập trung vào các quyết định thiết kế quan trọng thay vì sa lầy vào việc rà soát thủ công.


---

### 2.2. Chất lượng phần mềm theo tiêu chuẩn ISO 25010

**2.2.1. Tổng quan về ISO 25010**

ISO 25010 là một phần của gia đình tiêu chuẩn SQuaRE (Software product Quality Requirements and Evaluation), kế thừa và mở rộng từ ISO 9126. Đây là mô hình đánh giá chất lượng phần mềm được công nhận rộng rãi trên toàn cầu, cung cấp một khung phân loại toàn diện về các đặc tính chất lượng của sản phẩm phần mềm.

Mô hình ISO 25010 chia chất lượng phần mềm thành hai góc nhìn chính: chất lượng sản phẩm (Product Quality) và chất lượng khi sử dụng (Quality in Use). Mỗi góc nhìn bao gồm các đặc tính và đặc tính con được định nghĩa chi tiết.

**2.2.2. Mô hình chất lượng sản phẩm (Product Quality Model)**

Mô hình này gồm 8 đặc tính chính:

- **Tính phù hợp chức năng (Functional Suitability)**: Mức độ phần mềm đáp ứng các yêu cầu chức năng đã được xác định. Bao gồm tính đầy đủ (Completeness), tính chính xác (Correctness) và tính phù hợp (Appropriateness).

- **Hiệu năng và hiệu quả (Performance Efficiency)**: Khả năng đáp ứng của hệ thống về thời gian xử lý, tài nguyên sử dụng và dung lượng lưu trữ.

- **Tính tương thích (Compatibility)**: Khả năng trao đổi thông tin và thực hiện các chức năng yêu cầu với các hệ thống khác.

- **Tính dễ sử dụng (Usability)**: Mức độ dễ dàng khi người dùng tương tác với hệ thống.

- **Tính tin cậy (Reliability)**: Khả năng duy trì hoạt động ở mức hiệu năng xác định trong điều kiện quy định.

- **Tính bảo mật (Security)**: Khả năng bảo vệ thông tin và dữ liệu khỏi truy cập trái phép.

- **Tính bảo trì (Maintainability)**: Mức độ dễ dàng khi sửa đổi, nâng cấp và bảo trì phần mềm.

- **Tính khả chuyển (Portability)**: Khả năng chuyển đổi phần mềm giữa các môi trường khác nhau.

**2.2.3. Ứng dụng ISO 25010 trong đánh giá Code Review**

Trong bối cảnh đề tài, mô hình ISO 25010 được sử dụng làm khung phân loại cho các phát hiện lỗi từ quy trình Code Review. Cụ thể:

- Các lỗi về **Functional Suitability** bao gồm logic sai, thiếu xử lý biên, kết quả tính toán không chính xác.
- Các lỗi về **Security** bao gồm lỗ hổng SQL injection, XSS, hardcoded credential, thiếu kiểm tra đầu vào.
- Các lỗi về **Reliability** bao gồm thiếu xử lý ngoại lệ, race condition, resource leak.
- Các lỗi về **Maintainability** bao gồm code duplication, thiếu unit test, vi phạm coding convention, comment không rõ ràng.
- Các lỗi về **Performance Efficiency** bao gồm thuật toán kém hiệu quả, N+1 query, memory leak tiềm ẩn.

Việc phân loại phát hiện theo ISO 25010 giúp hệ thống cung cấp cái nhìn có cấu trúc về chất lượng mã nguồn, hỗ trợ lập trình viên ưu tiên xử lý các lỗi theo mức độ ảnh hưởng đến chất lượng tổng thể.


---

### 2.3. Phân tích mã nguồn tĩnh

**2.3.1. Khái niệm phân tích tĩnh**

Phân tích mã nguồn tĩnh (Static Code Analysis) là phương pháp đánh giá chất lượng phần mềm bằng cách phân tích mã nguồn hoặc mã nhị phân mà không cần thực thi chương trình. Kỹ thuật này hoạt động dựa trên việc xây dựng và duyệt cây cú pháp trừu tượng (Abstract Syntax Tree — AST) hoặc đồ thị luồng điều khiển (Control Flow Graph — CFG) của chương trình, sau đó áp dụng các luật phát hiện mẫu (pattern matching) để tìm ra các cấu trúc mã có vấn đề.

Phân tích tĩnh sở hữu ưu điểm vượt trội về tốc độ — có thể quét toàn bộ kho mã nguồn hàng triệu dòng trong vài phút. Phương pháp này đặc biệt hiệu quả trong việc phát hiện các lỗi có tính cấu trúc như sử dụng biến chưa khởi tạo, lỗ hổng bảo mật kinh điển (SQL injection, XSS), vi phạm coding convention, và các vấn đề về kiểu dữ liệu.

Tuy nhiên, phân tích tĩnh có hạn chế cố hữu là tỷ lệ dương tính giả (False Positive) cao, do các công cụ thiếu khả năng hiểu ngữ cảnh thực thi và ý đồ thiết kế của lập trình viên. Một số lỗi chỉ có thể phát hiện qua phân tích động (Dynamic Analysis) khi chương trình thực thi với dữ liệu đầu vào cụ thể.

**2.3.2. OpenGrep — Công cụ phân tích tĩnh mã nguồn mở**

OpenGrep (trước đây là Semgrep) là một công cụ phân tích tĩnh mã nguồn mở, sử dụng cơ chế pattern-matching thông minh dựa trên AST thay vì so khớp văn bản thuần túy. Điểm khác biệt cốt lõi của OpenGrep so với các công cụ truyền thống (như grep, ESLint) là khả năng hiểu cấu trúc ngôn ngữ: thay vì so khớp chuỗi ký tự, OpenGrep phân tích cú pháp của mã nguồn thành AST rồi thực hiện so khớp trên cấu trúc cây này.

OpenGrep hỗ trợ hơn 30 ngôn ngữ lập trình, với kho luật cộng đồng (Registry) lên đến hàng ngàn luật được đóng góp và kiểm duyệt. Các luật của OpenGrep được viết bằng chính ngôn ngữ đích, giúp lập trình viên dễ dàng tùy chỉnh. Ví dụ, luật phát hiện sử dụng exec() không an toàn trong Python được viết như sau:

`yaml
rules:
  - id: dangerous-exec
    patterns:
      - pattern: exec()
    message: "Phát hiện sử dụng exec() với dữ liệu đầu vào, có nguy cơ RCE"
    languages: [python]
    severity: ERROR
`

**2.3.3. Định dạng SARIF (Static Analysis Results Interchange Format)**

SARIF là định dạng chuẩn hóa do OASIS phát triển, dùng để trao đổi kết quả phân tích tĩnh giữa các công cụ khác nhau. Đề tài sử dụng SARIF làm định dạng trung gian cho đầu ra của OpenGrep, tạo điều kiện cho việc chuẩn hóa và mở rộng hệ thống. Một báo cáo SARIF chứa thông tin về công cụ quét, các luật đã sử dụng, vị trí phát hiện (file, dòng, cột), mức độ nghiêm trọng và thông báo chi tiết cho từng lỗi.


---

### 2.4. Đồ thị tri thức (Knowledge Graph)

**2.4.1. Khái niệm và ứng dụng trong phân tích mã nguồn**

Đồ thị tri thức (Knowledge Graph) là một cấu trúc dữ liệu biểu diễn các thực thể và mối quan hệ giữa chúng dưới dạng đồ thị, với các nút (nodes) đại diện cho thực thể và các cạnh (edges) đại diện cho quan hệ. Khái niệm này được phổ biến rộng rãi bởi Google vào năm 2012, sau đó được ứng dụng trong nhiều lĩnh vực bao gồm cả kỹ nghệ phần mềm.

Trong bối cảnh phân tích mã nguồn, đồ thị tri thức biểu diễn các thành phần của chương trình (hàm, lớp, module, file) và mối quan hệ giữa chúng (gọi hàm, kế thừa, import, phụ thuộc). Khác với phương pháp phân tích tĩnh truyền thống chỉ dựa trên so khớp mẫu, đồ thị tri thức cho phép hệ thống hiểu được cấu trúc tổng thể của dự án và mối quan hệ chằng chịt giữa các thành phần. Ví dụ, khi một hàm A gọi hàm B trong file khác, đồ thị tri thức ghi nhận mối quan hệ này, cho phép AI truy xuất ngữ cảnh của cả A và B khi phân tích lỗi.

**2.4.2. Các loại đồ thị trong phân tích chương trình**

Trong lĩnh vực phân tích mã nguồn, tồn tại nhiều loại đồ thị khác nhau phục vụ các mục đích cụ thể:

- **AST (Abstract Syntax Tree)**: Biểu diễn cấu trúc cú pháp của chương trình dưới dạng cây, mỗi nút là một cấu trúc cú pháp (khai báo biến, biểu thức điều kiện, vòng lặp).
- **CFG (Control Flow Graph)**: Biểu diễn tất cả các đường đi có thể trong quá trình thực thi chương trình, hỗ trợ phát hiện mã chết (dead code) và phân tích độ phủ kiểm thử.
- **Call Graph**: Biểu diễn mối quan hệ gọi hàm giữa các hàm trong chương trình.
- **DFG (Data Flow Graph)**: Biểu diễn luồng dữ liệu giữa các biến, phát hiện lỗi sử dụng biến chưa khởi tạo.
- **PDG (Program Dependency Graph)**: Kết hợp CFG và DFG để biểu diễn cả phụ thuộc điều khiển lẫn phụ thuộc dữ liệu.

Đề tài tập trung xây dựng đồ thị tri thức kết hợp Call Graph và AST, phục vụ việc truy xuất ngữ cảnh liên tệp tin và hỗ trợ LLM trong phân tích lỗi.

**2.4.3. GitNexus — Công cụ xây dựng đồ thị tri thức mã nguồn**

GitNexus là công cụ phân tích mã nguồn tĩnh thế hệ mới, xây dựng đồ thị tri thức từ mã nguồn thông qua phân tích AST bằng tree-sitter. GitNexus hỗ trợ hơn 30 ngôn ngữ lập trình và cung cấp hệ thống truy vấn Cypher linh hoạt.

Các tính năng chính của GitNexus bao gồm:
- **Xây dựng Call Graph tự động**: Phát hiện tất cả mối quan hệ gọi hàm, import, kế thừa giữa các thành phần.
- **Phân tích tác động (Impact Analysis)**: Xác định vùng ảnh hưởng khi thay đổi một hàm hoặc module cụ thể.
- **Phát hiện luồng thực thi**: Gom nhóm các hàm liên quan thành luồng xử lý (execution flows) hoàn chỉnh.
- **API MCP (Model Context Protocol)**: Cho phép LLM truy vấn đồ thị tri thức một cách tự nhiên.

Trong VexCode, GitNexus đảm nhận vai trò Enricher — bổ sung ngữ cảnh cấu trúc cho các phát hiện từ OpenGrep, cung cấp đầu vào giàu thông tin cho LLM ở giai đoạn Resolver.


---

### 2.5. Trí tuệ nhân tạo và mô hình ngôn ngữ lớn

**2.5.1. Sự phát triển của mô hình ngôn ngữ lớn**

Mô hình ngôn ngữ lớn (Large Language Models — LLMs) là bước tiến vượt bậc của trí tuệ nhân tạo trong lĩnh vực xử lý ngôn ngữ tự nhiên. Khởi nguồn từ kiến trúc Transformer do Vaswani và cộng sự giới thiệu năm 2017, các LLM đã phát triển nhanh chóng từ các mô hình tiền huấn luyện (BERT, GPT-2) đến các mô hình quy mô lớn hiện nay (GPT-4, Claude, Llama, DeepSeek).

Điểm khác biệt chính của LLM hiện đại là khả năng suy luận ngữ cảnh (Contextual Reasoning) — mô hình hiểu được mối quan hệ giữa các phần trong văn bản dài, đưa ra phán đoán logic thay vì chỉ dựa trên thống kê từ ngữ. Khả năng này đặc biệt hữu ích trong phân tích mã nguồn, nơi ngữ cảnh giữa các file ảnh hưởng đến quyết định sửa lỗi.

**2.5.2. Ứng dụng LLM trong Code Review**

LLM có thể đảm nhận các vai trò sau trong Code Review:

- **Phân tích lỗi logic**: LLM hiểu ý đồ lập trình viên từ tên hàm, comment và cấu trúc code, phát hiện lỗi logic mà công cụ tĩnh không thấy.
- **Đề xuất sửa chữa (Fix Suggestion)**: Đưa ra đoạn mã sửa lỗi hoàn chỉnh kèm giải thích chi tiết.
- **Giải thích ngữ cảnh**: Giải thích tại sao code được viết theo cách nhất định, hỗ trợ lập trình viên mới hiểu dự án.
- **Phân loại ưu tiên**: Đánh giá mức độ nghiêm trọng và đề xuất thứ tự xử lý dựa trên ngữ cảnh.

**2.5.3. Kỹ thuật Prompt Engineering cho Code Review**

Để tận dụng hiệu quả LLM, prompt engineering đóng vai trò then chốt. Một prompt hiệu quả cần:

- **Cung cấp ngữ cảnh đầy đủ**: Đoạn mã lỗi, vị trí, ngôn ngữ, luật ISO 25010 liên quan.
- **Xác định vai trò**: Yêu cầu LLM đóng vai chuyên gia Code Review.
- **Cấu trúc đầu ra**: Yêu cầu JSON với các trường: loại lỗi, mức độ, đề xuất sửa chữa, giải thích.
- **Giới hạn phạm vi**: Chỉ phân tích trong vấn đề được yêu cầu, tránh lan man tốn token.

**2.5.4. Thách thức khi tích hợp LLM**

Ba thách thức chính khi tích hợp LLM vào Code Review:

- **Chi phí token (Token Cost)**: Mỗi lần gọi API đều tiêu thụ token. Cần cơ chế kiểm soát và cache thông minh.
- **Độ trễ (Latency)**: LLM mạnh thường có độ trễ vài giây đến vài chục giây.
- **Tính nhất quán (Consistency)**: LLM có thể đưa ra kết quả khác nhau cho cùng đầu vào. Cần cơ chế xác thực.
- **Bảo mật dữ liệu**: Mã nguồn gửi qua API có thể chứa thông tin nhạy cảm. Cần cân nhắc giữa local và cloud.


---

### 2.6. Mô hình TELPA

**2.6.1. Giới thiệu về TELPA**

TELPA (Technology-Enhanced Language Proficiency Assessment) là khung đánh giá năng lực ngôn ngữ có sự hỗ trợ của công nghệ. Mô hình này đề xuất cách tiếp cận hybrid kết hợp giữa phương pháp đánh giá truyền thống và công cụ công nghệ hiện đại.

Mặc dù TELPA được phát triển trong lĩnh vực đánh giá năng lực ngôn ngữ, tư tưởng cốt lõi — kết hợp công cụ tự động và đánh giá con người — hoàn toàn áp dụng được trong Code Review. Cả hai lĩnh vực đều cân bằng giữa tốc độ tự động hóa và chất lượng đánh giá chuyên sâu.

**2.6.2. Cấu trúc mô hình TELPA**

Mô hình TELPA gồm ba thành phần chính:

- **Công cụ đánh giá tự động**: Sàng lọc ban đầu, xử lý khối lượng lớn dữ liệu với tốc độ cao. Trong Code Review, đây là OpenGrep.
- **Đánh giá của chuyên gia**: Thẩm định sâu, xử lý trường hợp phức tạp cần ngữ cảnh và kinh nghiệm. Trong Code Review, đây là lập trình viên.
- **Lớp trung gian công nghệ**: Cầu nối giữa hai thành phần trên. Trong đề tài, lớp này chính là LLM — đóng vai trò "trợ lý thông minh" giúp gia tăng giá trị cả hai phía.

**2.6.3. Áp dụng TELPA vào VexCode**

Tư tưởng của TELPA được hiện thực hóa qua pipeline bốn giai đoạn:

- **Giai đoạn 1 — Scanner (Công cụ tự động)**: OpenGrep quét mã nguồn với tốc độ cao, phát hiện lỗi phổ biến dựa trên luật có sẵn.
- **Giai đoạn 2 — Enricher (Lớp trung gian)**: GitNexus xây dựng đồ thị tri thức, bổ sung ngữ cảnh cấu trúc cho từng phát hiện.
- **Giai đoạn 3 — Resolver (AI — Trợ lý thông minh)**: LLM phân tích từng phát hiện với ngữ cảnh đã làm giàu, phân loại theo ISO 25010 và đề xuất sửa chữa.
- **Giai đoạn 4 — Reporter (Con người — Phê duyệt)**: Dashboard hiển thị kết quả, cho phép lập trình viên phê duyệt, từ chối hoặc yêu cầu AI giải thích thêm.
Cách tiếp cận này đảm bảo ba nguyên tắc của TELPA: (1) tự động hóa tác vụ lặp đi lặp lại, (2) công nghệ tăng cường (augment) chứ không thay thế con người, (3) vòng phản hồi khép kín giữa công cụ và người dùng.


### 2.7. Tổng quan công nghệ liên quan

Phần này điểm qua các công nghệ được sử dụng trong hệ thống. Luận giải chi tiết về lý do lựa chọn sẽ được trình bày ở Chương 3.

| Nhóm | Công nghệ | Vai trò |
|------|-----------|---------|
| Phân tích tĩnh | OpenGrep (Semgrep fork) | Quét mã nguồn, pattern-matching trên AST |
| Đồ thị tri thức | GitNexus + Tree-sitter | Xây dựng Knowledge Graph, Call Graph |
| LLM | Claude, GPT, Llama, DeepSeek... | Phân tích ngữ cảnh, đề xuất sửa lỗi |
| LLM Platform | OpenRouter, NVIDIA NIM | API gateway đa provider |
| Backend | Node.js + Express | REST API, SSE stream |
| Frontend | React + TypeScript + Vite | Dashboard SPA |
| Editor | CodeMirror 6 | Hiển thị code với syntax highlight |
| Biểu đồ | Recharts | Dashboard charts |
| Testing | Vitest (JS/TS), pytest (Python) | Kiểm thử đơn vị |
| Định dạng | SARIF 2.1.0, JSON | Trao đổi và lưu trữ kết quả |
| Tiêu chuẩn | ISO/IEC 25010 | Phân loại chất lượng phần mềm |


---

# Chương 3. Phân tích, thiết kế và triển khai hệ thống

---

Chương 3 trình bày tổng quan về hệ thống VexCode: các yêu cầu chức năng và phi chức năng, kiến trúc ba tầng cùng pipeline xử lý bốn giai đoạn, thiết kế chi tiết về lưu trữ, giao diện, API và bảo mật, các cơ chế vận hành, và triển khai hệ thống.

---

### 3.1. Yêu cầu hệ thống

Xem file [`chuong-3-phan-tich-thiet-ke/3.1-yeu-cau-he-thong.md`](chuong-3-phan-tich-thiet-ke/3.1-yeu-cau-he-thong.md) — Yêu cầu chức năng (F01–F09) và yêu cầu phi chức năng (NF01–NF06) kèm cách kiểm chứng.

---

### 3.2. Kiến trúc hệ thống

Xem file [`chuong-3-phan-tich-thiet-ke/3.2-kien-truc-he-thong.md`](chuong-3-phan-tich-thiet-ke/3.2-kien-truc-he-thong.md) — Tổng quan kiến trúc 3 tầng, đối chiếu TELPA, thành phần module, luồng dữ liệu và thiết kế pipeline bốn giai đoạn.

---

### 3.3. Lựa chọn công nghệ

Xem file [`chuong-3-phan-tich-thiet-ke/3.3-lua-chon-cong-nghe.md`](chuong-3-phan-tich-thiet-ke/3.3-lua-chon-cong-nghe.md) — Bảng so sánh và luận giải lựa chọn công nghệ, các công nghệ thay thế và lý do không chọn.

---

### 3.4. Thiết kế chi tiết

Xem file [`chuong-3-phan-tich-thiet-ke/3.4-thiet-ke-chi-tiet.md`](chuong-3-phan-tich-thiet-ke/3.4-thiet-ke-chi-tiet.md) — Thiết kế lưu trữ dữ liệu, giao diện Dashboard, REST API endpoints và cơ chế bảo mật.

---

### 3.5. Các cơ chế vận hành

Xem file [`chuong-3-phan-tich-thiet-ke/3.5-co-che-van-hanh.md`](chuong-3-phan-tich-thiet-ke/3.5-co-che-van-hanh.md) — Cơ chế SSE streaming, lưu trữ hội thoại Ask AI, kiểm soát token, cross-scan tracking, graceful fallback và path safety.

---

### 3.6. Triển khai hệ thống

Xem file [`chuong-3-phan-tich-thiet-ke/3.6-trien-khai.md`](chuong-3-phan-tich-thiet-ke/3.6-trien-khai.md) — Triển khai Python Engine (Scanner, Pipeline, Resolver, Taxonomy), Node.js Backend (Bridge, SSE, Store) và React Frontend (Components, Hooks, Context, Pages).

---

# Chương 4. Thử nghiệm và đánh giá

---

### 4.1. Môi trường thử nghiệm

### 4.2. Kết quả kiểm thử đơn vị

### 4.3. Đánh giá độ chính xác của AI

### 4.4. So sánh các chế độ

### 4.5. Đánh giá hiệu năng

### 4.6. Case study

---

# Chương 5. Kết luận

---

### 5.1. Các kết quả đạt được

Sau quá trình nghiên cứu và triển khai, đề tài đã đạt được những kết quả chính sau:

**Về mặt lý thuyết:**

- Hệ thống hóa được các khái niệm nền tảng liên quan đến Code Review, phân tích tĩnh, đồ thị tri thức và mô hình ngôn ngữ lớn.
- Đề xuất khung kiến trúc pipeline bốn giai đoạn (Scanner → Enricher → Resolver → Reporter) kết hợp giữa công cụ truyền thống và AI, dựa trên tư tưởng của mô hình TELPA.
- Xây dựng hệ thống phân loại lỗi theo tiêu chuẩn ISO 25010, cung cấp góc nhìn có cấu trúc về chất lượng mã nguồn.

**Về mặt thực tiễn:**

- Xây dựng thành công hệ thống VexCode với ba thành phần độc lập: Python Engine (phân tích mã nguồn), Node.js Backend (điều phối và API), React Frontend (Dashboard trực quan).
- Tích hợp OpenGrep làm công cụ quét tĩnh với cơ chế tự động tải binary, không yêu cầu cài đặt thủ công.
- Tích hợp đa dạng mô hình LLM qua OpenRouter và NVIDIA NIM, cho phép người dùng linh hoạt lựa chọn giữa chất lượng và chi phí.
- Triển khai cơ chế SSE streaming cho phép người dùng theo dõi tiến trình phân tích theo thời gian thực.
- Xây dựng cơ chế Ask AI cho phép hội thoại tương tác với AI trong ngữ cảnh từng lỗi cụ thể.
- Triển khai cơ chế cross-scan tracking giúp theo dõi vòng đời lỗi qua nhiều lần quét (NEW → PERSISTING → RESOLVED → REGRESSED).
- Xây dựng cơ chế graceful fallback đảm bảo hệ thống vẫn hoạt động khi một thành phần gặp sự cố.
- Phát triển Dashboard trực quan với biểu đồ thống kê, bảng dữ liệu linh hoạt, Monaco Editor cho xem code và chat panel cho hội thoại AI.
- Hệ thống chạy hoàn toàn trên môi trường cục bộ, không phụ thuộc vào dịch vụ đám mây, đảm bảo bảo mật mã nguồn và kiểm soát chi phí.

**Về mặt đánh giá:**

- Hệ thống đã được kiểm thử đơn vị (unit test) cho các module chính với độ phủ kiểm thử đạt yêu cầu.
- Pipeline hoạt động ổn định qua các kịch bản kiểm thử tích hợp, bao gồm cả chế độ offline (mock scan + mock AI) và chế độ thực tế.
- Cơ chế kiểm soát token cho phép giảm thiểu chi phí vận hành thông qua gom nhóm findings và giới hạn code snippet.


---

### 5.2. Hạn chế và hướng phát triển

**Hạn chế**

Bên cạnh những kết quả đạt được, hệ thống còn tồn tại một số hạn chế:

- **Phạm vi ngôn ngữ hỗ trợ**: Hiện tại hệ thống chỉ hỗ trợ ba ngôn ngữ Python, JavaScript và TypeScript. Các ngôn ngữ biên dịch như Java, Go, Rust, C/C++ chưa được hỗ trợ do sự khác biệt về cấu trúc AST và quy tắc quét.

- **Đánh giá độ chính xác của AI**: Việc đánh giá các đề xuất sửa chữa từ AI dựa trên human review, chưa có benchmark chuẩn hóa hoặc bộ dữ liệu kiểm thử quy mô lớn để so sánh khách quan giữa các mô hình.

- **Tối ưu hiệu năng**: Với dự án có quy mô rất lớn (trên 500.000 dòng code), thời gian quét và phân tích có thể kéo dài, đặc biệt là giai đoạn Resolver khi số lượng findings lớn.

- **GitNexus phụ thuộc vào MCP server**: Tính năng Enricher hiện yêu cầu GitNexus MCP server hoạt động, tạo phụ thuộc vào một thành phần bên ngoài.

- **Chưa có cơ chế đa người dùng**: Hệ thống được thiết kế cho một người dùng duy nhất trên máy local, chưa hỗ trợ chia sẻ kết quả hoặc cộng tác nhóm.

**Hướng phát triển**

Trong tương lai, hệ thống có thể được phát triển theo các hướng sau:

- **Mở rộng ngôn ngữ hỗ trợ**: Bổ sung thêm Java, Go, Rust, C/C++, PHP, Ruby bằng cách cập nhật cấu hình OpenGrep rules và parser ngôn ngữ cho tree-sitter.

- **Xây dựng benchmark đánh giá**: Phát triển bộ dữ liệu lỗi chuẩn hóa với ground truth để đánh giá khách quan độ chính xác của AI, so sánh giữa các mô hình (Claude, GPT, Llama, DeepSeek) trên cùng một đầu vào.

- **Tối ưu hóa Resolver**: Áp dụng các kỹ thuật như batch processing song song, caching thông minh và RAG (Retrieval-Augmented Generation) để cải thiện tốc độ và chất lượng phân tích.

- **Hỗ trợ CI/CD Integration**: Xây dựng GitHub Action, GitLab CI plugin để tự động chạy VexCode trong pipeline CI/CD.

- **Cộng tác nhóm**: Phát triển cơ chế chia sẻ kết quả, bình luận và phê duyệt nhóm, hỗ trợ remote database (PostgreSQL) thay vì file-based storage.

- **Fine-tuning mô hình**: Nghiên cứu khả năng fine-tune một mô hình mã nguồn mở (CodeLlama, DeepSeek-Coder) trên dữ liệu Code Review để cải thiện chất lượng phân tích và giảm chi phí.

- **Tích hợp IDE Plugin**: Phát triển extension cho VS Code và JetBrains IDE để lập trình viên có thể xem kết quả Code Review ngay trong môi trường làm việc quen thuộc.


