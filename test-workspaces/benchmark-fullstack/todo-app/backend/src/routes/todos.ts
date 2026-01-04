import express, { Request, Response } from 'express';
import { Todo } from '../types/todo.js';

const router = express.Router();

// In-memory storage
const todos: Todo[] = [];

// Simple ID generator
function generateId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

// Validation helpers
function isNonEmptyString(value: any): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

// GET /api/todos
router.get('/', (_req: Request, res: Response) => {
  res.json(todos);
});

// POST /api/todos
router.post('/', (req: Request, res: Response) => {
  const { title } = req.body;
  if (!isNonEmptyString(title)) {
    return res.status(400).json({ error: 'title is required and must be a non-empty string' });
  }

  const newTodo: Todo = {
    id: generateId(),
    title: title.trim(),
    completed: false,
    createdAt: new Date(),
  };

  todos.push(newTodo);
  return res.status(201).json(newTodo);
});

// PUT /api/todos/:id
router.put('/:id', (req: Request, res: Response) => {
  const { id } = req.params;
  const { title, completed } = req.body;

  const index = todos.findIndex((t) => t.id === id);
  if (index === -1) {
    return res.status(404).json({ error: 'Todo not found' });
  }

  if (title !== undefined && !isNonEmptyString(title)) {
    return res.status(400).json({ error: 'title must be a non-empty string when provided' });
  }
  if (completed !== undefined && typeof completed !== 'boolean') {
    return res.status(400).json({ error: 'completed must be a boolean when provided' });
  }

  const existing = todos[index];
  const updated: Todo = {
    ...existing,
    title: title !== undefined ? title.trim() : existing.title,
    completed: completed !== undefined ? completed : existing.completed,
  };

  todos[index] = updated;
  return res.json(updated);
});

// DELETE /api/todos/:id
router.delete('/:id', (req: Request, res: Response) => {
  const { id } = req.params;
  const index = todos.findIndex((t) => t.id === id);
  if (index === -1) {
    return res.status(404).json({ error: 'Todo not found' });
  }

  todos.splice(index, 1);
  return res.status(204).send();
});

export { router as todosRouter };
