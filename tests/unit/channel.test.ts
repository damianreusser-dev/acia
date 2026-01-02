/**
 * Unit tests for Communication Channel
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Channel, ChannelManager } from '../../src/core/messaging/channel.js';

describe('Channel', () => {
  let channel: Channel;

  beforeEach(() => {
    channel = new Channel({
      name: 'test-channel',
      description: 'Test channel for unit tests',
    });
  });

  describe('constructor', () => {
    it('should create channel with name and description', () => {
      const ch = new Channel({
        name: 'my-channel',
        description: 'My test channel',
      });

      expect(ch.name).toBe('my-channel');
      expect(ch.description).toBe('My test channel');
    });

    it('should default description to empty string', () => {
      const ch = new Channel({ name: 'minimal' });
      expect(ch.description).toBe('');
    });
  });

  describe('subscribe', () => {
    it('should subscribe to a topic and return subscription ID', () => {
      const callback = vi.fn();
      const subscriptionId = channel.subscribe('agent1', 'updates', callback);

      expect(subscriptionId).toMatch(/^sub_/);
    });

    it('should call callback when message is published to topic', () => {
      const callback = vi.fn();
      channel.subscribe('agent1', 'updates', callback);

      channel.publish('agent2', 'updates', 'Hello!');

      expect(callback).toHaveBeenCalledTimes(1);
      expect(callback).toHaveBeenCalledWith(
        expect.objectContaining({
          from: 'agent2',
          topic: 'updates',
          content: 'Hello!',
        })
      );
    });

    it('should not call callback for different topic', () => {
      const callback = vi.fn();
      channel.subscribe('agent1', 'updates', callback);

      channel.publish('agent2', 'alerts', 'Alert!');

      expect(callback).not.toHaveBeenCalled();
    });
  });

  describe('subscribeAll', () => {
    it('should receive messages from all topics', () => {
      const callback = vi.fn();
      channel.subscribeAll('agent1', callback);

      channel.publish('sender', 'topic1', 'Message 1');
      channel.publish('sender', 'topic2', 'Message 2');

      expect(callback).toHaveBeenCalledTimes(2);
    });
  });

  describe('unsubscribe', () => {
    it('should stop receiving messages after unsubscribe', () => {
      const callback = vi.fn();
      const subId = channel.subscribe('agent1', 'updates', callback);

      channel.publish('agent2', 'updates', 'Before');
      expect(callback).toHaveBeenCalledTimes(1);

      channel.unsubscribe(subId);

      channel.publish('agent2', 'updates', 'After');
      expect(callback).toHaveBeenCalledTimes(1); // Still 1
    });

    it('should return false for non-existent subscription', () => {
      const result = channel.unsubscribe('fake-id');
      expect(result).toBe(false);
    });

    it('should return true for valid subscription', () => {
      const subId = channel.subscribe('agent1', 'topic', vi.fn());
      const result = channel.unsubscribe(subId);
      expect(result).toBe(true);
    });
  });

  describe('unsubscribeAgent', () => {
    it('should remove all subscriptions for an agent', () => {
      const cb1 = vi.fn();
      const cb2 = vi.fn();
      const cb3 = vi.fn();

      channel.subscribe('agent1', 'topic1', cb1);
      channel.subscribe('agent1', 'topic2', cb2);
      channel.subscribe('agent2', 'topic1', cb3);

      const removed = channel.unsubscribeAgent('agent1');

      expect(removed).toBe(2);

      channel.publish('sender', 'topic1', 'Test');
      expect(cb1).not.toHaveBeenCalled();
      expect(cb2).not.toHaveBeenCalled();
      expect(cb3).toHaveBeenCalledTimes(1);
    });
  });

  describe('publish', () => {
    it('should return message object with ID', () => {
      const message = channel.publish('agent1', 'topic', 'Content');

      expect(message.id).toMatch(/^msg_/);
      expect(message.from).toBe('agent1');
      expect(message.topic).toBe('topic');
      expect(message.content).toBe('Content');
      expect(message.timestamp).toBeInstanceOf(Date);
    });

    it('should include optional fields', () => {
      const message = channel.publish('agent1', 'topic', 'Content', {
        to: 'agent2',
        replyTo: 'msg_123',
        metadata: { priority: 'high' },
      });

      expect(message.to).toBe('agent2');
      expect(message.replyTo).toBe('msg_123');
      expect(message.metadata).toEqual({ priority: 'high' });
    });
  });

  describe('sendDirect', () => {
    it('should send message to specific agent', () => {
      const message = channel.sendDirect('agent1', 'agent2', 'Hello', 'chat');

      expect(message.from).toBe('agent1');
      expect(message.to).toBe('agent2');
      expect(message.topic).toBe('chat');
    });

    it('should default to direct topic', () => {
      const message = channel.sendDirect('agent1', 'agent2', 'Hello');
      expect(message.topic).toBe('direct');
    });
  });

  describe('broadcast', () => {
    it('should send message to all subscribers', () => {
      const cb1 = vi.fn();
      const cb2 = vi.fn();

      channel.subscribe('agent1', 'broadcast', cb1);
      channel.subscribe('agent2', 'broadcast', cb2);

      channel.broadcast('sender', 'Announcement');

      expect(cb1).toHaveBeenCalledTimes(1);
      expect(cb2).toHaveBeenCalledTimes(1);
    });
  });

  describe('history', () => {
    it('should retain message history', () => {
      channel.publish('a1', 't1', 'Msg 1');
      channel.publish('a2', 't2', 'Msg 2');
      channel.publish('a3', 't1', 'Msg 3');

      const history = channel.getHistory();
      expect(history.length).toBe(3);
    });

    it('should filter history by topic', () => {
      channel.publish('a1', 'topic1', 'Msg 1');
      channel.publish('a2', 'topic2', 'Msg 2');
      channel.publish('a3', 'topic1', 'Msg 3');

      const history = channel.getHistory({ topic: 'topic1' });
      expect(history.length).toBe(2);
    });

    it('should filter history by sender', () => {
      channel.publish('agent1', 'topic', 'Msg 1');
      channel.publish('agent2', 'topic', 'Msg 2');
      channel.publish('agent1', 'topic', 'Msg 3');

      const history = channel.getHistory({ from: 'agent1' });
      expect(history.length).toBe(2);
    });

    it('should filter history by recipient', () => {
      channel.sendDirect('a1', 'agent2', 'Msg 1');
      channel.sendDirect('a2', 'agent3', 'Msg 2');
      channel.sendDirect('a3', 'agent2', 'Msg 3');

      const history = channel.getHistory({ to: 'agent2' });
      expect(history.length).toBe(2);
    });

    it('should filter history by time', () => {
      channel.publish('a1', 'topic', 'Old message');

      const cutoff = new Date();

      // Small delay to ensure timestamps differ
      channel.publish('a2', 'topic', 'New message');

      const history = channel.getHistory({ since: cutoff });
      expect(history.length).toBeGreaterThanOrEqual(1);
    });

    it('should limit history results', () => {
      for (let i = 0; i < 10; i++) {
        channel.publish('agent', 'topic', `Message ${i}`);
      }

      const history = channel.getHistory({ limit: 3 });
      expect(history.length).toBe(3);
      expect(history[0].content).toBe('Message 7');
    });

    it('should clear history', () => {
      channel.publish('a1', 't1', 'Message');
      expect(channel.getHistory().length).toBe(1);

      channel.clearHistory();
      expect(channel.getHistory().length).toBe(0);
    });
  });

  describe('getMessage', () => {
    it('should get message by ID', () => {
      const published = channel.publish('agent', 'topic', 'Test');
      const retrieved = channel.getMessage(published.id);

      expect(retrieved).toEqual(published);
    });

    it('should return undefined for non-existent message', () => {
      expect(channel.getMessage('fake-id')).toBeUndefined();
    });
  });

  describe('getThread', () => {
    it('should get message thread with replies', () => {
      const root = channel.publish('a1', 'topic', 'Root message');
      channel.publish('a2', 'topic', 'Reply 1', { replyTo: root.id });
      channel.publish('a3', 'topic', 'Reply 2', { replyTo: root.id });

      const thread = channel.getThread(root.id);
      expect(thread.length).toBe(3);
      expect(thread[0].content).toBe('Root message');
    });

    it('should return empty array for non-existent message', () => {
      expect(channel.getThread('fake-id')).toEqual([]);
    });
  });

  describe('subscriptions', () => {
    it('should get all subscriptions', () => {
      channel.subscribe('a1', 'topic1', vi.fn());
      channel.subscribe('a2', 'topic2', vi.fn());

      const subs = channel.getSubscriptions();
      expect(subs.length).toBe(2);
    });

    it('should get subscriptions for specific agent', () => {
      channel.subscribe('agent1', 'topic1', vi.fn());
      channel.subscribe('agent1', 'topic2', vi.fn());
      channel.subscribe('agent2', 'topic1', vi.fn());

      const subs = channel.getAgentSubscriptions('agent1');
      expect(subs.length).toBe(2);
    });
  });

  describe('getStats', () => {
    it('should return channel statistics', () => {
      channel.subscribe('a1', 'topic1', vi.fn());
      channel.subscribe('a2', 'topic2', vi.fn());
      channel.publish('sender', 'topic1', 'Msg');

      const stats = channel.getStats();

      expect(stats.name).toBe('test-channel');
      expect(stats.subscriptionCount).toBe(2);
      expect(stats.historySize).toBe(1);
      expect(stats.topics).toContain('topic1');
      expect(stats.topics).toContain('topic2');
    });
  });

  describe('history limits', () => {
    it('should respect maxHistorySize', () => {
      const limitedChannel = new Channel({
        name: 'limited',
        maxHistorySize: 5,
      });

      for (let i = 0; i < 10; i++) {
        limitedChannel.publish('agent', 'topic', `Message ${i}`);
      }

      const history = limitedChannel.getHistory();
      expect(history.length).toBe(5);
      expect(history[0].content).toBe('Message 5');
    });

    it('should not retain history when disabled', () => {
      const noHistoryChannel = new Channel({
        name: 'no-history',
        retainHistory: false,
      });

      noHistoryChannel.publish('agent', 'topic', 'Message');
      expect(noHistoryChannel.getHistory().length).toBe(0);
    });
  });
});

describe('ChannelManager', () => {
  let manager: ChannelManager;

  beforeEach(() => {
    manager = new ChannelManager();
  });

  describe('createChannel', () => {
    it('should create and return a channel', () => {
      const channel = manager.createChannel({ name: 'test' });

      expect(channel).toBeInstanceOf(Channel);
      expect(channel.name).toBe('test');
    });

    it('should throw error for duplicate channel name', () => {
      manager.createChannel({ name: 'test' });

      expect(() => manager.createChannel({ name: 'test' })).toThrow(
        'Channel "test" already exists'
      );
    });
  });

  describe('getChannel', () => {
    it('should get existing channel', () => {
      const created = manager.createChannel({ name: 'test' });
      const retrieved = manager.getChannel('test');

      expect(retrieved).toBe(created);
    });

    it('should return undefined for non-existent channel', () => {
      expect(manager.getChannel('nonexistent')).toBeUndefined();
    });
  });

  describe('getOrCreateChannel', () => {
    it('should return existing channel', () => {
      const created = manager.createChannel({ name: 'test' });
      const retrieved = manager.getOrCreateChannel({ name: 'test' });

      expect(retrieved).toBe(created);
    });

    it('should create channel if not exists', () => {
      const channel = manager.getOrCreateChannel({
        name: 'new-channel',
        description: 'New',
      });

      expect(channel.name).toBe('new-channel');
      expect(manager.getChannel('new-channel')).toBe(channel);
    });
  });

  describe('deleteChannel', () => {
    it('should delete existing channel', () => {
      manager.createChannel({ name: 'test' });
      const result = manager.deleteChannel('test');

      expect(result).toBe(true);
      expect(manager.getChannel('test')).toBeUndefined();
    });

    it('should return false for non-existent channel', () => {
      expect(manager.deleteChannel('nonexistent')).toBe(false);
    });

    it('should clear subscriptions when deleting', () => {
      const channel = manager.createChannel({ name: 'test' });
      const callback = vi.fn();
      channel.subscribe('agent', 'topic', callback);

      manager.deleteChannel('test');

      // Subscriptions should be cleared
      expect(channel.getSubscriptions().length).toBe(0);
    });
  });

  describe('listChannels', () => {
    it('should list all channel names', () => {
      manager.createChannel({ name: 'channel1' });
      manager.createChannel({ name: 'channel2' });
      manager.createChannel({ name: 'channel3' });

      const channels = manager.listChannels();

      expect(channels).toContain('channel1');
      expect(channels).toContain('channel2');
      expect(channels).toContain('channel3');
      expect(channels.length).toBe(3);
    });
  });

  describe('getAllStats', () => {
    it('should get stats for all channels', () => {
      const ch1 = manager.createChannel({ name: 'channel1' });
      const ch2 = manager.createChannel({ name: 'channel2' });

      ch1.subscribe('agent', 'topic', vi.fn());
      ch2.publish('sender', 'topic', 'Message');

      const allStats = manager.getAllStats();

      expect(allStats.length).toBe(2);
      expect(allStats.find((s) => s.name === 'channel1')?.subscriptionCount).toBe(1);
      expect(allStats.find((s) => s.name === 'channel2')?.historySize).toBe(1);
    });
  });

  describe('broadcastToAll', () => {
    it('should broadcast to all channels', () => {
      const cb1 = vi.fn();
      const cb2 = vi.fn();

      const ch1 = manager.createChannel({ name: 'channel1' });
      const ch2 = manager.createChannel({ name: 'channel2' });

      ch1.subscribe('agent1', 'system', cb1);
      ch2.subscribe('agent2', 'system', cb2);

      manager.broadcastToAll('sender', 'System message');

      expect(cb1).toHaveBeenCalledTimes(1);
      expect(cb2).toHaveBeenCalledTimes(1);
    });
  });
});
