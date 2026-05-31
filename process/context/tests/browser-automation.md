# Browser Automation Context

This document outlines the browser automation testing patterns for the AI Code Review Web UI.

## Scope

This file covers:
- Playwright E2E testing setup.
- Running E2E tests locally.
- Mocking backend services in browser tests.

## Testing Setup

Since the local Web UI is planned to be fast, lightweight, and local-first, Playwright will be utilized for browser-level E2E automation checks.

```bash
# Example test execution
npx playwright test
```
