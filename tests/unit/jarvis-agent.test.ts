/**
 * Unit tests for Jarvis Agent
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { JarvisAgent, Company } from '../../src/agents/executive/jarvis-agent.js';
import { CEOAgent, CEOResult } from '../../src/agents/executive/ceo-agent.js';
import { LLMClient } from '../../src/core/llm/client.js';
import { WikiService } from '../../src/core/wiki/wiki-service.js';

describe('JarvisAgent', () => {
  let mockLLMClient: LLMClient;
  let jarvisAgent: JarvisAgent;

  beforeEach(() => {
    mockLLMClient = {
      chat: vi.fn().mockResolvedValue({
        content: 'Test response',
        stopReason: 'end_turn',
        usage: { inputTokens: 100, outputTokens: 50 },
      }),
    } as unknown as LLMClient;

    jarvisAgent = new JarvisAgent({
      llmClient: mockLLMClient,
      tools: [],
    });
  });

  describe('constructor', () => {
    it('should create Jarvis agent with default name', () => {
      const agent = new JarvisAgent({
        llmClient: mockLLMClient,
        tools: [],
      });

      expect(agent.name).toBe('JARVIS');
    });

    it('should create Jarvis agent with custom name', () => {
      const agent = new JarvisAgent({
        name: 'CustomJarvis',
        llmClient: mockLLMClient,
        tools: [],
      });

      expect(agent.name).toBe('CustomJarvis');
    });

    it('should accept wiki service', () => {
      const mockWikiService = {} as WikiService;
      const agent = new JarvisAgent({
        llmClient: mockLLMClient,
        tools: [],
        wikiService: mockWikiService,
      });

      expect(agent).toBeDefined();
    });
  });

  describe('company management', () => {
    it('should register a company', () => {
      const mockCEO = {} as CEOAgent;
      const company: Company = {
        id: 'test-company',
        name: 'Test Company',
        domain: 'Testing',
        ceo: mockCEO,
        createdAt: new Date(),
        status: 'active',
      };

      jarvisAgent.registerCompany(company);

      expect(jarvisAgent.getCompany('test-company')).toBe(company);
    });

    it('should return undefined for non-existent company', () => {
      expect(jarvisAgent.getCompany('nonexistent')).toBeUndefined();
    });

    it('should list all companies', () => {
      const mockCEO = {} as CEOAgent;

      jarvisAgent.registerCompany({
        id: 'company1',
        name: 'Company 1',
        domain: 'Domain 1',
        ceo: mockCEO,
        createdAt: new Date(),
        status: 'active',
      });

      jarvisAgent.registerCompany({
        id: 'company2',
        name: 'Company 2',
        domain: 'Domain 2',
        ceo: mockCEO,
        createdAt: new Date(),
        status: 'active',
      });

      const companies = jarvisAgent.getCompanies();
      expect(companies.length).toBe(2);
      expect(companies.map((c) => c.id)).toContain('company1');
      expect(companies.map((c) => c.id)).toContain('company2');
    });

    it('should pause a company', () => {
      const mockCEO = {} as CEOAgent;
      jarvisAgent.registerCompany({
        id: 'pausable',
        name: 'Pausable Co',
        domain: 'Testing',
        ceo: mockCEO,
        createdAt: new Date(),
        status: 'active',
      });

      const result = jarvisAgent.pauseCompany('pausable');
      expect(result).toBe(true);
      expect(jarvisAgent.getCompany('pausable')?.status).toBe('paused');
    });

    it('should return false when pausing non-existent company', () => {
      const result = jarvisAgent.pauseCompany('nonexistent');
      expect(result).toBe(false);
    });

    it('should resume a paused company', () => {
      const mockCEO = {} as CEOAgent;
      jarvisAgent.registerCompany({
        id: 'resumable',
        name: 'Resumable Co',
        domain: 'Testing',
        ceo: mockCEO,
        createdAt: new Date(),
        status: 'paused',
      });

      const result = jarvisAgent.resumeCompany('resumable');
      expect(result).toBe(true);
      expect(jarvisAgent.getCompany('resumable')?.status).toBe('active');
    });

    it('should not resume an active company', () => {
      const mockCEO = {} as CEOAgent;
      jarvisAgent.registerCompany({
        id: 'active-co',
        name: 'Active Co',
        domain: 'Testing',
        ceo: mockCEO,
        createdAt: new Date(),
        status: 'active',
      });

      const result = jarvisAgent.resumeCompany('active-co');
      expect(result).toBe(false);
    });

    it('should archive a company', () => {
      const mockCEO = {} as CEOAgent;
      jarvisAgent.registerCompany({
        id: 'archivable',
        name: 'Archivable Co',
        domain: 'Testing',
        ceo: mockCEO,
        createdAt: new Date(),
        status: 'active',
      });

      const result = jarvisAgent.archiveCompany('archivable');
      expect(result).toBe(true);
      expect(jarvisAgent.getCompany('archivable')?.status).toBe('archived');
    });
  });

  describe('processRequest', () => {
    it('should return status when no companies exist', async () => {
      (mockLLMClient.chat as ReturnType<typeof vi.fn>).mockResolvedValue({
        content: 'ACTION: status\nRESPONSE: No active work.',
        stopReason: 'end_turn',
        usage: { inputTokens: 100, outputTokens: 50 },
      });

      const result = await jarvisAgent.processRequest('What is the status?');

      expect(result.success).toBe(true);
      expect(result.response).toContain('No companies');
    });

    it('should delegate to existing company', async () => {
      // Setup mock CEO
      const mockCEO = {
        executeGoal: vi.fn().mockResolvedValue({
          success: true,
          projects: [{ title: 'Test Project', status: 'completed', priority: 'high' }],
          completedProjects: 1,
          failedProjects: 0,
          escalatedToHuman: false,
        } as CEOResult),
        getActiveProjects: vi.fn().mockReturnValue([]),
      } as unknown as CEOAgent;

      jarvisAgent.registerCompany({
        id: 'tech-company',
        name: 'Tech Company',
        domain: 'Software Development',
        ceo: mockCEO,
        createdAt: new Date(),
        status: 'active',
      });

      (mockLLMClient.chat as ReturnType<typeof vi.fn>).mockResolvedValue({
        content: 'ACTION: delegate\nCOMPANY_ID: tech-company',
        stopReason: 'end_turn',
        usage: { inputTokens: 100, outputTokens: 50 },
      });

      const result = await jarvisAgent.processRequest('Build a new feature');

      expect(result.success).toBe(true);
      expect(result.delegatedTo).toBe('tech-company');
      expect(mockCEO.executeGoal).toHaveBeenCalledWith('Build a new feature');
    });

    it('should create new company when needed', async () => {
      (mockLLMClient.chat as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce({
          content: 'ACTION: create_company\nCOMPANY_NAME: Mobile App Team\nDOMAIN: Mobile Development',
          stopReason: 'end_turn',
          usage: { inputTokens: 100, outputTokens: 50 },
        })
        .mockResolvedValueOnce({
          // CEO planning
          content: 'PROJECTS:\n1. [Mobile App] | [Priority: high] | Create mobile app',
          stopReason: 'end_turn',
          usage: { inputTokens: 100, outputTokens: 100 },
        });

      const result = await jarvisAgent.processRequest('Build a mobile app');

      expect(result.newCompanyCreated).toBe(true);
      expect(result.response).toContain('Mobile App Team');
      expect(jarvisAgent.getCompanies().length).toBe(1);
    });

    it('should handle direct response', async () => {
      (mockLLMClient.chat as ReturnType<typeof vi.fn>).mockResolvedValue({
        content: 'ACTION: direct_response\nRESPONSE: Hello! How can I help you today?',
        stopReason: 'end_turn',
        usage: { inputTokens: 100, outputTokens: 50 },
      });

      const result = await jarvisAgent.processRequest('Hello');

      expect(result.success).toBe(true);
      expect(result.response).toContain('Hello');
      expect(result.delegatedTo).toBeUndefined();
    });

    it('should handle errors gracefully', async () => {
      (mockLLMClient.chat as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('API failure'));

      const escalationHandler = vi.fn();
      jarvisAgent.setHumanEscalationHandler(escalationHandler);

      const result = await jarvisAgent.processRequest('Test request');

      expect(result.success).toBe(false);
      expect(result.escalatedToHuman).toBe(true);
      expect(result.humanEscalationReason).toContain('API failure');
      expect(escalationHandler).toHaveBeenCalled();
    });

    it('should handle delegation to non-existent company', async () => {
      (mockLLMClient.chat as ReturnType<typeof vi.fn>).mockResolvedValue({
        content: 'ACTION: delegate\nCOMPANY_ID: nonexistent',
        stopReason: 'end_turn',
        usage: { inputTokens: 100, outputTokens: 50 },
      });

      const result = await jarvisAgent.processRequest('Do something');

      expect(result.success).toBe(false);
      expect(result.response).toContain('not found');
    });
  });

  describe('conversation tracking', () => {
    it('should track conversation history', async () => {
      (mockLLMClient.chat as ReturnType<typeof vi.fn>).mockResolvedValue({
        content: 'ACTION: direct_response\nRESPONSE: Hello!',
        stopReason: 'end_turn',
        usage: { inputTokens: 100, outputTokens: 50 },
      });

      await jarvisAgent.processRequest('Hi there');

      const conversation = jarvisAgent.getConversation();
      expect(conversation.length).toBe(2); // User + Jarvis
      expect(conversation[0].role).toBe('user');
      expect(conversation[0].message).toBe('Hi there');
      expect(conversation[1].role).toBe('jarvis');
    });

    it('should clear conversation history', async () => {
      (mockLLMClient.chat as ReturnType<typeof vi.fn>).mockResolvedValue({
        content: 'ACTION: direct_response\nRESPONSE: Hello!',
        stopReason: 'end_turn',
        usage: { inputTokens: 100, outputTokens: 50 },
      });

      await jarvisAgent.processRequest('Message 1');
      await jarvisAgent.processRequest('Message 2');

      expect(jarvisAgent.getConversation().length).toBe(4);

      jarvisAgent.clearConversation();
      expect(jarvisAgent.getConversation().length).toBe(0);
    });

    it('should include context in conversation when delegating', async () => {
      const mockCEO = {
        executeGoal: vi.fn().mockResolvedValue({
          success: true,
          projects: [],
          completedProjects: 0,
          failedProjects: 0,
          escalatedToHuman: false,
        } as CEOResult),
        getActiveProjects: vi.fn().mockReturnValue([]),
      } as unknown as CEOAgent;

      jarvisAgent.registerCompany({
        id: 'context-company',
        name: 'Context Co',
        domain: 'Testing',
        ceo: mockCEO,
        createdAt: new Date(),
        status: 'active',
      });

      (mockLLMClient.chat as ReturnType<typeof vi.fn>).mockResolvedValue({
        content: 'ACTION: delegate\nCOMPANY_ID: context-company',
        stopReason: 'end_turn',
        usage: { inputTokens: 100, outputTokens: 50 },
      });

      await jarvisAgent.processRequest('Do work');

      const conversation = jarvisAgent.getConversation();
      const jarvisMessage = conversation.find((c) => c.role === 'jarvis');
      expect(jarvisMessage?.context?.companyId).toBe('context-company');
    });
  });

  describe('status report', () => {
    it('should generate status with multiple companies', async () => {
      const mockCEO1 = {
        getActiveProjects: vi.fn().mockReturnValue([
          { title: 'Project A', status: 'in_progress', priority: 'high' },
        ]),
      } as unknown as CEOAgent;

      const mockCEO2 = {
        getActiveProjects: vi.fn().mockReturnValue([]),
      } as unknown as CEOAgent;

      jarvisAgent.registerCompany({
        id: 'company1',
        name: 'Company One',
        domain: 'Domain 1',
        ceo: mockCEO1,
        createdAt: new Date(),
        status: 'active',
      });

      jarvisAgent.registerCompany({
        id: 'company2',
        name: 'Company Two',
        domain: 'Domain 2',
        ceo: mockCEO2,
        createdAt: new Date(),
        status: 'paused',
      });

      (mockLLMClient.chat as ReturnType<typeof vi.fn>).mockResolvedValue({
        content: 'ACTION: status',
        stopReason: 'end_turn',
        usage: { inputTokens: 100, outputTokens: 50 },
      });

      const result = await jarvisAgent.processRequest('status');

      expect(result.success).toBe(true);
      expect(result.response).toContain('Company One');
      expect(result.response).toContain('Company Two');
      expect(result.response).toContain('Project A');
      expect(result.response).toContain('Active Companies');
    });
  });

  describe('human escalation', () => {
    it('should propagate escalation from CEO', async () => {
      const mockCEO = {
        executeGoal: vi.fn().mockResolvedValue({
          success: false,
          projects: [{ title: 'Blocked Project', status: 'blocked', priority: 'high' }],
          completedProjects: 0,
          failedProjects: 1,
          escalatedToHuman: true,
          humanEscalationReason: 'Need human decision',
        } as CEOResult),
        getActiveProjects: vi.fn().mockReturnValue([]),
      } as unknown as CEOAgent;

      jarvisAgent.registerCompany({
        id: 'escalating-company',
        name: 'Escalating Co',
        domain: 'Testing',
        ceo: mockCEO,
        createdAt: new Date(),
        status: 'active',
      });

      (mockLLMClient.chat as ReturnType<typeof vi.fn>).mockResolvedValue({
        content: 'ACTION: delegate\nCOMPANY_ID: escalating-company',
        stopReason: 'end_turn',
        usage: { inputTokens: 100, outputTokens: 50 },
      });

      const result = await jarvisAgent.processRequest('Complex task');

      expect(result.success).toBe(false);
      expect(result.escalatedToHuman).toBe(true);
      expect(result.humanEscalationReason).toBe('Need human decision');
    });
  });
});
