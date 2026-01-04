import { useState } from 'react';
import './App.css';

export interface AppProps {
  title?: string;
}

export function App({ title = 'todo-app' }: AppProps): JSX.Element {
  const [count, setCount] = useState(0);

  return (
    <div className="app">
      <h1>{title}</h1>
      <div className="card">
        <button onClick={() => setCount((c) => c + 1)}>
          Count is {count}
        </button>
      </div>
    </div>
  );
}
