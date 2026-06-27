# Chương 2: Cơ sở lý thuyết

---

## 2.1. Tổng quan về Code Review

### 2.1.1. Khái niệm và vai trò của Code Review

Rà soát mã nguồn (Code Review) là một hoạt động kiểm tra và đánh giá mã nguồn một cách hệ thống, được thực hiện bởi các lập trình viên hoặc công cụ hỗ trợ trước khi tích hợp mã nguồn đó vào nhánh phát triển chính của dự án. Trong kỹ nghệ phần mềm hiện đại, quy trình này đóng vai trò quyết định đến sự ổn định của hệ thống với ba giá trị cốt lõi:

- **Kiểm soát chất lượng và an toàn mã nguồn**: Code Review giúp phát hiện sớm các lỗi logic phức tạp, các vùng mã có nguy cơ gây rò rỉ bộ nhớ hoặc các lỗ hổng bảo mật sơ đẳng mà việc kiểm thử tự động (Unit Test) thường bỏ sót.

- **Tối ưu hóa cấu trúc (Refactoring)**: Quá trình này đảm bảo mã nguồn tuân thủ các nguyên lý thiết kế phần mềm (như SOLID, Clean Code) và các quy chuẩn định dạng chung (Coding Conventions) của tổ chức, giúp mã nguồn trở nên sáng tỏ và dễ đọc hơn.

- **Giảm thiểu chi phí kỹ thuật (Technical Debt)**: Việc loại bỏ các đoạn mã dư thừa, các thiết kế thiếu tối ưu ngay từ giai đoạn phát triển sẽ hạn chế tối đa chi phí bảo trì và mở rộng hệ thống trong tương lai.

Hình 2.1. Minh họa về Code Review.

### 2.1.2. Các hình thức Code Review

Tùy theo mức độ tự động hóa và quy mô áp dụng, Code Review được phân thành ba hình thức chính.

**Review thủ công (Manual Review)**: Lập trình viên tạo pull request, sau đó một hoặc nhiều đồng nghiệp đọc mã nguồn, để lại nhận xét và đề xuất thay đổi trước khi merge. Đây là hình thức truyền thống và vẫn được sử dụng phổ biến nhất.

**Phân tích tĩnh (Static Analysis)**: Sử dụng các công cụ tự động như ESLint, SonarQube hay Opengrep quét mã nguồn dựa trên tập luật có sẵn mà không cần thực thi chương trình.

**AI-assisted Code Review**: Ứng dụng mô hình ngôn ngữ lớn (LLM) để hỗ trợ hoặc tự động hóa việc rà soát mã nguồn, từ phát hiện lỗi đến đề xuất cách sửa.

Bảng 2.1. So sánh các hình thức Code Review.

| Tiêu chí | Review thủ công | Phân tích tĩnh | AI-assisted |
|---------|--------------|----------------|-------------|
| Tốc độ | Chậm (phụ thuộc reviewer) | Nhanh (tự động) | Trung bình (tự động + AI) |
| Chi phí | Cao (giờ công người) | Thấp (công cụ miễn phí/phổ thông) | Trung bình (phí API AI) |
| Hiểu ngữ cảnh nghiệp vụ | Tốt nhất | Không | Khá tốt (phụ thuộc model) |
| Phát hiện lỗi bảo mật | Phụ thuộc kinh nghiệm | Khá (theo rule có sẵn) | Cao (kết hợp rule + AI) |
| Mở rộng quy mô | Khó (cần nhiều reviewer) | Dễ | Dễ |
| Tích hợp CI/CD | Khó | Dễ | Dễ |

## 2.2. Mô hình chất lượng ISO/IEC 25010

### 2.2.1. Tổng quan về ISO/IEC 25010

ISO/IEC 25010 là một phần của gia đình tiêu chuẩn SQuaRE (Software product Quality Requirements and Evaluation), kế thừa và mở rộng từ ISO 9126. Đây là mô hình đánh giá chất lượng phần mềm được công nhận rộng rãi trên toàn cầu, cung cấp một khung phân loại toàn diện về các đặc tính chất lượng của sản phẩm phần mềm.

### 2.2.2. Các đặc tính chất lượng

ISO/IEC 25010 định nghĩa tám đặc tính chất lượng chính:

