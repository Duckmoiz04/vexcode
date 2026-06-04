# Báo cáo Phân tích Hệ thống Bộ lọc của SonarQube & Đề xuất Tích hợp

Báo cáo này phân tích hệ thống bộ lọc hiện có trên giao diện danh sách lỗi của SonarQube (qua dự án `QuocVietDo04_OpenHands` trên SonarCloud), từ đó lựa chọn và tối ưu hóa các bộ lọc thiết yếu nhất cho công cụ quét mã nguồn tĩnh cục bộ **AI Code Review**.

---

## 1. Cấu trúc bộ lọc hiện có của SonarQube

Trên trang Issues của SonarQube, các bộ lọc được tổ chức trong một cột Sidebar riêng biệt rộng rãi và hoạt động theo mô hình lọc kết hợp (faceted search):

*   **Status (Trạng thái vòng đời lỗi):**
    *   `Open` (Lỗi đang mở - chưa xử lý)
    *   `Confirmed` (Lỗi đã xác nhận)
    *   `False Positive` (Báo cáo sai)
    *   `Accepted` (Chấp nhận rủi ro)
    *   `Fixed` (Đã sửa lỗi)
*   **Resolution (Kết quả xử lý):**
    *   `Unresolved` (Chưa giải quyết)
    *   `Fixed` (Đã sửa)
    *   `False Positive` (Phát hiện sai)
    *   `WontFix` (Không sửa)
    *   `Removed` (Đã xóa file/đoạn code chứa lỗi)
*   **Software Quality (Chất lượng phần mềm - Clean Code Taxonomy):**
    *   `Security` (An ninh bảo mật)
    *   `Reliability` (Độ tin cậy/Lỗi logic)
    *   `Maintainability` (Độ dễ bảo trì)
*   **Severity (Mức độ nghiêm trọng):**
    *   `Blocker` (Lỗi chặn dòng chảy)
    *   `High` (Nghiêm trọng cao)
    *   `Medium` (Nghiêm trọng trung bình)
    *   `Low` (Nghiêm trọng thấp)
    *   `Info` (Chỉ hiển thị thông tin)
*   **Language (Ngôn ngữ lập trình):**
    *   Phát hiện động các ngôn ngữ có lỗi trong dự án (ví dụ: `TypeScript`, `Python`, `Shell`, `JavaScript`, `CSS`...).
*   **Location (Vị trí lỗi):**
    *   Lọc theo thư mục (`Directory`) hoặc tệp tin cụ thể (`File`).
*   **Rule (Mã luật quét):**
    *   Lọc theo mã quy tắc của Sonar (ví dụ: `javascript:S1533` - các biến Props React phải là Read-only).
*   **Attribution (Quyền sở hữu):**
    *   `Assignee` (Người được giao xử lý) và `Author` (Tác giả commit đoạn code lỗi qua Git Blame).
*   **Time (Thời gian phát hiện):**
    *   `Creation Date` (Ngày phát hiện lỗi) hoặc chia theo `Overall Code` (Lỗi cũ) và `New Code` (Lỗi mới sinh ra trong lần thay đổi này).

---

## 2. Lựa chọn bộ lọc cơ bản cho Dự án AI Code Review

Do tính chất của công cụ **AI Code Review** là bộ công cụ quét tĩnh local phục vụ trực tiếp quá trình lập trình cá nhân hoặc đội nhóm nhỏ, các bộ lọc được phân cấp ưu tiên như sau:

### Nhóm A: Bộ lọc cốt lõi (Essential Filters) - Cần triển khai
1.  **Keyword Search (Tìm kiếm):** Cho phép tìm theo tên tệp tin, Rule ID, hoặc nội dung mô tả lỗi. *(Đã có)*
2.  **Severity (Mức độ nghiêm trọng):** Phân chia thành 3 mức `Error` (🔴 Lỗi nghiêm trọng), `Warning` (🟡 Cảnh báo), `Info` (🔵 Thông tin). *(Đã có)*
3.  **Category (Phân loại):** Nhóm lỗi `Security`, `Quality`, `Maintainability`, `Architecture` phù hợp cho lập trình viên. *(Đã có)*
4.  **Fix Status / Resolution (Trạng thái sửa lỗi):** Lọc giữa lỗi chưa sửa (`Pending`) và lỗi đã áp dụng bản sửa AI (`Applied`). *(Cần triển khai)*
5.  **Language (Ngôn ngữ lập trình):** Cho phép chọn lọc nhanh các lỗi thuộc về một ngôn ngữ cụ thể (ví dụ: `Python`, `JavaScript`, `Shell`...). *(Cần triển khai)*

### Nhóm B: Bộ lọc nâng cao (Advanced Filters) - Tránh nhồi nhét
*   **Lọc theo File/Thư mục:** Chúng ta đã tích hợp cây thư mục tương tác ở Sidebar. Khi click vào file nào, danh sách tự động lọc chỉ hiển thị lỗi file đó. Thiết kế này gọn gàng và ưu việt hơn dropdown tìm kiếm file.
*   **Lọc theo Assignee/Author:** Không cần thiết cho máy trạm cá nhân local.

---

## 3. Kế hoạch triển khai bộ lọc Trạng thái & Ngôn ngữ

Chúng ta sẽ nâng cấp hệ thống bộ lọc tại component `Sidebar.tsx` và nâng trạng thái (State) lên `App.tsx` để đồng bộ hóa giao diện:

### A. Tích hợp bộ lọc Trạng thái (Fix Status Filter)
*   **Tùy chọn:**
    *   `all`: Mọi lỗi (Cả Pending và Applied)
    *   `pending`: Chỉ lỗi chưa sửa (Mặc định khi mở giao diện để tập trung giải quyết)
    *   `applied`: Chỉ lỗi đã sửa (Đã bấm Apply Fix)
*   **Nơi hiển thị:** Sidebar và trang danh sách tất cả lỗi chính.

### B. Tích hợp bộ lọc Ngôn ngữ (Language Filter)
*   **Cơ chế:** Tự động duyệt qua toàn bộ danh sách `findings` để phân tích các phần mở rộng (extensions) của tệp tin. Ánh xạ phần mở rộng thành tên ngôn ngữ thân thiện:
    *   `.py` $\rightarrow$ Python
    *   `.js`, `.jsx` $\rightarrow$ JavaScript
    *   `.ts`, `.tsx`, `.d.ts` $\rightarrow$ TypeScript
    *   `.sh`, `.bash` $\rightarrow$ Shell Script
    *   `.css` $\rightarrow$ CSS
    *   Các đuôi khác $\rightarrow$ Khác (Other)
*   **Dropdown:** Chỉ hiển thị những ngôn ngữ thực sự xuất hiện lỗi trong báo cáo hiện tại.
