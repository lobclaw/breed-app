---
status: partial
phase: 01-workbench-contract-test-foundation
source: [01-VERIFICATION.md]
started: 2026-04-16T02:07:45Z
updated: 2026-04-16T02:07:45Z
---

## Current Test

Awaiting human testing for Phase 1 UI/touch behavior.

## Tests

### 1. DogCard Hidden Task Expansion

expected: A dog card with more than 3 tasks shows `还有 X 项，展开`, expands inline to all task tags, then shows `收起` without navigating or completing a task.

result: pending

### 2. BatchCard Hidden Dog Expansion

expected: A batch card with more than 12 dogs shows `还有 X 只，展开`, expands inline to all dog chips, then shows `收起` without opening a sheet, navigating, calling backend, or changing checked dogs.

result: pending

### 3. Current Home Rendering Regression

expected: The home page still renders the existing section/card UI while computed `todayWorkbench` / `dayWorkbench` exist only as integration state.

result: pending

## Summary

total: 3
passed: 0
issues: 0
pending: 3
skipped: 0
blocked: 0

## Gaps

None reported yet.
