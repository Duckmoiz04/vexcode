# Fix Random Port Jump Issue (5174/4747)

**Status:** Active  
**Created:** 2026-06-28  
**Type:** Bug Fix  
**Feature:** vexcode  
**Priority:** P0  

---

## Problem Statement

When navigating from Issues page → Overview page, the app randomly jumps to different ports (5174, 4747) instead of staying on the correct ports (3000 for backend, 5173 for dev server).

**Root Causes:**
1. EventSource (SSE) streams have no error handlers with reconnection logic - browser auto-reconnect can pick different port
2. No port tracking on app initialization - frontend doesn't know which port it connected to
3. Vite proxy config only covers `/api/*` paths - SSE streams bypass proxy via query param auth
4. Browser cache/relative paths cause inconsistent port resolution
5. No backend port discovery endpoint to validate connection
6. Direct download links bypass proxy consistency

---

## Goals

✅ Prevent EventSource from auto-reconnecting to wrong port  
✅ Track backend port in sessionStorage for consistency  
✅ Add port validation before API calls  
✅ Expand Vite proxy to cover SSE endpoints  
✅ (Stretch) Add backend `/api/config/port` endpoint for future use  

---

## Solution Approach

**Client-Side Port Tracking + EventSource Reconnection Guard**

1. Capture backend port on initial API key fetch
2. Store in sessionStorage for persistence across navigation
3. Add EventSource reconnection logic with port validation
4. Validate all API calls against tracked port
5. Expand Vite proxy configuration

---

## Implementation Checklist

### Phase 1: Port Tracking (P0)

- [ ] **packages/web/src/utils/apiClient.ts**
  - Add `getBackendPort()` function to extract port from initial connection
  - Add `setBackendPort(port: number)` to store in sessionStorage
  - Add `validatePortConsistency()` before each API call
  - Capture port on first `/api/auth/key` response

- [ ] **packages/web/src/App.tsx**
  - Call `getBackendPort()` on app initialization (useEffect)
  - Store port in sessionStorage on mount

### Phase 2: EventSource Reconnection Fix (P0)

- [ ] **packages/web/src/hooks/useScan.ts**
  - Add port validation before creating EventSource
  - Enhance `eventSource.onerror` handler:
    - Log the error with port info
    - Check if port changed
    - Prevent auto-reconnect if port mismatch
    - Show user-friendly error toast
  - Add manual reconnection logic with exponential backoff
  - Add `reconnectAttempts` state (max 3 attempts)
  - Apply same fix to both `/api/scan/stream` and `/api/re-resolve/stream`

### Phase 3: Vite Proxy Expansion (P1)

- [ ] **packages/web/vite.config.ts**
  - Expand proxy config to cover:
    - `/api/scan/stream`
    - `/api/re-resolve/stream`
  - Add `ws: true` for WebSocket/SSE support
  - Test SSE still works with query param auth

### Phase 4: Download Links Fix (P2)

- [ ] **packages/web/src/pages/ActivityPage.tsx**
  - Convert direct `<a href="/api/report/...">` to fetch + blob download
  - Use `apiFetch()` to ensure Bearer auth and proxy consistency
  - Add loading state during download
  - Handle download errors gracefully

### Phase 5: Backend Port Endpoint (P2 - Stretch)

- [ ] **packages/cli/src/routes/config.js**
  - Add `GET /api/config/port` endpoint
  - Return `{ port: <current-port> }` from server
  - No auth required (public endpoint like `/api/auth/key`)

- [ ] **packages/web/src/utils/apiClient.ts**
  - Add `fetchBackendPort()` function
  - Use as fallback if sessionStorage empty
  - Validate against stored port periodically

---

## Touchpoints

**Modified Files:**
- `packages/web/src/utils/apiClient.ts` - Port tracking, validation
- `packages/web/src/App.tsx` - Port initialization
- `packages/web/src/hooks/useScan.ts` - EventSource error handling, reconnection
- `packages/web/vite.config.ts` - Proxy expansion
- `packages/web/src/pages/ActivityPage.tsx` - Download link conversion
- `packages/cli/src/routes/config.js` - Port endpoint (stretch)

**Test Files:**
- `packages/web/src/hooks/useScan.test.ts` - Update EventSource error tests
- `packages/web/src/utils/apiClient.test.ts` - Add port tracking tests (create if missing)

---

## Public Contracts

**SessionStorage Keys:**
- `vexcode-backend-port` - Stores the backend port (number)

**New Backend Endpoint (Stretch):**
- `GET /api/config/port` → `{ port: number }`

**EventSource Behavior Change:**
- No longer auto-reconnects on error
- Manual reconnection with exponential backoff (max 3 attempts)
- User-visible toast on port mismatch

---

## Blast Radius

**Risk:** LOW

- Changes are additive (port tracking)
- EventSource error handling improved (fail-safe)
- Proxy expansion is backwards-compatible
- Download link change is UI-only

**Affected Areas:**
- SSE scanning flows (better error handling)
- Download SARIF button (uses fetch instead of direct link)
- App initialization (adds sessionStorage read/write)

**Rollback:**
- Remove sessionStorage usage
- Revert EventSource error handlers to original
- Revert Vite proxy config
- Revert download links to `<a href>`

---

## Verification Evidence

### Manual Testing Checklist
- [ ] Start backend on port 3000, frontend on 5173
- [ ] Navigate: Overview → Issues → Overview (no port jump)
- [ ] Start a scan, check SSE connection stays on 5173
- [ ] Cancel scan, restart scan (SSE reconnects to correct port)
- [ ] Download SARIF report (no port jump)
- [ ] Refresh page mid-scan (SSE reconnects to correct port)
- [ ] Kill backend during scan (error toast shows, no port jump)
- [ ] Test with backend on custom port (e.g., 3001)

### Unit Tests
- [ ] `useScan.test.ts` - EventSource error handling with port validation
- [ ] `apiClient.test.ts` - Port tracking and validation functions
- [ ] Test reconnection logic with exponential backoff
- [ ] Test max reconnection attempts

### Integration Tests
- [ ] SSE scan flow with simulated network interruption
- [ ] Port mismatch detection and error reporting

---

## Resume and Execution Handoff

**Current State:** Plan approved, ready for implementation

**Entry Point:** Start with Phase 1 (Port Tracking)

**Next Steps:**
1. Implement `apiClient.ts` port tracking functions
2. Add port initialization in `App.tsx`
3. Fix EventSource error handlers in `useScan.ts`
4. Expand Vite proxy config
5. Convert download links to fetch
6. (Optional) Add backend port endpoint

**Testing Strategy:**
- Unit test each phase before moving to next
- Manual test SSE flows after Phase 2
- Full end-to-end test after Phase 4

**Completion Criteria:**
- ✅ No port jumps during navigation
- ✅ SSE connections stay on dev server port (5173)
- ✅ Download links work without port change
- ✅ All unit tests pass
- ✅ Manual verification checklist complete

---

## Dependencies

**Tools:**
- Vite 5.x (proxy config)
- EventSource API (browser native)
- SessionStorage API (browser native)
- Express 4.x (backend endpoint)

**External:**
- None

---

## Timeline Estimate

- Phase 1 (Port Tracking): 30 min
- Phase 2 (EventSource Fix): 45 min
- Phase 3 (Vite Proxy): 15 min
- Phase 4 (Download Links): 30 min
- Phase 5 (Backend Endpoint): 20 min
- Testing: 45 min

**Total:** ~3 hours (without stretch goal: ~2.5 hours)
