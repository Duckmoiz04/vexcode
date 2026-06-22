Dưới đây là tổng hợp chi tiết về yêu cầu chức năng (Functional Requirements) và yêu cầu phi chức năng (Non-Functional Requirements) dựa trên các tài liệu bạn đã cung cấp:

### 1. Yêu cầu chức năng (Functional Requirements)

Yêu cầu chức năng mô tả chi tiết **HỆ THỐNG PHẢI LÀM GÌ**. Chúng xác định các hành động, hành vi, tương tác cụ thể của người dùng và hệ thống, cũng như cách dữ liệu được xử lý [1-4].

**Cấu trúc của một yêu cầu chức năng chuẩn**
Một yêu cầu chức năng có thể kiểm chứng được thường bao gồm 4 yếu tố cốt lõi [5, 6]:
*   **Mã định danh (ID):** Mã duy nhất để theo dõi và truy vết (ví dụ: FR-001).
*   **Mô tả:** Diễn đạt rõ ràng, ngắn gọn tính năng hệ thống cần có.
*   **Mức độ ưu tiên:** Xếp hạng tầm quan trọng (Must - Phải có, Should - Nên có, Could - Có thể có).
*   **Tiêu chí chấp nhận (Acceptance Criterion):** Cột mốc hoặc thông số đo lường khách quan để xác nhận yêu cầu đã được đáp ứng hoàn toàn.

Ngoài ra, ở cấp độ chi tiết, yêu cầu chức năng có thể được mô tả thông qua **Đặc tả Use Case** bao gồm: ID, tên, mô tả các bước thực hiện, điều kiện tiên quyết, luồng kịch bản chính/thay thế, và kết quả mong đợi [7].

**Cách viết yêu cầu chức năng hiệu quả**
*   **Sự nhất quán của động từ khiếm khuyết:** Sử dụng "shall" (phải) hoặc "must" để chỉ yêu cầu bắt buộc, "should" (nên) cho các khuyến nghị, và "will" cho hành vi dự kiến [8-10].
*   **Mỗi yêu cầu chỉ chứa một ý duy nhất:** Tránh gộp nhiều yêu cầu phức tạp vào một câu (hạn chế dùng từ "và"). Nếu có nhiều điều kiện, hãy tách chúng thành các yêu cầu riêng biệt với ID riêng [11, 12].
*   **Rõ ràng, không mơ hồ và có thể kiểm thử (Testable):** Viết với tiêu chí cụ thể để đội QA có thể tạo kịch bản kiểm thử. Thay vì viết "hệ thống xử lý nhanh", hãy viết "hệ thống trả kết quả trong vòng 0.5 giây" [13-15].
*   **Tách biệt với yêu cầu phi chức năng:** Không gộp các giới hạn về hiệu năng, bảo mật vào cùng câu mô tả chức năng [16, 17].

**Các phương pháp/tiêu chuẩn viết phổ biến**
*   **Phương pháp EARS (Easy Approach to Requirements Syntax):** Sử dụng các mẫu câu có cấu trúc để hạn chế sự mơ hồ [18]:
    *   *Ubiquitous (Mọi lúc):* Tính năng luôn hoạt động. Mẫu: *The <system> shall...* [19, 20].
    *   *State-driven (Theo trạng thái):* Mẫu: *WHILE <state>, the <system> shall...* [20].
    *   *Event-driven (Theo sự kiện):* Kích hoạt bởi một sự kiện. Mẫu: *WHEN <event>, the <system> shall...* [21].
    *   *Optional feature (Tính năng tùy chọn):* Mẫu: *WHERE <feature>, the <system> shall...* [21, 22].
    *   *Unwanted behavior (Hành vi không mong muốn):* Để xử lý lỗi. Mẫu: *IF <trigger>, THEN the <system> shall...* [22, 23].
    *   *Complex (Phức hợp):* Kết hợp nhiều điều kiện trên [23].
