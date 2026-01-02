/**
 * Cache Tests
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import {
  LRUCache,
  LLMResponseCache,
} from '../../src/core/cache/cache.js';

describe('LRUCache', () => {
  describe('Basic Operations', () => {
    it('should set and get values', () => {
      const cache = new LRUCache<string>();

      cache.set('key1', 'value1');
      expect(cache.get('key1')).toBe('value1');
    });

    it('should return undefined for missing keys', () => {
      const cache = new LRUCache<string>();
      expect(cache.get('nonexistent')).toBeUndefined();
    });

    it('should check if key exists', () => {
      const cache = new LRUCache<string>();

      cache.set('key1', 'value1');
      expect(cache.has('key1')).toBe(true);
      expect(cache.has('key2')).toBe(false);
    });

    it('should delete keys', () => {
      const cache = new LRUCache<string>();

      cache.set('key1', 'value1');
      expect(cache.delete('key1')).toBe(true);
      expect(cache.get('key1')).toBeUndefined();
      expect(cache.delete('key1')).toBe(false);
    });

    it('should clear all entries', () => {
      const cache = new LRUCache<string>();

      cache.set('key1', 'value1');
      cache.set('key2', 'value2');
      cache.clear();

      expect(cache.size()).toBe(0);
      expect(cache.get('key1')).toBeUndefined();
    });

    it('should report size', () => {
      const cache = new LRUCache<string>();

      expect(cache.size()).toBe(0);
      cache.set('key1', 'value1');
      expect(cache.size()).toBe(1);
      cache.set('key2', 'value2');
      expect(cache.size()).toBe(2);
    });
  });

  describe('LRU Eviction', () => {
    it('should evict oldest entry when at capacity', () => {
      const cache = new LRUCache<string>({ maxSize: 3 });

      cache.set('key1', 'value1');
      cache.set('key2', 'value2');
      cache.set('key3', 'value3');
      cache.set('key4', 'value4'); // Should evict key1

      expect(cache.get('key1')).toBeUndefined();
      expect(cache.get('key2')).toBe('value2');
      expect(cache.get('key3')).toBe('value3');
      expect(cache.get('key4')).toBe('value4');
    });

    it('should update LRU order on get', () => {
      const cache = new LRUCache<string>({ maxSize: 3 });

      cache.set('key1', 'value1');
      cache.set('key2', 'value2');
      cache.set('key3', 'value3');

      // Access key1 to make it most recently used
      cache.get('key1');

      // Add new key, should evict key2 (now oldest)
      cache.set('key4', 'value4');

      expect(cache.get('key1')).toBe('value1');
      expect(cache.get('key2')).toBeUndefined();
    });

    it('should update LRU order on set existing key', () => {
      const cache = new LRUCache<string>({ maxSize: 3 });

      cache.set('key1', 'value1');
      cache.set('key2', 'value2');
      cache.set('key3', 'value3');

      // Update key1 to make it most recently used
      cache.set('key1', 'updated');

      // Add new key, should evict key2 (now oldest)
      cache.set('key4', 'value4');

      expect(cache.get('key1')).toBe('updated');
      expect(cache.get('key2')).toBeUndefined();
    });

    it('should track evictions in stats', () => {
      const cache = new LRUCache<string>({ maxSize: 2 });

      cache.set('key1', 'value1');
      cache.set('key2', 'value2');
      cache.set('key3', 'value3');
      cache.set('key4', 'value4');

      const stats = cache.getStats();
      expect(stats.evictions).toBe(2);
    });
  });

  describe('TTL Expiration', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    it('should expire entries after TTL', () => {
      const cache = new LRUCache<string>({ ttlMs: 1000 });

      cache.set('key1', 'value1');
      expect(cache.get('key1')).toBe('value1');

      // Advance time past TTL
      vi.advanceTimersByTime(1001);

      expect(cache.get('key1')).toBeUndefined();
    });

    it('should not expire entries before TTL', () => {
      const cache = new LRUCache<string>({ ttlMs: 1000 });

      cache.set('key1', 'value1');
      vi.advanceTimersByTime(999);

      expect(cache.get('key1')).toBe('value1');
    });

    it('should prune expired entries', () => {
      const cache = new LRUCache<string>({ ttlMs: 1000 });

      cache.set('key1', 'value1');
      cache.set('key2', 'value2');

      vi.advanceTimersByTime(1001);

      const pruned = cache.prune();
      expect(pruned).toBe(2);
      expect(cache.size()).toBe(0);
    });

    it('should report expired key as not existing', () => {
      const cache = new LRUCache<string>({ ttlMs: 1000 });

      cache.set('key1', 'value1');
      vi.advanceTimersByTime(1001);

      expect(cache.has('key1')).toBe(false);
    });

    afterEach(() => {
      vi.useRealTimers();
    });
  });

  describe('Cache Stats', () => {
    it('should track hits and misses', () => {
      const cache = new LRUCache<string>();

      cache.set('key1', 'value1');
      cache.get('key1'); // Hit
      cache.get('key1'); // Hit
      cache.get('key2'); // Miss

      const stats = cache.getStats();
      expect(stats.hits).toBe(2);
      expect(stats.misses).toBe(1);
      expect(stats.hitRate).toBeCloseTo(0.667, 2);
    });

    it('should handle zero requests', () => {
      const cache = new LRUCache<string>();
      const stats = cache.getStats();

      expect(stats.hits).toBe(0);
      expect(stats.misses).toBe(0);
      expect(stats.hitRate).toBe(0);
    });

    it('should reset stats on clear', () => {
      const cache = new LRUCache<string>();

      cache.set('key1', 'value1');
      cache.get('key1');
      cache.clear();

      const stats = cache.getStats();
      expect(stats.hits).toBe(0);
      expect(stats.misses).toBe(0);
    });
  });

  describe('Enable/Disable', () => {
    it('should not return values when disabled', () => {
      const cache = new LRUCache<string>();

      cache.set('key1', 'value1');
      cache.setEnabled(false);

      expect(cache.get('key1')).toBeUndefined();
    });

    it('should not store values when disabled', () => {
      const cache = new LRUCache<string>();

      cache.setEnabled(false);
      cache.set('key1', 'value1');
      cache.setEnabled(true);

      expect(cache.get('key1')).toBeUndefined();
    });

    it('should report enabled status', () => {
      const cache = new LRUCache<string>();

      expect(cache.isEnabled()).toBe(true);
      cache.setEnabled(false);
      expect(cache.isEnabled()).toBe(false);
    });

    it('should track misses when disabled', () => {
      const cache = new LRUCache<string>();

      cache.set('key1', 'value1');
      cache.setEnabled(false);
      cache.get('key1');

      expect(cache.getStats().misses).toBe(1);
    });
  });

  describe('Key Generation', () => {
    it('should generate consistent keys for same data', () => {
      const data = { foo: 'bar', baz: 123 };
      const key1 = LRUCache.generateKey(data);
      const key2 = LRUCache.generateKey(data);

      expect(key1).toBe(key2);
    });

    it('should generate different keys for different data', () => {
      const key1 = LRUCache.generateKey({ foo: 'bar' });
      const key2 = LRUCache.generateKey({ foo: 'baz' });

      expect(key1).not.toBe(key2);
    });

    it('should generate 16-character hex keys', () => {
      const key = LRUCache.generateKey('test');
      expect(key).toMatch(/^[a-f0-9]{16}$/);
    });
  });
});

describe('LLMResponseCache', () => {
  it('should cache and retrieve LLM responses', () => {
    const cache = new LLMResponseCache();

    const messages = [{ role: 'user', content: 'Hello' }];
    const response = {
      content: 'Hi there!',
      stopReason: 'end_turn',
      usage: { inputTokens: 10, outputTokens: 5 },
    };

    cache.setResponse(messages, response);
    const cached = cache.getResponse(messages);

    expect(cached).toEqual(response);
  });

  it('should include system prompt in cache key', () => {
    const cache = new LLMResponseCache();

    const messages = [{ role: 'user', content: 'Hello' }];
    const response1 = { content: 'Response 1', stopReason: null, usage: { inputTokens: 10, outputTokens: 5 } };
    const response2 = { content: 'Response 2', stopReason: null, usage: { inputTokens: 10, outputTokens: 5 } };

    cache.setResponse(messages, response1, 'System A');
    cache.setResponse(messages, response2, 'System B');

    expect(cache.getResponse(messages, 'System A')?.content).toBe('Response 1');
    expect(cache.getResponse(messages, 'System B')?.content).toBe('Response 2');
  });

  it('should include model in cache key', () => {
    const cache = new LLMResponseCache();

    const messages = [{ role: 'user', content: 'Hello' }];
    const response1 = { content: 'Response 1', stopReason: null, usage: { inputTokens: 10, outputTokens: 5 } };
    const response2 = { content: 'Response 2', stopReason: null, usage: { inputTokens: 10, outputTokens: 5 } };

    cache.setResponse(messages, response1, undefined, 'model-a');
    cache.setResponse(messages, response2, undefined, 'model-b');

    expect(cache.getResponse(messages, undefined, 'model-a')?.content).toBe('Response 1');
    expect(cache.getResponse(messages, undefined, 'model-b')?.content).toBe('Response 2');
  });

  it('should return undefined for uncached requests', () => {
    const cache = new LLMResponseCache();

    const result = cache.getResponse([{ role: 'user', content: 'Unknown' }]);
    expect(result).toBeUndefined();
  });

  it('should generate consistent request keys', () => {
    const messages = [{ role: 'user', content: 'Hello' }];

    const key1 = LLMResponseCache.generateRequestKey(messages, 'system', 'model');
    const key2 = LLMResponseCache.generateRequestKey(messages, 'system', 'model');

    expect(key1).toBe(key2);
  });
});
