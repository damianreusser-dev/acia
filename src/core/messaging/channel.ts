/**
 * Communication Channel
 *
 * Provides structured communication between agents.
 * Supports pub/sub messaging patterns with topic-based routing.
 */

import { EventEmitter } from 'events';

export interface Message {
  id: string;
  from: string;
  to?: string; // undefined = broadcast
  topic: string;
  content: string;
  timestamp: Date;
  replyTo?: string; // For threaded conversations
  metadata?: Record<string, unknown>;
}

export interface Subscription {
  id: string;
  agentId: string;
  topic: string;
  callback: (message: Message) => void;
}

export interface ChannelConfig {
  name: string;
  description?: string;
  retainHistory?: boolean;
  maxHistorySize?: number;
}

export class Channel {
  readonly name: string;
  readonly description: string;
  private emitter: EventEmitter;
  private subscriptions: Map<string, Subscription> = new Map();
  private history: Message[] = [];
  private retainHistory: boolean;
  private maxHistorySize: number;

  constructor(config: ChannelConfig) {
    this.name = config.name;
    this.description = config.description ?? '';
    this.emitter = new EventEmitter();
    this.retainHistory = config.retainHistory ?? true;
    this.maxHistorySize = config.maxHistorySize ?? 1000;
  }

  /**
   * Subscribe to messages on a topic
   */
  subscribe(
    agentId: string,
    topic: string,
    callback: (message: Message) => void
  ): string {
    const subscriptionId = `sub_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 8)}`;

    const subscription: Subscription = {
      id: subscriptionId,
      agentId,
      topic,
      callback,
    };

    this.subscriptions.set(subscriptionId, subscription);
    this.emitter.on(topic, callback);

    return subscriptionId;
  }

  /**
   * Subscribe to all messages on the channel
   */
  subscribeAll(
    agentId: string,
    callback: (message: Message) => void
  ): string {
    return this.subscribe(agentId, '*', callback);
  }

  /**
   * Unsubscribe from a subscription
   */
  unsubscribe(subscriptionId: string): boolean {
    const subscription = this.subscriptions.get(subscriptionId);
    if (!subscription) {
      return false;
    }

    this.emitter.off(subscription.topic, subscription.callback);
    this.subscriptions.delete(subscriptionId);
    return true;
  }

  /**
   * Unsubscribe all subscriptions for an agent
   */
  unsubscribeAgent(agentId: string): number {
    let count = 0;
    for (const [id, subscription] of this.subscriptions) {
      if (subscription.agentId === agentId) {
        this.unsubscribe(id);
        count++;
      }
    }
    return count;
  }

  /**
   * Publish a message to a topic
   */
  publish(
    from: string,
    topic: string,
    content: string,
    options?: {
      to?: string;
      replyTo?: string;
      metadata?: Record<string, unknown>;
    }
  ): Message {
    const message: Message = {
      id: `msg_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 8)}`,
      from,
      to: options?.to,
      topic,
      content,
      timestamp: new Date(),
      replyTo: options?.replyTo,
      metadata: options?.metadata,
    };

    // Store in history
    if (this.retainHistory) {
      this.history.push(message);
      if (this.history.length > this.maxHistorySize) {
        this.history.shift();
      }
    }

    // Emit to specific topic subscribers
    this.emitter.emit(topic, message);

    // Emit to wildcard subscribers
    if (topic !== '*') {
      this.emitter.emit('*', message);
    }

    return message;
  }

  /**
   * Send a direct message to a specific agent
   */
  sendDirect(
    from: string,
    to: string,
    content: string,
    topic: string = 'direct',
    replyTo?: string
  ): Message {
    return this.publish(from, topic, content, { to, replyTo });
  }

  /**
   * Broadcast a message to all subscribers
   */
  broadcast(
    from: string,
    content: string,
    topic: string = 'broadcast'
  ): Message {
    return this.publish(from, topic, content);
  }

