/**
 * Memory Bounds Tests
 *
 * Tests to ensure that growing collections are properly bounded
 * to prevent memory leaks in long-running processes.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Agent, AgentConfig } from '../../src/agents/base/agent.js';
import { Channel } from '../../src/core/messaging/channel.js';
import { LLMClient } from '../../src/core/llm/client.js';

describe('Memory Bounds Tests', () => {
  describe('Agent Conversation History Bounds', () => {
    let mockLLMClient: LLMClient;
    let agent: Agent;

    beforeEach(() => {
      mockLLMClient = {
        chat: vi.fn().mockResolvedValue({ content: 'Response' }),
      } as unknown as LLMClient;

      const config: AgentConfig = {
        name: 'TestAgent',
        role: 'test',
        systemPrompt: 'You are a test agent.',
        llmClient: mockLLMClient,
      };

      agent = new Agent(config);
    });

    it('should limit conversation history to MAX_HISTORY_SIZE', async () => {
      // MAX_HISTORY_SIZE is 100 in Agent class
      // Each processMessage adds 2 entries (user + assistant)
      // So 60 messages should add 120 entries, but be limited to 100

      for (let i = 0; i < 60; i++) {
        await agent.processMessage(`Message ${i}`);
      }

      const history = agent.getHistory();
      expect(history.length).toBeLessThanOrEqual(100);
    });

    it('should preserve recent messages when history is truncated', async () => {
      // Add many messages
      for (let i = 0; i < 60; i++) {
        await agent.processMessage(`Message ${i}`);
      }

      const history = agent.getHistory();

      // The most recent messages should be preserved
      // Each processMessage adds user message then assistant response
      const lastUserMessage = history.filter((m) => m.role === 'user').pop();
      expect(lastUserMessage?.content).toBe('Message 59');
    });

    it('should handle clearHistory correctly', async () => {
      await agent.processMessage('Test message');
      expect(agent.getHistory().length).toBeGreaterThan(0);

      agent.clearHistory();
      expect(agent.getHistory().length).toBe(0);
    });
  });

  describe('Channel Message History Bounds', () => {
    it('should limit message history to maxHistorySize', () => {
      const channel = new Channel({
        name: 'test-channel',
        maxHistorySize: 10,
      });

      // Publish 20 messages
      for (let i = 0; i < 20; i++) {
        channel.publish('agent-1', 'topic', `Message ${i}`);
      }

      const history = channel.getHistory();
      expect(history.length).toBe(10);

      // Should have the most recent messages
      expect(history[0].content).toBe('Message 10');
      expect(history[9].content).toBe('Message 19');
    });

    it('should use default maxHistorySize of 1000', () => {
      const channel = new Channel({
        name: 'test-channel',
      });

      // Publish 1100 messages
      for (let i = 0; i < 1100; i++) {
        channel.publish('agent-1', 'topic', `Message ${i}`);
      }

      const history = channel.getHistory();
      expect(history.length).toBe(1000);
    });

    it('should properly clean up on destroy', () => {
      const channel = new Channel({
        name: 'test-channel',
      });

      // Add subscriptions and messages
      const callback = vi.fn();
      channel.subscribe('agent-1', 'topic', callback);
      channel.publish('agent-1', 'topic', 'Test message');

      expect(channel.getSubscriptions().length).toBe(1);
      expect(channel.getHistory().length).toBe(1);

      // Destroy the channel
      channel.destroy();

      expect(channel.getSubscriptions().length).toBe(0);
      expect(channel.getHistory().length).toBe(0);
    });

    it('should not retain history when retainHistory is false', () => {
      const channel = new Channel({
        name: 'test-channel',
        retainHistory: false,
      });

      channel.publish('agent-1', 'topic', 'Message 1');
      channel.publish('agent-1', 'topic', 'Message 2');

      expect(channel.getHistory().length).toBe(0);
    });
  });

  describe('Channel getHistory Performance', () => {
    it('should efficiently filter with multiple criteria', () => {
      const channel = new Channel({
        name: 'test-channel',
        maxHistorySize: 1000,
      });

      // Publish messages from different agents with different topics
      for (let i = 0; i < 100; i++) {
        const agent = `agent-${i % 3}`;
        const topic = `topic-${i % 5}`;
        channel.publish(agent, topic, `Message ${i}`);
      }

      // Test filtering by multiple criteria
      const filtered = channel.getHistory({
        from: 'agent-0',
        topic: 'topic-0',
        limit: 10,
      });

      // Should return messages that match both criteria
      filtered.forEach((msg) => {
        expect(msg.from).toBe('agent-0');
        expect(msg.topic).toBe('topic-0');
      });

      expect(filtered.length).toBeLessThanOrEqual(10);
    });

    it('should return a copy of messages to prevent mutation', () => {
      const channel = new Channel({
        name: 'test-channel',
      });

      channel.publish('agent-1', 'topic', 'Original message');

      const history1 = channel.getHistory();
      const history2 = channel.getHistory();

      // Should be different array references
      expect(history1).not.toBe(history2);

      // But contain same data
      expect(history1).toEqual(history2);
    });
  });
});
