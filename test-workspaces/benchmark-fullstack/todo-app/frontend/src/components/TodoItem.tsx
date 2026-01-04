import React from 'react';
import type { Todo } from '../hooks/useTodos';

interface TodoItemProps {
  todo: Todo;
  onToggle: (id: string) => void;
  onDelete: (id: string) => void;
}

export default function TodoItem({ todo, onToggle, onDelete }: TodoItemProps) {
  return (
    <li
      key={todo.id}
      aria-label={`todo-item-${todo.id}`}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '8px 12px',
        borderBottom: '1px solid #eee',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <input
          type="checkbox"
          checked={todo.completed}
          onChange={() => onToggle(todo.id)}
          aria-label={`toggle-todo-${todo.id}`}
        />
        <div>
          <div style={{ textDecoration: todo.completed ? 'line-through' : 'none' }}>
            {todo.text}
          </div>
          {todo.createdAt && (
            <small style={{ color: '#666' }}>{new Date(todo.createdAt).toLocaleString()}</small>
          )}
        </div>
      </div>
      <div>
        <button
          onClick={() => onDelete(todo.id)}
          aria-label={`delete-todo-${todo.id}`}
          style={{
            background: 'transparent',
            border: 'none',
            color: '#c00',
            cursor: 'pointer',
            padding: '4px 8px',
          }}
        >
          Delete
        </button>
      </div>
    </li>
  );
}