- **Functional Suitability** (tính phù hợp chức năng): Mức độ phần mềm đáp ứng các yêu cầu chức năng đã được xác định.
- **Performance Efficiency** (hiệu năng và hiệu quả): Khả năng đáp ứng của hệ thống về thời gian xử lý, tài nguyên sử dụng và dung lượng lưu trữ.
- **Compatibility** (tính tương thích): Khả năng trao đổi thông tin và thực hiện các chức năng yêu cầu với các hệ thống khác.
- **Usability** (tính dễ sử dụng): Mức độ dễ dàng khi người dùng tương tác với hệ thống.
- **Reliability** (tính tin cậy): Khả năng duy trì hoạt động ở mức hiệu năng xác định trong điều kiện quy định.
- **Security** (tính bảo mật): Khả năng bảo vệ thông tin và dữ liệu khỏi truy cập trái phép.
- **Maintainability** (tính bảo trì): Mức độ dễ dàng khi sửa đổi, nâng cấp và bảo trì phần mềm.
- **Portability** (tính khả chuyển): Khả năng chuyển đổi phần mềm giữa các môi trường khác nhau.

Ở phiên bản ISO/IEC 25010:2023 đã bổ sung thêm đặc tính thứ chín:

**Safety** (tính an toàn): Khả năng tránh gây ra các rủi ro về thể chất hoặc tổn hại đến con người và tài sản.

Trong bối cảnh đánh giá chất lượng mã nguồn bằng phương pháp phân tích tĩnh, không phải đặc tính nào của ISO 25010 cũng có thể đo lường hiệu quả. Các công cụ SAST hoạt động bằng cách quét mã nguồn và đối chiếu với tập luật, do đó chỉ có thể đánh giá các đặc tính mà kết quả phân tích có thể suy ra trực tiếp từ cấu trúc và nội dung mã. Bốn đặc tính phù hợp nhất với phương pháp này bao gồm: Security (phát hiện lỗ hổng qua rule tĩnh), Reliability (tìm mã có thể gây lỗi runtime như null reference, exception không xử lý), Performance Efficiency (phát hiện vòng lặp sâu, thuật toán kém, tài nguyên không được giải phóng), và Maintainability (đánh giá complexity, duplicated code, violations của coding conventions).

Ngược lại, các đặc tính Functional Suitability, Compatibility, Usability và Portability đòi hỏi đánh giá ở mức hành vi thực tế của phần mềm (chạy thử, kiểm thử tích hợp, đo lường trải nghiệm người dùng) — không thể suy ra chỉ từ mã nguồn. Safety là đặc tính mới, phạm vi đánh giá chủ yếu thuộc về các hệ thống nhúng hoặc safety-critical, đòi hỏi phương pháp chuyên biệt ngoài phân tích tĩnh thông thường.

## 2.3. Phân tích tĩnh và các công cụ quét

### 2.3.1. Khái niệm về phân tích tĩnh (Static Analysis)

Phân tích tĩnh (Static Analysis hoặc Static Application Security Testing - SAST) là phương pháp kiểm tra, đánh giá chất lượng và an ninh của phần mềm mà không cần thực thi chương trình. Quá trình này được thực hiện bằng cách phân tích trực tiếp mã nguồn thô (source code), mã trung gian hoặc mã máy của ứng dụng nhằm đối chiếu với các tập luật định sẵn. Do không yêu cầu chương trình phải chạy trong môi trường thực tế, phương pháp này cho phép rà soát toàn bộ các nhánh rẽ của mã nguồn, kể cả những phân đoạn mã hiếm khi được thực thi trong điều kiện thông thường.

Cơ chế vận hành và độ phức tạp của các công cụ phân tích tĩnh được phân cấp dựa trên khả năng bóc tách cấu trúc dữ liệu của bộ phân tích (parser):

Phân tích dựa trên Cây cú pháp trừu tượng (Abstract Syntax Tree - AST): Đây là cơ chế nền tảng có mặt trên hầu hết các công cụ quét tĩnh và các bộ Linters (như ESLint, Flake8). Mã nguồn dạng văn bản thô sẽ được bóc tách và chuyển đổi thành một cấu trúc dữ liệu dạng cây phân cấp. Tại đây, mỗi nút (node) đại diện cho một thành phần cú pháp (như biến số, toán tử, lời gọi hàm, hay câu lệnh điều kiện). Công cụ sẽ duyệt qua cây AST để thực hiện Thuật toán so khớp mẫu (Pattern Matching), đối chiếu cục bộ xem đoạn code có vi phạm các quy tắc Clean Code, sai cú pháp hoặc sử dụng các hàm đã bị khuyến cáo loại bỏ (deprecated) hay không.

Phân tích dựa trên Đồ thị luồng điều khiển (Control Flow Graph - CFG): Đối với các công cụ SAST nâng cao, hệ thống sẽ xây dựng thêm đồ thị CFG để mô phỏng tất cả các đường đi (paths) có thể xảy ra của dòng thực thi khi chương trình vận hành. Dựa trên đồ thị này, công cụ thực hiện Phân tích luồng dữ liệu (Data Flow Analysis / Taint Analysis) để theo dõi hành trình di chuyển của các nguồn dữ liệu chưa được kiểm chứng nhập vào từ người dùng (Sources) cho đến khi chúng đi vào các vùng xử lý nhạy cảm của hệ thống (Sinks). Nếu dữ liệu độc hại đi đến Sink mà không qua bộ lọc làm sạch (Sanitizer), công cụ sẽ phát hiện ra các lỗ hổng bảo mật nghiêm trọng như SQL Injection hay Cross-Site Scripting (XSS).

