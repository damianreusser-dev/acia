# Define target users, core value proposition, and the MVP — 2026-01-02T000000Z

## Overview
This Product Requirement Document (PRD) defines the target users (personas), the core value proposition, the problem we solve, the success hypothesis, a representative user journey, and the proposed MVP feature set for the "todo-app" fullstack project. The goal is to deliver a focused task management experience that demonstrates the end-to-end capabilities of the scaffolded fullstack app while solving a small but common user problem: lightweight personal task tracking with minimal friction.

---

## Personas (target users)
1. Persona: Busy Freelancer
   - Demographics: 25–45, works independently on multiple short-term projects.
   - Needs: Quickly capture tasks, deadlines, prioritize work, and track what's in progress.
   - Behaviors: Uses mobile and desktop, values speed and minimal UI friction, occasionally shares simple task lists with clients.

2. Persona: Productive Student
   - Demographics: 16–28, balancing classes, assignments, and part-time work.
   - Needs: Organize tasks by course or deadline, get reminders, and mark completed work.
   - Behaviors: Prefers simple interfaces, often uses mobile, occasionally wants to reorder tasks and set due dates.

3. Persona: Team Evaluator / Technical Interviewer (developer-focused)
   - Demographics: 25–45, technical users evaluating the app as a demo of fullstack capabilities.
   - Needs: Understand architecture, verify API behavior, and confirm basic authentication/CRUD works.
   - Behaviors: Inspects network/API, expects clear JSON responses and predictable UI behavior.

---

## Core value proposition
Provide a minimal, fast, and reliable personal task manager that lets users capture, organize, and complete tasks with near-zero setup. The product demonstrates a clear end-to-end fullstack implementation (frontend + API + persistence) and is useful as both a lightweight productivity tool and a reference/demo project for developers.

---

## Problem statement
Many users need a straightforward way to record and complete TODO items without the overhead of heavy project management tools. Existing full-featured tools are powerful but often slower to use for ephemeral or single-person task lists. Additionally, engineers and learners need a simple, well-structured fullstack reference app that showcases CRUD operations, client-server interactions, and basic auth patterns.

---

## Success hypothesis (metrics)
If we build a lightweight todo app with quick add, edit, and complete flows and an intuitive UI, then:
- End users will successfully add a task and mark it complete within 30 seconds (time-to-first-success metric).
- 1-week retention (or return rate) for casual users will be >= 25% in initial experiments (indicative metric for usefulness).
- For developer evaluators, the API will return clear JSON responses and the repo README/docs will allow a developer to run both services locally in <= 15 minutes.

Key measurable metrics for the MVP:
- Time-to-first-task: average time from opening app to creating first task.
- Task completion rate within session: percent of created tasks that are completed or archived.
- Dev setup time: time to run backend and frontend locally following README steps.

---

## User journey (happy path)
1. Landing: User opens the app (mobile or desktop).
2. Onboarding: Minimal: allow use without signup (no friction). Show a short placeholder list and a prominent "Add task" input.
3. Create: User types a task title into the input and presses Enter / taps Add.
4. Organize: User optionally assigns a due date or tag (simple text tag) and/or reorders tasks.
5. Complete: User taps the checkbox to mark the task complete; it moves to Completed section or is visually dimmed.
6. Persist: Tasks are saved to the backend; refresh restores tasks.
7. (Optional) Edit/Delete: User edits title or deletes an item.

Edge flows:
- Offline or backend error: show a small inline error and retry mechanism.
- Empty state: clear CTA to add first task and short tips.

---

## Proposed MVP feature set (minimal, prioritized)
Priority A (must-have)
- Create a task with a title (quick-add input).
- Read/list tasks (active and completed separation).
- Update task: mark complete / uncomplete.
- Delete task.
- Persistent storage via a backend API and simple database (e.g., SQLite or in-memory for demo); tasks restore on refresh.
- Clean, responsive UI (works on desktop and mobile widths).
- Basic API with JSON endpoints (GET /tasks, POST /tasks, PATCH /tasks/:id, DELETE /tasks/:id).
- Developer-focused README and runnable dev scripts for frontend and backend (already scaffolded).

Priority B (important but optional for first release)
- Task due date (simple date field) and basic sorting by due date.
- Task tags (single-line tags) and filter by tag.
- Reorder tasks (drag-and-drop) and persist order.
- Simple search/filter input for tasks.

Priority C (nice-to-have)
- Authentication (local/email or OAuth) and per-user task separation.
- Reminders/notifications.
- Sharing lists (read-only public link or simple collaborator model).

---

## Non-functional requirements
- Reasonably fast UI interactions: operations should feel immediate (optimistic UI where appropriate).
- Small codebase and clear separation between frontend and backend for educational value.
- Clear, stable API with predictable status codes and JSON error messages.
- Simple security: sanitize inputs and avoid dangerous exposure of internal data. For MVP, authentication may be omitted or stubbed.

---

## Risks & assumptions
- Assumption: Users prefer minimal friction over rich features for the target lightweight use-case.
- Risk: Over-building features (tags, reordering, auth) will delay delivery of the core experience.
- Risk: If the backend persistence layer is too ephemeral (in-memory only), it may undermine the perceived utility. Use a lightweight persistent option (SQLite or file-based) for better demo value.

---

## Next steps / Implementation plan
1. Implement Priority A features from the MVP list using the scaffolded frontend/backend.
2. Add end-to-end tests for the API endpoints and basic UI flows.
3. Write a short README with quick-start steps and the time-to-first-task goal.
4. Iterate on Priority B features based on early user/developer feedback.

---

Prepared by: Product/Design (generated as PRD for todo-app scaffold)
Date: 2026-01-02