*   **Chuẩn IEEE 830-1998:** Tiêu chuẩn quốc tế cho tài liệu Đặc tả Yêu cầu Phần mềm (SRS). Tiêu chuẩn này quy định một SRS tốt phải đáp ứng các đặc tính: chính xác, không mơ hồ, đầy đủ, nhất quán, có xếp hạng ưu tiên, có thể kiểm thử, có thể sửa đổi và có thể truy xuất nguồn gốc [24]. IEEE 830 cung cấp các cấu trúc cụ thể để nhóm yêu cầu chức năng (ví dụ: chia theo chế độ hệ thống, theo lớp người dùng, đối tượng, tính năng, hoặc phân cấp chức năng) [25-30].

---

### 2. Yêu cầu phi chức năng (Non-Functional Requirements - NFR)

Yêu cầu phi chức năng mô tả **HỆ THỐNG HOẠT ĐỘNG NHƯ THẾ NÀO**. Chúng xác định các thuộc tính chất lượng, tiêu chuẩn và những ràng buộc về mặt thiết kế hay kiến trúc mà hệ thống phải tuân thủ [31-33].

**Các loại yêu cầu phi chức năng phổ biến**
*   **Hiệu suất (Performance):** Tốc độ phản hồi, thời gian tải trang, khả năng xử lý đồng thời [34, 35].
*   **Khả năng mở rộng (Scalability):** Hệ thống có thể mở rộng dữ liệu và lượng người dùng mà không giảm hiệu suất [34, 35].
*   **Độ tin cậy & Tính sẵn sàng (Reliability & Availability):** Hệ thống phải hoạt động ổn định, ví dụ đảm bảo thời gian hoạt động (uptime) 99.9% [34-36].
*   **Khả năng sử dụng (Usability):** Tính thân thiện với người dùng, dễ tiếp cận, thiết kế giao diện [34, 35].
*   **Bảo mật (Security):** Mã hóa, quản lý truy cập người dùng, chống rò rỉ dữ liệu [34, 35].

**Cách xác định yêu cầu phi chức năng**
Khác với yêu cầu chức năng thường xuất phát từ tương tác người dùng, yêu cầu phi chức năng được xác định dựa trên:
*   Các ràng buộc từ quy định, pháp lý (như GDPR) [37, 38].
*   Giới hạn từ phần cứng, tương thích thiết bị, hay ngôn ngữ kiến trúc [38-41].
*   Mục tiêu kinh doanh mang tính chất lượng (để đảm bảo khả năng giữ chân người dùng hoặc có lợi thế cạnh tranh, ví dụ như tốc độ cực nhanh) [38, 42].
*   Mức độ đo lường được bằng các bài kiểm tra riêng biệt (thử nghiệm tải, thử nghiệm thâm nhập bảo mật, thử nghiệm độ khả dụng UX) thay vì chỉ kiểm thử kết quả đầu ra [4, 43, 44].

**Mối liên hệ giữa Yêu cầu phi chức năng và tiêu chuẩn ISO/IEC 25010**
ISO/IEC 25010 (Hệ thống và Chất lượng Phần mềm) cung cấp một mô hình chất lượng sản phẩm chuẩn mực, chính là **bộ khung phân loại cốt lõi cho các yêu cầu phi chức năng** [45]. Mô hình này định nghĩa 9 đặc tính [46]:
1.  **Sự phù hợp chức năng (Functional Suitability)**
2.  **Hiệu suất (Performance Efficiency)**
3.  **Tính tương thích (Compatibility)**
4.  **Khả năng tương tác / Sử dụng (Interaction Capability)**
5.  **Độ tin cậy (Reliability)**
6.  **Bảo mật (Security)**
7.  **Khả năng bảo trì (Maintainability)**
8.  **Tính linh hoạt / Tính di động (Flexibility)**
9.  **An toàn (Safety)**

*Mối liên hệ:* ISO 25010 đóng vai trò như một danh sách kiểm tra (checklist) toàn diện. Khi phân tích và soạn thảo tài liệu yêu cầu (như SRS), các nhà phân tích nghiệp vụ hoặc kỹ sư phần mềm sẽ đối chiếu với 9 đặc tính của ISO 25010 để đảm bảo họ không bỏ sót bất kỳ một **yêu cầu phi chức năng / thuộc tính chất lượng** thiết yếu nào của hệ thống [45, 46].