Tùy thuộc vào kiến trúc thiết kế, một công cụ quét tĩnh có thể chỉ dừng lại ở mức so khớp cấu trúc văn bản cục bộ, hoặc nâng cao hơn là phân tích luồng dữ liệu xuyên tệp tin. Trong hệ thống đề xuất, các công cụ được lựa chọn sẽ vận hành linh hoạt trên các cơ chế này tại môi trường cục bộ để tối ưu hóa tốc độ và phạm vi quét lỗi.

Hình 2.3. Quy trình khởi tạo Cây cú pháp trừu tượng (AST).

### 2.3.2. Ưu điểm và hạn chế của phương pháp phân tích tĩnh

Trong quy trình rà soát mã nguồn, phân tích tĩnh đóng vai trò như một bộ lọc tự động tuyến đầu nhờ sở hữu những ưu điểm thực tiễn sau:

- **Tốc độ xử lý vượt trội**: Có thể quét qua hàng triệu dòng code chỉ trong vài giây đến vài phút, giúp lập trình viên nhận được phản hồi gần như ngay lập tức tại môi trường cục bộ.
- **Tự động hóa diện rộng**: Dễ dàng bao phủ toàn bộ kho lưu trữ mã nguồn, đảm bảo không bỏ sót các lỗi cú pháp căn bản hoặc các cấu hình sai lệch.
- **Tiết kiệm chi phí vận hành**: Việc sử dụng các bộ quét tĩnh chạy cục bộ không tiêu tốn tài nguyên hay chi phí gọi API từ các dịch vụ bên thứ ba.

Mặc dù vậy, phương pháp này tồn tại những hạn chế cố hữu do bản chất hoạt động dựa trên luật (rule-based):

- **Tỷ lệ cảnh báo sai (False Positive) cao**: Do chỉ so khớp dựa trên các mẫu thô sơ và thiếu khả năng hiểu ngữ cảnh thực tế của dự án, công cụ thường xuyên đưa ra các cảnh báo lỗi sai, gây lãng phí thời gian sàng lọc của lập trình viên.
- **Không hiểu được logic nghiệp vụ**: Phân tích tĩnh hoàn toàn bất lực trước các lỗi thiết kế kiến trúc hoặc các lỗ hổng logic phức tạp (ví dụ: luồng phân quyền bị sai, xử lý sai quy trình nghiệp vụ của hệ thống).

### 2.3.3. Opengrep — Công cụ quét tĩnh mã nguồn mở

#### 2.3.3.1. Tổng quan về Opengrep

Opengrep là một công cụ phân tích tĩnh mã nguồn mở, được phát triển từ dự án Semgrep CE (Community Edition). Đây là engine SAST (Static Application Security Testing) được viết chủ yếu bằng OCaml, hoạt động dựa trên cơ chế so khớp mẫu ở mức AST, hỗ trợ hơn 30 ngôn ngữ lập trình và tương thích với cả ba nền tảng phổ biến là Linux, macOS và Windows.

Khác với các bộ linter thông thường chỉ kiểm tra định dạng bề mặt, Opengrep đi sâu vào việc phân tích cấu trúc cây cú pháp trừu tượng (AST) để đối chiếu mã nguồn với các tập luật (ruleset) bảo mật và chất lượng. Điểm đặc trưng của công cụ này là cho phép thực thi toàn bộ tiến trình phân tích trực tiếp trên máy tính cá nhân của lập trình viên mà không cần gửi mã nguồn lên máy chủ đám mây của bên thứ ba.

#### 2.3.3.2. Cơ chế hoạt động của Opengrep

Opengrep không tìm kiếm chuỗi ký tự thô sơ mà hoạt động dựa trên cơ chế hiểu biết cấu trúc ngữ pháp của ngôn ngữ lập trình. Quy trình quét lỗi được thực hiện tuần tự qua bốn bước sau:

- **Phân rã mã nguồn (Parsing)**: Opengrep chuyển đổi mã nguồn thô thành Cây cú pháp trừu tượng (AST). Quá trình này loại bỏ các yếu tố thừa như khoảng trắng, xuống dòng và bình luận, giúp chuẩn hóa cấu trúc code.
- **Tải tập luật (Rule Loading)**: Hệ thống đọc và biên dịch các quy tắc cấu hình từ tệp tin .yaml thành các bộ lọc điều kiện logic trong bộ nhớ.
- **So khớp mẫu (Pattern Matching)**: Opengrep duyệt qua cây AST để đối chiếu với tập luật. Nhờ kế thừa thuật toán thông minh từ Semgrep (sử dụng siêu biến và toán tử bỏ qua đoạn mã trung gian), công cụ nhận diện chính xác các sai phạm logic bất kể cách đặt tên biến hay định dạng của lập trình viên.
- **Đóng gói kết quả (Output Generation)**: Mỗi vị trí khớp được ghi lại thành một finding, bao gồm tệp nguồn, vị trí dòng, nội dung trích xuất và mã luật tương ứng.

