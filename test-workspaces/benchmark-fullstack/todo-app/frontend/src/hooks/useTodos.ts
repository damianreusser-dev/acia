import { useCallback, useEffect, useState } from 'react';

export interface Todo {
  id: string;
  text: string;
  completed: boolean;
  createdAt?: string;
}

const API_BASE = '/api/todos';

export function useTodos() {
  const [todos, setTodos] = useState<Todo[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchTodos = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(API_BASE);
      if (!res.ok) throw new Error(`Failed to load todos: ${res.status}`);
      const data = await res.json();
      // Ensure items have id and expected shape
      const normalized: Todo[] = (data || []).map((t: any) => ({
        id: String(t.id ?? t._id ?? t.key ?? t.id),
        text: String(t.text ?? t.title ?? ''),
        completed: Boolean(t.completed),
        createdAt: t.createdAt,
      }));
      setTodos(normalized);
    } catch (err: any) {
      setError(err?.message ?? String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchTodos();
  }, [fetchTodos]);

  const addTodo = useCallback(async (text: string) => {
    try {
      const res = await fetch(API_BASE, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      });
      if (!res.ok) throw new Error(`Failed to add todo: ${res.status}`);
      const created = await res.json();
      const item: Todo = {
        id: String(created.id ?? created._id ?? created.id),
        text: String(created.text ?? text),
        completed: Boolean(created.completed ?? false),
        createdAt: created.createdAt,
      };
      setTodos((s) => [item, ...s]);
    } catch (err: any) {
      setError(err?.message ?? String(err));
      throw err;
    }
  }, []);

  const toggleTodo = useCallback(async (id: string) => {
    const current = todos.find((t) => t.id === id);
    if (!current) return;
    const newCompleted = !current.completed;
    // optimistic update
    setTodos((s) => s.map((t) => (t.id === id ? { ...t, completed: newCompleted } : t)));
    try {
      const res = await fetch(`${API_BASE}/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ completed: newCompleted }),
      });
      if (!res.ok) throw new Error(`Failed to update todo: ${res.status}`);
    } catch (err: any) {
      // rollback
      setTodos((s) => s.map((t) => (t.id === id ? { ...t, completed: current.completed } : t)));
      setError(err?.message ?? String(err));
    }
  }, [todos]);

  const deleteTodo = useCallback(async (id: string) => {
    const prev = todos;
    setTodos((s) => s.filter((t) => t.id !== id));
    try {
      const res = await fetch(`${API_BASE}/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error(`Failed to delete todo: ${res.status}`);
    } catch (err: any) {
      // rollback
      setTodos(prev);
      setError(err?.message ?? String(err));
    }
  }, [todos]);

  return {
    todos,
    loading,
    error,
    fetchTodos,
    addTodo,
    toggleTodo,
    deleteTodo,
  } as const;
}
