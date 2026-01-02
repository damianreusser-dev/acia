/**
 * ArchitectAgent Unit Tests
 *
 * Tests for the Software Architect agent that creates
 * system designs and API contracts.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ArchitectAgent } from '../../src/agents/architect/architect-agent.js';
import { LLMClient } from '../../src/core/llm/client.js';
import { WikiService } from '../../src/core/wiki/wiki-service.js';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';

describe('ArchitectAgent', () => {
  let mockLLMClient: LLMClient;
  let architect: ArchitectAgent;
  let tempDir: string;

  beforeEach(async () => {
    // Create temp workspace
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'architect-test-'));

    // Mock LLM client
    mockLLMClient = {
      chat: vi.fn(),
    } as unknown as LLMClient;

    architect = new ArchitectAgent({
      llmClient: mockLLMClient,
      tools: [],
      workspace: tempDir,
    });
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  describe('constructor', () => {
    it('should create architect with default name', () => {
      expect(architect.name).toBe('ArchitectAgent');
    });

    it('should create architect with custom name', () => {
      const customArchitect = new ArchitectAgent({
        name: 'CustomArchitect',
        llmClient: mockLLMClient,
        tools: [],
        workspace: tempDir,
      });
      expect(customArchitect.name).toBe('CustomArchitect');
    });

    it('should have Software Architect role', () => {
      expect(architect.role).toBe('Software Architect');
    });

    it('should store workspace path', () => {
      expect(architect.getWorkspace()).toBe(tempDir);
    });

    it('should report no wiki when not provided', () => {
      expect(architect.hasWiki()).toBe(false);
    });
  });

  describe('createDesign', () => {
    it('should create design from project request', async () => {
      const mockResponse = `
SYSTEM_OVERVIEW:
A fullstack todo application with React frontend and Express backend.

FILE_STRUCTURE:
/todo-app
  /frontend
    /src
      App.tsx
      api.ts
  /backend
    /src
      index.ts
      routes/
  /shared
    types.ts

API_CONTRACTS:
GET /api/todos - List all todos, Response: Todo[]
POST /api/todos - Create todo, Request: CreateTodoRequest, Response: Todo
DELETE /api/todos/:id - Delete todo, Response: void

DATA_MODELS:
\`\`\`typescript
interface Todo {
  id: string;
  title: string;
  completed: boolean;
}

interface CreateTodoRequest {
  title: string;
}
\`\`\`

COMMUNICATION:
Protocol: REST
Backend port: 3001
Frontend port: 3000
API base URL: http://localhost:3001/api
CORS origins: http://localhost:3000
Error format: { error: string, code: string }

TECH_STACK:
- Frontend: React - Modern UI library
- Backend: Express - Fast Node.js framework
- Database: In-memory - Simple for MVP
`;

      vi.mocked(mockLLMClient.chat).mockResolvedValue({ content: mockResponse });

      const design = await architect.createDesign('Build a todo application');

      expect(design).toBeDefined();
      expect(design.id).toMatch(/^design_/);
      expect(design.projectName).toContain('todo');
      expect(design.createdAt).toBeInstanceOf(Date);
    });

    it('should parse system overview correctly', async () => {
      const mockResponse = `
SYSTEM_OVERVIEW:
This is a comprehensive blog platform with user authentication.

FILE_STRUCTURE:
/blog
  /src

TECH_STACK:
- Backend: Node.js
`;

      vi.mocked(mockLLMClient.chat).mockResolvedValue({ content: mockResponse });

      const design = await architect.createDesign('Build a blog');

      expect(design.overview).toContain('comprehensive blog platform');
      expect(design.overview).toContain('user authentication');
    });

    it('should parse file structure correctly', async () => {
      const mockResponse = `
SYSTEM_OVERVIEW:
Simple app.

FILE_STRUCTURE:
/app
  /frontend
    /src
      index.tsx
  /backend
    /src
      server.ts

TECH_STACK:
- Frontend: React
`;

      vi.mocked(mockLLMClient.chat).mockResolvedValue({ content: mockResponse });

      const design = await architect.createDesign('Build an app');

      expect(design.fileStructure).toContain('/frontend');
      expect(design.fileStructure).toContain('/backend');
      expect(design.fileStructure).toContain('index.tsx');
      expect(design.fileStructure).toContain('server.ts');
    });

    it('should parse API contracts correctly', async () => {
      const mockResponse = `
SYSTEM_OVERVIEW:
API service.

API_CONTRACTS:
GET /api/users - List users, Response: User[]
POST /api/users - Create user, Request: CreateUserRequest, Response: User, auth required
PUT /api/users/:id - Update user, Request: UpdateUserRequest, Response: User
DELETE /api/users/:id - Delete user, Response: void

TECH_STACK:
- Backend: Express
`;

      vi.mocked(mockLLMClient.chat).mockResolvedValue({ content: mockResponse });

      const design = await architect.createDesign('Build user API');

      expect(design.apiContracts).toHaveLength(4);

      const getEndpoint = design.apiContracts.find(c => c.method === 'GET');
      expect(getEndpoint).toBeDefined();
      expect(getEndpoint?.path).toBe('/api/users');
      expect(getEndpoint?.responseType).toBe('User[]');

      const postEndpoint = design.apiContracts.find(c => c.method === 'POST');
      expect(postEndpoint).toBeDefined();
      expect(postEndpoint?.requestType).toBe('CreateUserRequest');
      expect(postEndpoint?.authRequired).toBe(true);
    });

    it('should parse data models correctly', async () => {
      const mockResponse = `
SYSTEM_OVERVIEW:
Data models test.

DATA_MODELS:
\`\`\`typescript
interface User {
  id: string;
  email: string;
  name: string;
}

interface CreateUserRequest {
  email: string;
  name: string;
}
\`\`\`

TECH_STACK:
- Backend: Node.js
`;

      vi.mocked(mockLLMClient.chat).mockResolvedValue({ content: mockResponse });

      const design = await architect.createDesign('Build user system');

      expect(design.dataModels).toContain('interface User');
      expect(design.dataModels).toContain('id: string');
      expect(design.dataModels).toContain('email: string');
      expect(design.dataModels).toContain('interface CreateUserRequest');
    });

    it('should parse communication config correctly', async () => {
      const mockResponse = `
SYSTEM_OVERVIEW:
Fullstack app.

COMMUNICATION:
Protocol: REST
Backend port: 4000
Frontend port: 5173
API base URL: http://localhost:4000/api
CORS origins: http://localhost:5173
Error format: { message: string }

TECH_STACK:
- Frontend: Vue
`;

      vi.mocked(mockLLMClient.chat).mockResolvedValue({ content: mockResponse });

      const design = await architect.createDesign('Build app');

      expect(design.communication.protocol).toBe('REST');
      expect(design.communication.backendPort).toBe(4000);
      expect(design.communication.frontendPort).toBe(5173);
      expect(design.communication.apiBaseUrl).toBe('http://localhost:4000/api');
      expect(design.communication.cors.allowedOrigins).toContain('http://localhost:5173');
    });

    it('should parse technology stack correctly', async () => {
      const mockResponse = `
SYSTEM_OVERVIEW:
Tech stack test.

TECH_STACK:
- Frontend: React - Component-based UI
- Backend: Express - Lightweight framework
- Database: PostgreSQL - Relational database
- Testing: Vitest - Fast test runner

FILE_STRUCTURE:
/app
`;

      vi.mocked(mockLLMClient.chat).mockResolvedValue({ content: mockResponse });

      const design = await architect.createDesign('Build app');

      expect(design.techStack).toHaveLength(4);

      const frontend = design.techStack.find(t => t.component === 'frontend');
      expect(frontend?.technology).toBe('React');
      expect(frontend?.rationale).toBe('Component-based UI');

      const database = design.techStack.find(t => t.component === 'database');
      expect(database?.technology).toBe('PostgreSQL');
    });

    it('should use default ports when not specified', async () => {
      const mockResponse = `
SYSTEM_OVERVIEW:
Simple app.

COMMUNICATION:
Protocol: REST

TECH_STACK:
- Backend: Express
`;

      vi.mocked(mockLLMClient.chat).mockResolvedValue({ content: mockResponse });

      const design = await architect.createDesign('Build app');

      expect(design.communication.backendPort).toBe(3001);
      expect(design.communication.frontendPort).toBe(3000);
    });

    it('should generate unique design IDs', async () => {
      vi.mocked(mockLLMClient.chat).mockResolvedValue({
        content: 'SYSTEM_OVERVIEW:\nApp.\n\nTECH_STACK:\n- Backend: Node'
      });

      const design1 = await architect.createDesign('App 1');
      const design2 = await architect.createDesign('App 2');

      expect(design1.id).not.toBe(design2.id);
    });

    it('should extract project name from "build a X" request', async () => {
      vi.mocked(mockLLMClient.chat).mockResolvedValue({
        content: 'SYSTEM_OVERVIEW:\nCalendar app.\n\nTECH_STACK:\n- Frontend: React'
      });

      const design = await architect.createDesign('Build a calendar application');

      expect(design.projectName.toLowerCase()).toContain('calendar');
    });

    it('should extract project name from "create a X" request', async () => {
      vi.mocked(mockLLMClient.chat).mockResolvedValue({
        content: 'SYSTEM_OVERVIEW:\nChat app.\n\nTECH_STACK:\n- Frontend: React'
      });

      const design = await architect.createDesign('Create a chat application');

      expect(design.projectName.toLowerCase()).toContain('chat');
    });
  });

  describe('with WikiService', () => {
    let wikiDir: string;
    let wikiService: WikiService;
    let architectWithWiki: ArchitectAgent;

    beforeEach(async () => {
      wikiDir = path.join(tempDir, '.wiki');
      await fs.mkdir(wikiDir, { recursive: true });
      wikiService = new WikiService({ wikiRoot: wikiDir });

      architectWithWiki = new ArchitectAgent({
        llmClient: mockLLMClient,
        tools: [],
        workspace: tempDir,
        wikiService,
      });
    });

    it('should report wiki available', () => {
      expect(architectWithWiki.hasWiki()).toBe(true);
    });

    it('should write design to wiki', async () => {
      const mockResponse = `
SYSTEM_OVERVIEW:
A notes application.

FILE_STRUCTURE:
/notes-app
  /src

API_CONTRACTS:
GET /api/notes - List notes, Response: Note[]

DATA_MODELS:
\`\`\`typescript
interface Note {
  id: string;
  content: string;
}
\`\`\`

TECH_STACK:
- Backend: Express
`;

      vi.mocked(mockLLMClient.chat).mockResolvedValue({ content: mockResponse });

      const design = await architectWithWiki.createDesign('Build a notes app');

      expect(design.wikiPath).toBeDefined();
      expect(design.wikiPath).toContain('designs/');

      // Check wiki files were created
      const designPage = await wikiService.readPage(`${design.wikiPath}/design.md`);
      expect(designPage).not.toBeNull();
      expect(designPage?.content).toContain('notes application');

      const contractsPage = await wikiService.readPage(`${design.wikiPath}/contracts.md`);
      expect(contractsPage).not.toBeNull();
      expect(contractsPage?.content).toContain('interface Note');
    });

    it('should include API table in wiki design', async () => {
      const mockResponse = `
SYSTEM_OVERVIEW:
API service.

API_CONTRACTS:
GET /api/items - List items, Response: Item[]
POST /api/items - Create item, Request: CreateItem, Response: Item

TECH_STACK:
- Backend: Express
`;

      vi.mocked(mockLLMClient.chat).mockResolvedValue({ content: mockResponse });

      const design = await architectWithWiki.createDesign('Build items API');

      const designPage = await wikiService.readPage(`${design.wikiPath}/design.md`);
      expect(designPage?.content).toContain('| Method | Path |');
      expect(designPage?.content).toContain('| GET | /api/items |');
      expect(designPage?.content).toContain('| POST | /api/items |');
    });

    it('should generate safe wiki path from project name', async () => {
      vi.mocked(mockLLMClient.chat).mockResolvedValue({
        content: 'SYSTEM_OVERVIEW:\nSpecial app.\n\nTECH_STACK:\n- Backend: Node'
      });

      const design = await architectWithWiki.createDesign('Build a "Special App" with Spaces & Symbols!');

      expect(design.wikiPath).toMatch(/^designs\/[a-z0-9-]+$/);
      expect(design.wikiPath).not.toContain(' ');
      expect(design.wikiPath).not.toContain('"');
      expect(design.wikiPath).not.toContain('!');
    });
  });

  describe('edge cases', () => {
    it('should handle empty response gracefully', async () => {
      vi.mocked(mockLLMClient.chat).mockResolvedValue({ content: '' });

      const design = await architect.createDesign('Build something');

      expect(design).toBeDefined();
      expect(design.id).toBeDefined();
      expect(design.overview).toBe('Build something'); // Falls back to request
    });

    it('should handle response without sections', async () => {
      vi.mocked(mockLLMClient.chat).mockResolvedValue({
        content: 'Here is a simple app design without proper sections.'
      });

      const design = await architect.createDesign('Build app');

      expect(design).toBeDefined();
      expect(design.apiContracts).toHaveLength(0);
      expect(design.techStack).toHaveLength(0);
    });

    it('should handle malformed API contracts', async () => {
      const mockResponse = `
SYSTEM_OVERVIEW:
Test app.

API_CONTRACTS:
This is not a valid endpoint format
Another invalid line
GET - missing path

TECH_STACK:
- Backend: Node
`;

      vi.mocked(mockLLMClient.chat).mockResolvedValue({ content: mockResponse });

      const design = await architect.createDesign('Build app');

      // Should not crash, just have empty or partial contracts
      expect(design).toBeDefined();
    });

    it('should handle very long project names', async () => {
      vi.mocked(mockLLMClient.chat).mockResolvedValue({
        content: 'SYSTEM_OVERVIEW:\nApp.\n\nTECH_STACK:\n- Backend: Node'
      });

      const longRequest = 'Build a ' + 'very '.repeat(100) + 'long application';
      const design = await architect.createDesign(longRequest);

      expect(design.wikiPath).toBeDefined();
      expect(design.wikiPath!.length).toBeLessThan(100);
    });

    it('should handle WebSocket protocol', async () => {
      const mockResponse = `
SYSTEM_OVERVIEW:
Real-time app.

COMMUNICATION:
Protocol: WebSocket
Backend port: 8080

TECH_STACK:
- Backend: Socket.io
`;

      vi.mocked(mockLLMClient.chat).mockResolvedValue({ content: mockResponse });

      const design = await architect.createDesign('Build real-time app');

      expect(design.communication.protocol).toBe('WebSocket');
    });

    it('should handle auth required detection in various formats', async () => {
      const mockResponse = `
SYSTEM_OVERVIEW:
Secure API.

API_CONTRACTS:
GET /api/public - Public endpoint, Response: Data
GET /api/protected - Protected endpoint, Response: Data, authenticated
POST /api/admin - Admin endpoint, Response: Data, auth required

TECH_STACK:
- Backend: Express
`;

      vi.mocked(mockLLMClient.chat).mockResolvedValue({ content: mockResponse });

      const design = await architect.createDesign('Build secure API');

      const publicEndpoint = design.apiContracts.find(c => c.path === '/api/public');
      expect(publicEndpoint?.authRequired).toBe(false);

      const protectedEndpoint = design.apiContracts.find(c => c.path === '/api/protected');
      expect(protectedEndpoint?.authRequired).toBe(true);

      const adminEndpoint = design.apiContracts.find(c => c.path === '/api/admin');
      expect(adminEndpoint?.authRequired).toBe(true);
    });
  });
});