#### 2.3.3.3. Các điểm cải tiến so với Semgrep

So với Semgrep bản gốc, Opengrep sở hữu ba điểm khác biệt cốt lõi sau:

**Mô hình quản trị mở và giấy phép tự do:** Opengrep được phát triển dưới mô hình quản trị mở (open governance), nghĩa là dự án do một liên minh các tổ chức bảo mật cùng duy trì chứ không phụ thuộc vào một công ty đơn lẻ. Bên cạnh đó, Opengrep sử dụng giấy phép LGPL-2.1 (một loại giấy phép mã nguồn mở cho phép sử dụng và tích hợp tự do), trong khi Semgrep áp dụng giấy phép độc quyền cho các tính năng nâng cao.

**Hỗ trợ phân tích luồng dữ liệu nội tệp (Intrafile Taint Analysis):** Opengrep hỗ trợ tính năng này qua tùy chọn `--taint-intrafile`. Đây là kỹ thuật giúp phát hiện khi dữ liệu đầu vào chưa được kiểm chứng (source) đi vào các hàm xử lý nhạy cảm (sink) như thực thi truy vấn hay ghi file. Opengrep có thể theo dõi luồng dữ liệu này xuyên qua nhiều hàm trong cùng một tệp, một khả năng trước đây chỉ có trong phiên bản trả phí Semgrep Pro.

**Khả năng tương thích tập luật hoàn toàn:** Hệ thống luật của Opengrep được cấu trúc bằng định dạng YAML và tương thích hoàn toàn với Semgrep. Điều này cho phép tận dụng trọn vẹn kho luật cộng đồng hiện có mà không cần tốn chi phí viết lại từ đầu.

### 2.3.4. Các tầng quét bổ trợ

Bên cạnh công cụ lõi Opengrep, hệ thống tích hợp thêm hai tầng bổ trợ chuyên biệt nhằm thiết lập một hàng rào bảo mật toàn diện tại môi trường cục bộ. Cả ba công cụ này hoạt động độc lập và kết quả cuối cùng được gộp chung vào danh sách findings đầu vào cho các giai đoạn xử lý tiếp theo.

#### 2.3.4.1. Tầng quét rò rỉ dữ liệu nhạy cảm (Gitleaks)

**Tổng quan:** Gitleaks là một công cụ phân tích tĩnh chuyên biệt, hiệu năng cao, được thiết kế để rà soát và phát hiện các thông tin bí mật (secrets), khóa xác thực (API keys, tokens) hoặc mật khẩu bị lưu cứng (hardcoded) trong mã nguồn hoặc lưu vết trong lịch sử commit của Git.

**Cơ chế hoạt động:** Gitleaks không bóc tách cấu trúc AST như Opengrep mà vận hành dựa trên cơ chế so khớp biểu thức chính quy (Regex) được tối ưu hóa. Công cụ quét qua toàn bộ các tệp tin văn bản thuần túy hoặc duyệt ngược dòng lịch sử commit của kho lưu trữ để đối chiếu với tập luật định sẵn, từ đó phát hiện nhanh các chuỗi ký tự có cấu trúc đặc trưng của các dịch vụ phổ biến (như AWS keys, GitHub tokens, Google API keys).

#### 2.3.4.2. Tầng quét lỗ hổng thư viện phụ thuộc (OSV-Scanner)

**Tổng quan:** OSV-Scanner là công cụ phân tích thành phần phần mềm (SCA - Software Composition Analysis) mã nguồn mở do Google phát triển. Công cụ này chịu trách nhiệm kiểm tra tính an toàn của các thư viện bên thứ ba được sử dụng.

**Cơ chế hoạt động:** Thay vì quét mã nguồn tự viết, OSV-Scanner tự động trích xuất danh sách và phiên bản của các thư viện phụ thuộc thông qua các tệp tin cấu hình quản lý gói (như `package.json` của Node.js hay `requirements.txt` của Python). Sau đó, công cụ tiến hành tra cứu và đối chiếu danh sách này với cơ sở dữ liệu lỗ hổng nguồn mở tập trung (Open Source Vulnerabilities - OSV database) để đưa ra cảnh báo chính xác về các mã lỗi CVE/GHSA hiện có trên các phiên bản thư viện đó.

## 2.4. Knowledge Graph và GitNexus

