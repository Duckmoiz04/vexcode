# Ask AI Streaming — Technical Plan

**Date**: 24-06-26
**Complexity**: Simple (1 tính năng streaming, Node.js CLI/Express Server)
**Status**: ✅ VERIFIED
**Author**: Antigravity
**Project**: VexCode — AI Code Review (DATN)

## Overview

Plan này hướng dẫn chi tiết việc thiết lập tính năng streaming tin nhắn từ AI gửi đến trong Ask AI cho tất cả các AI Providers được hỗ trợ bao gồm OpenAI, Anthropic, Google, 9router, và Nvidia. Ngoài ra, plan cũng giải quyết các lỗi validation API chat hiện tại gây fail 3 tests tích hợp.

---

## Quick Links
- [Goals and Success Metrics](#goals-and-success-metrics)
- [Phase Completion Rules](#phase-completion-rules)
- [Proposed Changes](#proposed-changes)
- [Acceptance Criteria](#acceptance-criteria)
- [Blast Radius](#blast-radius)
- [Verification Evidence](#verification-evidence)
- [Resume and Execution Handoff](#resume-and-execution-handoff)

---

## Goals and Success Metrics

### Business/UX Goals
- **Real-time UX**: Người dùng nhìn thấy tin nhắn phản hồi từ AI gõ chữ từng phần (streaming) thay vì phải đợi toàn bộ tin nhắn được sinh xong, tăng trải nghiệm tương tác trực quan.
- **Provider Parity**: Hỗ trợ streaming cho toàn bộ các provider: OpenAI, Anthropic, Google, 9router, Nvidia.
- **Robust API**: Khắc phục lỗi thiếu validation baseUrl, model, apiKey khiến server trả về 500 thay vì 400.

### Success Metrics
- 100% tests của `packages/cli` pass (bao gồm cả các test cũ bị fail và các test streaming mới).
- Ask AI hoạt động mượt mà với hiệu ứng gõ chữ (typing effect) cho cả OpenAI, Anthropic và Google.
- Phản hồi từ Express API qua `/api/chat` tuân thủ chuẩn SSE: `data: {"content": "..."}` và kết thúc bằng `data: [DONE]`.

---

## Phase Completion Rules

A phase is NOT complete until:
1. **Integration Test** — Chạy thử nghiệm Express server và client React qua stream SSE hoạt động.
2. **Manual Test** — Mở Web UI, hỏi đáp trong Ask AI và thấy text được hiển thị dần dần.
3. **Data Verification** — Response headers có `Content-Type: text/event-stream` và luồng dữ liệu truyền tải theo từng block/delta.
4. **Error Handling** — Nếu API key hoặc URL cấu hình sai, Express server gửi lỗi về SSE client dưới dạng `data: {"error": "..."}` và đóng stream sạch sẽ.
5. **User Confirmation** — User verifies it works.

Status meanings:
- ⏳ PLANNED — Not started
- 🔨 CODE DONE — Written but not E2E tested
- 🧪 TESTING — Currently being tested
- ✅ VERIFIED — Tested AND confirmed working
- 🚧 BLOCKED — Has issues

---

## Proposed Changes

### 1. Packages / CLI

#### [MODIFY] [chat.js](file:///d:/DATN2/packages/cli/src/routes/chat.js)
- Thêm validation cho resolved parameters:
  - Nếu `!resolved.baseUrl` -> return 400 "Missing required parameter: baseUrl"
  - Nếu `!resolved.model` -> return 400 "Missing required parameter: model"
  - Nếu `!resolved.apiKey && provider !== '9router'` -> return 400 "Missing required parameter: apiKey"
- Chỉnh sửa logic streaming:
  - Bỏ điều kiện loại trừ `provider !== 'anthropic' && provider !== 'google'`.
  - Phân loại `sseUrl`, `sseHeaders`, và `ssePayload` cho từng provider:
    - **Anthropic**: endpoint `/v1/messages`, headers custom (`x-api-key`, `anthropic-version`), payload custom (`system`, `messages`, `stream: true`).
    - **Google**: endpoint `/v1beta/models/${chatModel}:streamGenerateContent?key=${resolvedKey}&alt=sse`, payload custom (`contents`, `generationConfig`).
    - **OpenAI / 9router / Nvidia**: giữ nguyên định dạng chat completions tương thích OpenAI.
  - Sử dụng một luồng đọc response stream chung bằng `fetch` và `response.body.getReader()`.
  - Phân tích và chuyển đổi data chunk của mỗi provider sang định dạng chuẩn của client `{ content: delta }`:
    - **Anthropic**: lọc sự kiện `content_block_delta` lấy `delta.text`.
    - **Google**: trích xuất từ `candidates[0].content.parts[0].text`.
    - **OpenAI-compatible**: trích xuất từ `choices[0].delta.content`.

#### [MODIFY] [server.test.js](file:///d:/DATN2/packages/cli/src/__tests/server.test.js)
- Bổ sung unit/integration tests cho tính năng streaming của `/api/chat`:
  - Test stream thành công với OpenAI.
  - Test stream thành công với Anthropic.
  - Test stream thành công với Google (Gemini).
  - Test stream khi provider trả về lỗi.

---

## Blast Radius

- **Chat Panel**: Sự thay đổi này tập trung ở backend route `/api/chat` và bổ trợ cho hook client `useChat.ts` đã có sẵn. Rủi ro hồi quy (regression) cực kỳ thấp do các API không bị sửa đổi phương thức POST hay kiểu payload đầu vào từ frontend.
- **Error Banner**: Trường hợp lỗi kết nối hoặc API lỗi trong lúc stream, client vẫn nhận diện đúng thông qua message error được đóng gói.

---

## Verification Plan

### Automated Tests
- Chạy `npm test` trong `packages/cli` để kiểm thử toàn bộ REST endpoints của server.
- Lệnh chạy:
  ```bash
  cd packages/cli
  npm test
  ```

### Manual Verification
- Chạy Express server và React app song song ở local.
- Truy cập vào Issue bất kỳ, bấm "Ask AI Assistant" và nhập tin nhắn chat.
- Quan sát chữ hiển thị từng từ (streaming) thay vì đợi vài giây rồi hiển thị hết.
- Chạy thử với mock-ai và real-ai (nếu có cấu hình).

---

## Resume and Execution Handoff

Sau khi user approve, ta sẽ:
1. Sửa file `packages/cli/src/routes/chat.js` để thêm validation và logic streaming cho Anthropic/Google.
2. Sửa file `packages/cli/src/__tests__/server.test.js` để viết thêm test cases cho streaming.
3. Chạy `npm test` để kiểm tra.
4. Xác minh lại UI.