  /**
   * Get message history
   */
  getHistory(options?: {
    topic?: string;
    from?: string;
    to?: string;
    since?: Date;
    limit?: number;
  }): Message[] {
    let messages = [...this.history];

    if (options?.topic) {
      messages = messages.filter((m) => m.topic === options.topic);
    }

    if (options?.from) {
      messages = messages.filter((m) => m.from === options.from);
    }

    if (options?.to) {
      messages = messages.filter((m) => m.to === options.to);
    }

    if (options?.since) {
      messages = messages.filter((m) => m.timestamp >= options.since!);
    }

    if (options?.limit) {
      messages = messages.slice(-options.limit);
    }

    return messages;
  }

  /**
   * Get a message by ID
   */
  getMessage(messageId: string): Message | undefined {
    return this.history.find((m) => m.id === messageId);
  }

  /**
   * Get thread (message and all replies)
   */
  getThread(messageId: string): Message[] {
    const root = this.getMessage(messageId);
    if (!root) return [];

    const thread: Message[] = [root];
    const replies = this.history.filter((m) => m.replyTo === messageId);
    thread.push(...replies);

    // Get nested replies
    for (const reply of replies) {
      const nestedReplies = this.getThread(reply.id).slice(1); // Exclude the reply itself
      thread.push(...nestedReplies);
    }

    return thread;
  }

  /**
   * Get all active subscriptions
   */
  getSubscriptions(): Subscription[] {
    return Array.from(this.subscriptions.values());
  }

  /**
   * Get subscriptions for a specific agent
   */
  getAgentSubscriptions(agentId: string): Subscription[] {
    return Array.from(this.subscriptions.values()).filter(
      (s) => s.agentId === agentId
    );
  }

  /**
   * Clear message history
   */
  clearHistory(): void {
    this.history = [];
  }

  /**
   * Get channel statistics
   */
  getStats(): {
    name: string;
    subscriptionCount: number;
    historySize: number;
    topics: string[];
  } {
    const topics = new Set<string>();
    for (const subscription of this.subscriptions.values()) {
      topics.add(subscription.topic);
    }

    return {
      name: this.name,
      subscriptionCount: this.subscriptions.size,
      historySize: this.history.length,
      topics: Array.from(topics),
    };
  }
}

/**
 * Channel Manager
 *
 * Manages multiple communication channels
 */
export class ChannelManager {
  private channels: Map<string, Channel> = new Map();

  /**
   * Create a new channel
   */
  createChannel(config: ChannelConfig): Channel {
    if (this.channels.has(config.name)) {
      throw new Error(`Channel "${config.name}" already exists`);
    }

    const channel = new Channel(config);
    this.channels.set(config.name, channel);
    return channel;
  }

  /**
   * Get a channel by name
   */
  getChannel(name: string): Channel | undefined {
    return this.channels.get(name);
  }

  /**
   * Get or create a channel
   */
  getOrCreateChannel(config: ChannelConfig): Channel {
    const existing = this.channels.get(config.name);
    if (existing) return existing;
    return this.createChannel(config);
  }

  /**
   * Delete a channel
   */
  deleteChannel(name: string): boolean {
    const channel = this.channels.get(name);
    if (!channel) return false;

    // Clear all subscriptions
    for (const subscription of channel.getSubscriptions()) {
      channel.unsubscribe(subscription.id);
    }

    return this.channels.delete(name);
  }

  /**
   * List all channels
   */
  listChannels(): string[] {
    return Array.from(this.channels.keys());
  }

  /**
   * Get all channel statistics
   */
  getAllStats(): Array<ReturnType<Channel['getStats']>> {
    return Array.from(this.channels.values()).map((c) => c.getStats());
  }

  /**
   * Broadcast to all channels
   */
  broadcastToAll(from: string, content: string, topic: string = 'system'): void {
    for (const channel of this.channels.values()) {
      channel.broadcast(from, content, topic);
    }
  }
}