### 2.4.1. Khái niệm Knowledge Graph

Knowledge Graph (đồ thị tri thức) là một cấu trúc dữ liệu biểu diễn các thực thể và mối quan hệ giữa chúng dưới dạng đồ thị. Mỗi thực thể được biểu diễn bằng một nút (node), và mỗi quan hệ giữa các thực thể được biểu diễn bằng một cạnh (edge) có hướng kèm nhãn mô tả. Cấu trúc này đặc biệt phù hợp với các bài toán cần hiểu mối liên hệ giữa nhiều thực thể, như phân tích kiến trúc phần mềm hay phát hiện lỗ hổng bảo mật.

Trong ngữ cảnh phân tích mã nguồn, Knowledge Graph biểu diễn các thành phần của chương trình (hàm, lớp, biến, module) và các mối quan hệ giữa chúng (gọi hàm, kế thừa, phụ thuộc). Khác với AST chỉ ghi nhận cấu trúc cú pháp theo chiều dọc cha-con trong từng tệp riêng lẻ, Knowledge Graph tập trung vào các kết nối ngữ nghĩa giữa các thực thể xuyên suốt nhiều tệp tin. Sự khác biệt này cho phép Knowledge Graph trả lời các câu hỏi về kiến trúc và luồng điều khiển của toàn bộ dự án, điều mà AST không thể làm được vì mỗi tệp có một AST riêng biệt.

Knowledge Graph trong phân tích mã nguồn có thể bao gồm nhiều loại đồ thị chuyên biệt, mỗi loại phục vụ một mục đích phân tích khác nhau:

- **Call Graph** (đồ thị lời gọi): Biểu diễn mối quan hệ gọi hàm giữa các hàm trong chương trình. Call Graph cho phép xác định tác động lan truyền khi một hàm bị thay đổi.
- **Dependency Graph** (đồ thị phụ thuộc): Biểu diễn sự phụ thuộc giữa các module hoặc tệp tin, giúp phát hiện các vòng lặp phụ thuộc (circular dependency) và xác định thứ tự biên dịch.
- **Class Hierarchy Graph** (đồ thị phân cấp lớp): Biểu diễn quan hệ kế thừa giữa các lớp, hỗ trợ phân tích tính đa hình và xác định phương thức được gọi tại runtime.
- **Data Flow Graph** (đồ thị luồng dữ liệu): Biểu diễn đường đi của dữ liệu qua các biến và tham số, thường được sử dụng trong taint analysis để phát hiện lỗ hổng bảo mật.

Hình 2.4. Minh họa Knowledge Graph trong phân tích mã nguồn.

### 2.4.2. GitNexus — Công cụ xây dựng Knowledge Graph

GitNexus là công cụ xây dựng và truy vấn Knowledge Graph cho mã nguồn. Mục tiêu chính của GitNexus là giải quyết bài toán thiếu kết nối giữa các thành phần trong một dự án phần mềm: khi đọc một lời gọi hàm, lập trình viên muốn biết định nghĩa của hàm đó nằm ở đâu; khi sửa một class, họ muốn biết những class nào phụ thuộc vào nó. GitNexus giải quyết bài toán này bằng cách xây dựng một đồ thị toàn cục, trong đó mỗi symbol là một nút và mỗi quan hệ là một cạnh.

GitNexus trích xuất nhiều loại symbol từ mã nguồn: hàm (function/method), lớp (class/interface), biến (variable/parameter), module (file/package), kiểu dữ liệu (type/alias) và hằng số (constant). Các loại quan hệ được GitNexus ghi nhận bao gồm: lời gọi hàm (calls), kế thừa (extends/implements), khai báo (declares), import (imports), gán giá trị (assigns) và truy cập thuộc tính (accesses). Mỗi quan hệ là một cạnh có hướng kèm thông tin về vị trí xuất hiện trong mã nguồn (tệp, dòng, cột), cho phép truy xuất nguồn gốc của từng kết nối.

Quá trình xây dựng Knowledge Graph của GitNexus gồm ba bước:

- **Phân tích cú pháp**: Quét toàn bộ cây thư mục dự án, phân tích từng tệp mã nguồn thành AST và trích xuất danh sách các symbol cùng vị trí của chúng. Mỗi symbol được gán một định danh duy nhất dựa trên tên, vị trí và phạm vi (scope) mà nó thuộc về. GitNexus hỗ trợ đa ngôn ngữ, sử dụng các parser riêng cho từng ngôn ngữ để tạo AST tương ứng.
- **Xây dựng đồ thị**: Duyệt qua các AST để xác định mối quan hệ giữa các symbol. Quá trình này bao gồm giải quyết tham chiếu (reference resolution): khi gặp lời gọi hàm A(), GitNexus phải xác định A là hàm nào trong đồ thị dựa trên tên, số tham số và phạm vi hiện tại. Đây là bước phức tạp nhất vì trong các ngôn ngữ động như JavaScript hay Python, cùng một tên hàm có thể trỏ đến nhiều định nghĩa khác nhau tùy vào ngữ cảnh.
- **Tối ưu truy vấn và suy luận**: Đánh chỉ mục đồ thị để hỗ trợ các truy vấn nhanh. GitNexus cũng thực hiện suy luận bắc cầu (transitive closure): nếu A gọi B và B gọi C, hệ thống có thể suy luận rằng A gián tiếp gọi C, từ đó đánh giá được phạm vi ảnh hưởng sâu hơn khi một hàm bị thay đổi.

