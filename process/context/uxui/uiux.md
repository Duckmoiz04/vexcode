# UX/UI Design Guidelines

This document outlines the visual identity and user interface standards for the AI Code Review local Web UI.

## Scope

This file covers:
- Visual identity (rich aesthetics, modern dark modes, smooth gradients, subtle micro-animations).
- Design system tokens (HSL-based tailored color palettes, modern fonts, consistent spacing).
- Layout wireframes and interaction workflows for scanning code and applying fixes.

## Visual Identity Standards

As a local Web UI tool, the interface should feel incredibly premium, responsive, and visually appealing.

### Styling Standards
1. **Rich Aesthetics:** Wow the user at first glance. Use harmonious color palettes, modern typography, glassmorphism, and smooth transitions. Avoid standard, unstyled HTML elements.
2. **Harmonious Palette (HSL Tailored):**
   - Background: Dark slate/navy (`hsl(220, 25%, 10%)`) or deep charcoal.
   - Surface/Card: Semi-transparent glassmorphism (`hsla(220, 20%, 15%, 0.7)`).
   - Accents: Electric blue (`hsl(210, 100%, 50%)`), neon emerald (`hsl(145, 80%, 45%)`) for success/approved states, and vibrant crimson (`hsl(350, 85%, 55%)`) for warnings/errors.
3. **Typography:** Use modern web fonts (e.g., Google Fonts *Inter* or *Outfit*) instead of browser default serifs.
4. **Animations:** Subtle hover transitions (`transition: all 0.2s ease-in-out`), smooth dialog scale-ins, and animated loading/scanning indicators to make the interface feel alive.

## Core Screens & Workflows

### 1. Dashboard / Scanning Interface
- **Primary Section:** An interactive file explorer or drag-and-drop zone to select a local directory.
- **Trigger Button:** "Scan Project" - plays a scanning micro-animation indicating that Semgrep and GitNexus are processing the codebase.
- **Configuration Panel:** Sidebar to configure AI Model parameters (e.g., API key, base URL, model selection, specifically connecting to `9router`).

### 2. Scan Results & Code Comparison (Diff Viewer)
- **Vulnerability List:** Grouped by severity (High, Medium, Low) and rule category. Clicking a finding highlights the relevant file and line.
- **Code Diff Panel:** Side-by-side or inline split screen showing the original code with errors highlighted in red, and the AI-proposed fix highlighted in green.
- **Action Button:** "Apply Fix" - clicking this writes the corrected code directly to the local file. Displays a success notification upon completion.
