import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { App } from './App';

describe('App', () => {
  it('renders with default title', () => {
    render(<App />);
    expect(screen.getByText('todo-app')).toBeInTheDocument();
  });

  it('renders with custom title', () => {
    render(<App title="Custom Title" />);
    expect(screen.getByText('Custom Title')).toBeInTheDocument();
  });

  it('increments count on button click', () => {
    render(<App />);
    const button = screen.getByRole('button');
    expect(button).toHaveTextContent('Count is 0');

    fireEvent.click(button);
    expect(button).toHaveTextContent('Count is 1');
  });
});