Sau khi xây dựng xong, GitNexus hỗ trợ nhiều loại truy vấn phục vụ các mục đích phân tích khác nhau:

- **Truy vấn caller/callee**: Tìm tất cả nơi gọi đến một hàm (upstream) hoặc tất cả hàm được một hàm gọi đến (downstream). Đây là dạng truy vấn cơ bản nhất, phục vụ cho phân tích tác động khi thay đổi code.
- **Phân tích tác động (impact analysis)**: Kết hợp truy vấn caller đệ quy ở nhiều cấp độ để xác định phạm vi ảnh hưởng khi sửa một symbol. Độ sâu của phân tích có thể được cấu hình tùy theo nhu cầu.
- **Tra cứu ngữ cảnh (context lookup)**: Với một vị trí bất kỳ trong mã nguồn (tệp, dòng), GitNexus trả về symbol tương ứng và toàn bộ đồ thị con xung quanh nó, giúp lập trình viên hiểu ngữ cảnh mà không cần đọc toàn bộ tệp.
- **Dò luồng thực thi (execution flow)**: Tái dựng một đường đi thực thi cụ thể trong chương trình dựa trên đồ thị caller-callee, hỗ trợ gỡ lỗi và xác minh luồng logic.

GitNexus hỗ trợ cả hai hướng truy vấn: upstream (tìm tất cả những nơi gọi đến một symbol) và downstream (tìm tất cả những symbol được một symbol gọi đến), phục vụ cho cả phân tích tác động và gỡ lỗi. Kết quả của các truy vấn này là một biểu diễn có cấu trúc về kiến trúc tổng thể của dự án, cho phép trả lời các câu hỏi như: hàm này được gọi ở đâu, lớp này phụ thuộc vào những lớp nào, hay thay đổi ở file này ảnh hưởng đến những phần nào của hệ thống.

### 2.4.3. Graph RAG — Kết nối Knowledge Graph với LLM

Graph RAG (Graph-based Retrieval-Augmented Generation) là một phương pháp tăng cường khả năng của Mô hình ngôn ngữ lớn (LLM) bằng cách truy xuất thông tin từ đồ thị tri thức thay vì sử dụng vector embeddings truyền thống. Khác với Standard RAG chia nhỏ văn bản thành các đoạn (chunks), nhúng thành vector và tìm kiếm theo độ tương tự, Graph RAG tận dụng các cạnh có sẵn trong đồ thị để duyệt qua các mối quan hệ có cấu trúc, cho phép trả lời các câu hỏi mang tính kiến trúc như "ai gọi hàm này?" hay "thay đổi ở class này ảnh hưởng đến module nào?".

GitNexus tích hợp cơ chế Graph RAG thông qua việc xây dựng Knowledge Graph ở thời điểm chỉ mục (index time) và phục vụ truy vấn ở thời điểm suy luận (inference time). Khi hệ thống cần phân tích một phát hiện lỗi (finding), quy trình Graph RAG diễn ra tuần tự qua ba bước sau:

Truy vấn đồ thị: Hệ thống gửi truy vấn đến phân hệ GitNexus để lấy ngữ cảnh cấu trúc liên quan đến vị trí đang xem xét, bao gồm: định danh (symbol) tại vị trí đó, các hàm gọi tới (caller), hàm được gọi (callee), thư viện phụ thuộc (dependency) và các luồng thực thi liên quan.

Tổng hợp ngữ cảnh: Kết quả trích xuất từ đồ thị (danh sách các symbols, mối quan hệ, đường dẫn tệp) được tự động định dạng thành văn bản có cấu trúc, sau đó bổ sung vào gói chỉ dẫn (prompt) của LLM cùng với nội dung finding gốc.

Sinh đề xuất: LLM tiếp nhận đồng thời cả đoạn mã vi phạm lẫn bức tranh kiến trúc tổng thể xung quanh nó, từ đó đưa ra đề xuất chính xác hơn, tránh việc đưa ra các bản sửa lỗi cục bộ gây hỏng hoặc xung đột với các thành phần phụ thuộc khác.

