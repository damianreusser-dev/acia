/**
 * React Project Template
 *
 * Template for creating React + TypeScript frontend projects.
 */

import { ProjectTemplate, TemplateOptions } from './types.js';

/**
 * Generate a React project template
 */
export function createReactTemplate(options: TemplateOptions): ProjectTemplate {
  const { projectName, description = 'A React TypeScript application', version = '0.1.0' } = options;

  return {
    name: projectName,
    description,
    category: 'frontend',
    dependencies: {
      'react': '^18.2.0',
      'react-dom': '^18.2.0',
    },
    devDependencies: {
      '@types/react': '^18.2.0',
      '@types/react-dom': '^18.2.0',
      '@vitejs/plugin-react': '^4.2.0',
      'typescript': '^5.3.0',
      'vite': '^5.0.0',
      'vitest': '^1.0.0',
      '@testing-library/react': '^14.0.0',
      '@testing-library/jest-dom': '^6.0.0',
    },
    scripts: {
      'dev': 'vite',
      'build': 'tsc && vite build',
      'preview': 'vite preview',
      'test': 'vitest run',
      'test:watch': 'vitest',
      'typecheck': 'tsc --noEmit',
    },
    files: [
      {
        path: 'package.json',
        content: JSON.stringify({
          name: projectName,
          version,
          private: true,
          type: 'module',
          scripts: {
            dev: 'vite',
            build: 'tsc && vite build',
            preview: 'vite preview',
            test: 'vitest run',
            'test:watch': 'vitest',
            typecheck: 'tsc --noEmit',
          },
          dependencies: {
            react: '^18.2.0',
            'react-dom': '^18.2.0',
          },
          devDependencies: {
            '@types/react': '^18.2.0',
            '@types/react-dom': '^18.2.0',
            '@vitejs/plugin-react': '^4.2.0',
            typescript: '^5.3.0',
            vite: '^5.0.0',
            vitest: '^1.0.0',
            '@testing-library/react': '^14.0.0',
            '@testing-library/jest-dom': '^6.0.0',
          },
        }, null, 2),
        description: 'Package manifest with dependencies',
      },
      {
        path: 'tsconfig.json',
        content: JSON.stringify({
          compilerOptions: {
            target: 'ES2020',
            useDefineForClassFields: true,
            lib: ['ES2020', 'DOM', 'DOM.Iterable'],
            module: 'ESNext',
            skipLibCheck: true,
            moduleResolution: 'bundler',
            allowImportingTsExtensions: true,
            resolveJsonModule: true,
            isolatedModules: true,
            noEmit: true,
            jsx: 'react-jsx',
            strict: true,
            noUnusedLocals: true,
            noUnusedParameters: true,
            noFallthroughCasesInSwitch: true,
          },
          include: ['src'],
          references: [{ path: './tsconfig.node.json' }],
        }, null, 2),
        description: 'TypeScript configuration',
      },
      {
        path: 'tsconfig.node.json',
        content: JSON.stringify({
          compilerOptions: {
            composite: true,
            skipLibCheck: true,
            module: 'ESNext',
            moduleResolution: 'bundler',
            allowSyntheticDefaultImports: true,
          },
          include: ['vite.config.ts'],
        }, null, 2),
        description: 'TypeScript config for Vite',
      },
      {
        path: 'vite.config.ts',
        content: `import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
  },
});
`,
        description: 'Vite configuration',
      },
      {
        path: 'index.html',
        content: `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${projectName}</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
`,
        description: 'HTML entry point',
      },
      {
        path: 'src/main.tsx',
        content: `import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
`,
        description: 'React entry point',
      },
      {
        path: 'src/App.tsx',
        content: `import { useState } from 'react';
import './App.css';

export interface AppProps {
  title?: string;
}

export function App({ title = '${projectName}' }: AppProps): JSX.Element {
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
`,
        description: 'Main App component',
      },
      {
        path: 'src/App.css',
        content: `.app {
  max-width: 1280px;
  margin: 0 auto;
  padding: 2rem;
  text-align: center;
}

.card {
  padding: 2em;
}

button {
  border-radius: 8px;
  border: 1px solid transparent;
  padding: 0.6em 1.2em;
  font-size: 1em;
  font-weight: 500;
  font-family: inherit;
  background-color: #1a1a1a;
  color: #fff;
  cursor: pointer;
  transition: border-color 0.25s;
}

button:hover {
  border-color: #646cff;
}

button:focus,
button:focus-visible {
  outline: 4px auto -webkit-focus-ring-color;
}
`,
        description: 'App component styles',
      },
      {
        path: 'src/index.css',
        content: `:root {
  font-family: Inter, system-ui, Avenir, Helvetica, Arial, sans-serif;
  line-height: 1.5;
  font-weight: 400;
  color: #213547;
  background-color: #ffffff;
}

body {
  margin: 0;
  min-width: 320px;
  min-height: 100vh;
}

h1 {
  font-size: 3.2em;
  line-height: 1.1;
}
`,
        description: 'Global styles',
      },
      {
        path: 'src/test/setup.ts',
        content: `import '@testing-library/jest-dom';
`,
        description: 'Test setup file',
      },
      {
        path: 'src/App.test.tsx',
        content: `import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { App } from './App';

describe('App', () => {
  it('renders with default title', () => {
    render(<App />);
    expect(screen.getByText('${projectName}')).toBeInTheDocument();
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
`,
        description: 'App component tests',
      },
      {
        path: '.gitignore',
        content: `# Dependencies
node_modules/

# Build output
dist/
build/

# Local env files
.env*.local

# Editor directories
.vscode/
.idea/

# OS files
.DS_Store
Thumbs.db

# Test coverage
coverage/
`,
        description: 'Git ignore file',
      },
    ],
  };
}
