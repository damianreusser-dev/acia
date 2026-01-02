# Prioritized MVP Backlog — 2026-01-02T000000Z

This backlog contains 8 user stories ordered by priority and mapped to the proposed MVP feature set from the PRD. Each story includes a title, user story statement, priority, size estimate (S/M/L), and explicit, testable acceptance criteria.

---

1. Title: Quick-add a task
   - User story: As a user, I want to quickly add a new task from the main screen so I can capture an item without friction.
   - Priority: P0 (Must-have)
   - Estimate: S
   - Mapped MVP feature: Create a task with a title (quick-add input)
   - Acceptance criteria:
     1. Given the app is open and the tasks list is visible, when I type text into the add-task input and press Enter (or tap Add), then a new task with that exact title appears in the active tasks list.
     2. The new task is persisted to the backend and returns an id; refreshing the page shows the task still present.
     3. If the input is empty and I press Add/Enter, the app shows a validation error and does not create a task.

---

2. Title: View and list tasks (active and completed)
   - User story: As a user, I want to see my existing tasks grouped by active and completed so I can understand what remains to be done.
   - Priority: P0 (Must-have)
   - Estimate: S
   - Mapped MVP feature: Read/list tasks (active and completed separation)
   - Acceptance criteria:
     1. Given multiple tasks exist in the backend with various completed statuses, when I load the app, then tasks are displayed and grouped into two sections: Active and Completed.
     2. Each displayed task shows its title and completion state. The number of tasks in each section equals the backend count returned by GET /tasks filtered by completed flag.
     3. If no tasks exist, an empty-state message and CTA to add a task is shown.

---

3. Title: Mark task as complete/uncomplete
   - User story: As a user, I want to mark a task complete or revert it to active so I can track progress.
   - Priority: P0 (Must-have)
   - Estimate: S
   - Mapped MVP feature: Update task: mark complete / uncomplete
   - Acceptance criteria:
     1. Given an active task in the list, when I click/tap the checkbox for that task, then the UI immediately reflects the task as completed (optimistic update) and the task moves from Active to Completed.
     2. The frontend issues PATCH /tasks/:id with completed=true and receives a 200 response; the backend persists the state. A page refresh shows the task in Completed.
     3. Given a completed task, when I toggle its checkbox to uncomplete, then it moves back to Active and PATCH /tasks/:id with completed=false is sent and persisted.

---

4. Title: Delete a task
   - User story: As a user, I want to delete tasks I no longer need so my list stays relevant.
   - Priority: P1 (High)
   - Estimate: S
   - Mapped MVP feature: Delete task
   - Acceptance criteria:
     1. Given a task is visible in the list, when I activate the delete action and confirm (if confirmation UI exists), then the task is removed from the UI and the frontend calls DELETE /tasks/:id and receives a 200 response.
     2. After deletion, a page refresh does not show the deleted task.
     3. If DELETE fails with a server error, the UI surfaces an error message and the task remains visible.

---

5. Title: Persist tasks with backend API
   - User story: As a user, I want tasks to be stored on a server so they are available after closing or refreshing the app.
   - Priority: P0 (Must-have)
   - Estimate: M
   - Mapped MVP feature: Persistent storage via backend API and simple database; API endpoints
   - Acceptance criteria:
     1. Backend exposes JSON endpoints: GET /tasks, POST /tasks, PATCH /tasks/:id, DELETE /tasks/:id.
     2. POST /tasks accepts { title } and returns 201 with created task including id and completed=false by default.
     3. GET /tasks returns an array of all tasks with correct fields (id, title, completed, createdAt). Tests should demonstrate creating multiple tasks and retrieving them.
     4. Data persists across server restarts if a persistent store is configured (e.g., SQLite or file-based). If using in-memory only for the demo, this is documented in README and tests reflect that behavior.

---

6. Title: Edit task title
   - User story: As a user, I want to edit the title of an existing task so I can correct or refine it.
   - Priority: P1 (High)
   - Estimate: S
   - Mapped MVP feature: Update task (title edits)
   - Acceptance criteria:
     1. Given a task is displayed, when I trigger edit on the task and change the title and save, then the UI shows the updated title immediately and the frontend calls PATCH /tasks/:id with the new title.
     2. The backend responds with 200 and the updated task. A page refresh shows the new title.
     3. If I submit an empty title, the UI shows a validation error and the PATCH is not sent.

---

7. Title: Responsive UI and basic accessibility
   - User story: As a user, I want the app to work on desktop and mobile widths and be keyboard-accessible so I can use it on any device.
   - Priority: P2 (Medium)
   - Estimate: M
   - Mapped MVP feature: Clean, responsive UI (works on desktop and mobile widths)
   - Acceptance criteria:
     1. The layout adapts to narrow (mobile) and wide (desktop) viewports: the add input and task list remain usable without horizontal scrolling on common widths (e.g., 360px and 1280px).
     2. All interactive controls (add, edit, delete, complete) are reachable and operable using a keyboard (tab navigation + Enter/Space to activate) and have appropriate ARIA attributes or semantic HTML.
     3. Basic color contrast for text and interactive elements meets a reasonable threshold (WCAG AA recommended for body text).

---

8. Title: Developer quick-start and README
   - User story: As a developer evaluating the project, I want clear setup instructions so I can run the frontend and backend locally within 15 minutes.
   - Priority: P0 (Must-have for developer evaluators)
   - Estimate: S
   - Mapped MVP feature: Developer-focused README and runnable dev scripts (already scaffolded)
   - Acceptance criteria:
     1. The repository root contains a README.md with clear steps to start the backend and frontend (install, run dev for each), and example API usage.
     2. Following the README, a developer can run the backend and frontend in separate terminals and reach the app at the expected local URLs.
     3. The README documents whether the backend uses persistent storage or in-memory storage and any environment variables needed.

---

Notes on ordering and scope:
- Items 1, 2, 3, and 5 are the core functional stories required to demonstrate end-to-end persistence and quick task operations.
- Items 4 and 6 (delete, edit) are lightweight additions that improve real-world usefulness and are high priority after core flows.
- Item 8 (README) is treated as P0 for developer evaluators because the scaffold is intended to be a demo/reference; it should be present before public sharing.
- Item 7 (responsiveness & accessibility) is medium priority but required to ensure the app is usable across devices.

If you want, I can:
- Create these stories as issue templates or GitHub issues in the repo (if you want them committed as tasks).
- Convert estimates to story points and produce a simple sprint plan.