Ưu điểm của Graph RAG so với Standard RAG trong ngữ cảnh rà soát mã nguồn (code review) thể hiện rõ rệt qua ba điểm sau:

Độ chính xác về mối quan hệ: Đồ thị cung cấp thông tin chính xác tuyệt đối về mối quan hệ giữa các symbols thay vì phải suy luận cảm tính từ độ tương tự vector, một kỹ thuật vốn không đảm bảo tính chính xác đối với các truy vấn cấu trúc logic.

Khả năng truy xuất sâu (Deep Retrieval): Một truy vấn đồ thị duy nhất có thể trả về toàn bộ chuỗi lời gọi (call chain) sâu nhiều cấp, trong khi Standard RAG thường cần rất nhiều vòng truy xuất (multi-hop retrieval) lặp đi lặp lại để ghép nối thông tin văn bản.

Tính xác thực dựa trên thực tế: Các mối quan hệ trong đồ thị là kết quả tường minh của quá trình phân tích tĩnh (static analysis) dựa trên cấu trúc mã nguồn thực tế, hoàn toàn không bị ảnh hưởng bởi nhiễu từ cách đặt tên biến hay khoảng cách ngữ nghĩa bề mặt văn bản.

Về tổng thể, Graph RAG đóng vai trò là cầu nối cốt lõi giữa Knowledge Graph (cung cấp ngữ cảnh cấu trúc) và LLM (cung cấp khả năng suy luận và sinh đề xuất), cho phép hệ thống kết hợp sức mạnh của cả hai: độ chính xác về mặt cấu trúc từ phân tích tĩnh và khả năng hiểu ngữ nghĩa vượt trội từ mô hình ngôn ngữ lớn.

## 2.5. Mô hình ngôn ngữ lớn trong rà soát mã nguồn

Mô hình ngôn ngữ lớn (Large Language Models, LLMs) là một lớp mô hình học sâu dựa trên kiến trúc Transformer, có khả năng hiểu và sinh văn bản tự nhiên nhờ quá trình tiền huấn luyện trên quy mô hàng nghìn tỷ token. Khác biệt cốt lõi so với các mô hình học máy truyền thống là khả năng học trong ngữ cảnh (in-context learning): mô hình có thể thực thi một tác vụ mới chỉ qua vài ví dụ trong prompt mà không cần huấn luyện lại. Trong rà soát mã nguồn, đặc tính này cho phép mô hình thích nghi với quy ước riêng của từng dự án nếu prompt được thiết kế phù hợp.

### 2.5.1. Cửa sổ ngữ cảnh (Context Window) và tác động đến phân tích mã nguồn

Cửa sổ ngữ cảnh (context window) là số token tối đa mô hình có thể xử lý trong một lần — đến từ giới hạn của cơ chế Attention: khi token tăng, chi phí tính toán tăng theo bình phương, buộc phải đánh đổi giữa độ dài ngữ cảnh và hiệu năng.

Đến 2025–2026, con số này đã tăng vọt. Claude Opus 4.8 và GPT-5.5 đạt 1 triệu token, Llama 4 Scout lên đến 10 triệu. Nhưng hiệu suất thực tế vẫn giảm dần khi tiến gần giới hạn — mô hình càng phải nhớ nhiều, độ chính xác càng xuống. Với code review, nạp càng nhiều tệp cùng lúc (import, khai báo kiểu, comment) thì nguy cơ bỏ sót liên kết logic quan trọng càng cao.

### 2.5.2. Các hướng tiếp cận LLM trong rà soát mã nguồn

Có ba hướng chính khi áp dụng LLM vào rà soát mã nguồn:

- **LLM như công cụ phân tích hỗ trợ**: Mô hình phân tích từng phát hiện lỗi dựa trên ngữ cảnh cấu trúc có sẵn (Knowledge Graph), đóng vai trò kiểm định và đề xuất giải pháp, không tự hành.
- **LLM như tác nhân tự động**: Mô hình tự truy cập dự án, quyết định tệp cần kiểm tra, vận hành công cụ và tổng hợp báo cáo. SWE-Agent, Devin, OpenHands và Claude Code đại diện cho hướng này.
- **Kiến trúc đa tác nhân**: Phối hợp nhiều LLM với vai trò khác nhau, phản biện lẫn nhau. CodeReviewer và các hệ thống Multi-Agent gần đây cho thấy chất lượng vượt trội so với đơn tác nhân.

### 2.5.3. Kỹ thuật prompt engineering cho code review

Prompt engineering là cách thiết kế câu lệnh đầu vào để điều khiển hành vi của LLM. Trong code review, một prompt chuẩn thường gồm bốn thành phần:

