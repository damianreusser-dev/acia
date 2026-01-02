# Core Metrics / KPIs — 2026-01-02T000000Z

This document summarizes the primary activation and core-flow KPIs for the todo-app MVP. These metrics are referenced by the PRD and should be measured during early experiments and developer demos.

Primary KPIs (activation & core-flow)

1. Time-to-first-task (activation)
   - Definition: Time (seconds) from opening the app to successfully creating the first task.
   - Target: <= 30s for most users in initial experiments.
   - How to measure: Instrument the frontend to record timestamp at app load and timestamp when POST /tasks returns success; compute difference.

2. Task completion rate within session (core flow)
   - Definition: Percent of tasks created during a session that are marked completed (or archived) before session end.
   - Target: Aim for meaningful engagement; initial target > 25% within sessions.
   - How to measure: Track created tasks and task.completed toggles per session.

3. 1-week return / retention (usefulness)
   - Definition: Percent of users who return to the app at least once within 7 days of their first session.
   - Target: >= 25% (initial goal to validate usefulness).
   - How to measure: Use a simple anonymous cookie or localStorage id to approximate unique users in early tests; for more rigor, add auth later.

4. Dev setup time (developer experience)
   - Definition: Time for a developer to run backend and frontend locally from a fresh clone following README instructions.
   - Target: <= 15 minutes.
   - How to measure: Manual verification during onboarding and via contributor feedback.

Secondary diagnostics
- API error rate: percent of API requests returning 5xx during normal usage.
- Median request latency for core endpoints (GET /tasks, POST /tasks, PATCH /tasks/:id).
- Data persistence verification: proportion of created tasks that persist across a backend restart (if persistent store configured).

Notes
- For the MVP, lightweight instrumentation (console logs, simple request timing, or local analytics) is sufficient. Keep instrumentation privacy-friendly and documented in README.
- The PRD contains success hypotheses and context for these KPIs: designs/define-target-users-core-value-proposition-and-the-20260102T000000Z.md