- **Vai trò của mô hình (system prompt)**: xác định mô hình đóng vai trò gì, ví dụ như một chuyên gia review bảo mật.
- **Mã vi phạm kèm ngữ cảnh**: cung cấp đoạn mã cần phân tích cùng các thông tin liên quan (caller, callee).
- **Bộ quy tắc đối chiếu**: các luật cần tuân thủ, thường lấy từ công cụ phân tích tĩnh.
- **Định dạng đầu ra**: chỉ rõ cấu trúc phản hồi mong muốn để dễ dàng bóc tách tự động.

Vấn đề là LLM thường trả lời vội vàng hoặc suy luận thiếu căn cứ. Để khắc phục, nhiều kỹ thuật đã được phát triển:

- **Chain-of-thought**: yêu cầu mô hình giải thích từng bước trước khi đưa ra kết luận, giống như một lập trình viên nói ra suy nghĩ của mình khi đọc code.
- **Self-consistency**: thay vì tin một câu trả lời duy nhất, cho mô hình suy luận nhiều lần rồi chọn kết quả xuất hiện nhiều nhất — như hỏi ý kiến nhiều người rồi lấy đồng thuận.
- **ReAct**: kết hợp suy luận với hành động — mô hình không chỉ nghĩ mà còn có thể chủ động gọi công cụ để kiểm tra giả thuyết.
- **Tree-of-thoughts**: thay vì suy luận theo một đường thẳng, mô hình được phép rẽ nhánh để khám phá nhiều hướng giải thích khác nhau.

Một xu hướng gần đây cũng đáng chú ý là dịch chuyển từ prompt engineering thủ công sang context engineering có hệ thống — tức là tập trung vào việc nạp đúng dữ liệu và chỉ dẫn vào cửa sổ ngữ cảnh của LLM, thay vì chỉ phụ thuộc vào cách viết câu lệnh.

### 2.5.4. Giới hạn kỹ thuật và tiêu chí lựa chọn mô hình

Khi triển khai LLM vào bài toán đánh giá mã nguồn thực tế, ba giới hạn kỹ thuật sau cần phải được đánh giá nghiêm túc:

- **Hiện tượng ảo tưởng (Hallucination)**: Mô hình có xu hướng tạo ra các lập luận hoặc đoạn mã sửa đổi trông có vẻ hợp lý về mặt cú pháp nhưng lại sai sót về mặt logic kỹ thuật, đòi hỏi hệ thống phải tích hợp thêm các bước kiểm định tĩnh tự động sau khi áp dụng bản sửa.
- **Suy giảm độ chính xác ở ngưỡng giới hạn**: Khi prompt gần đầy cửa sổ ngữ cảnh, chất lượng suy luận của mô hình có xu hướng giảm dần — đây vẫn là bài toán chưa có giải pháp triệt để, đặc biệt với các kho mã nguồn lớn.
- **Chi phí vận hành hạ tầng**: Việc quét và phân tích trên quy mô lớn tiêu tốn chi phí gọi API hoặc tài nguyên phần cứng đáng kể cho mỗi lượt chạy toàn bộ.

Về mặt công nghệ, việc lựa chọn mô hình dựa trên sự đánh đổi rõ rệt giữa hai nhóm:

Bảng 2.2. So sánh mô hình thương mại và mô hình cộng đồng

| Tiêu chí | Mô hình thương mại | Mô hình cộng đồng |
|---|---|---|
| Chất lượng | Phân tích logic tốt, suy luận sâu | Thấp hơn ở lỗi phức tạp |
| Chi phí | Cao, tính theo token | Thấp hơn, có nhiều tùy chọn |
| Triển khai | Chỉ qua API cloud | API cloud hoặc tự host nội bộ |
| Bảo mật | Dữ liệu gửi qua bên thứ ba | Kiểm soát được nếu tự host |

## 2.6. Tổng kết chương

Chương này đã trình bày ba nhóm cơ sở lý thuyết nền tảng cho bài toán rà soát mã nguồn tự động. ISO/IEC 25010 cung cấp khung đánh giá chất lượng phần mềm có cấu trúc, làm cơ sở để xác định các tiêu chí cần kiểm định. Phân tích tĩnh (Opengrep) và biểu diễn tri thức đồ thị (Knowledge Graph / GitNexus) là hai công nghệ bổ trợ cho nhau: phân tích tĩnh phát hiện vi phạm quy tắc với độ chính xác cao, đồ thị tri thức cung cấp bối cảnh cấu trúc để hiểu rõ tác động lan truyền của lỗi. LLMs, với khả năng học trong ngữ cảnh và các kỹ thuật prompt engineering tiên tiến, đóng vai trò phân tích và đề xuất hướng khắc phục dựa trên ngữ cảnh đã được chuẩn bị sẵn. Sự kết hợp giữa ba công nghệ này tạo thành nền tảng lý thuyết cho các giải pháp AI-assisted code review hiện đại.
