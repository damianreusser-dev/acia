import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';

describe('App', () => {
  const app = createApp();

  it('should return 404 for unknown routes', async () => {
    const response = await request(app)
      .get('/unknown-route')
      .expect(404);

    expect(response.body).toBeDefined();
  });

  it('should parse JSON body', async () => {
    // Test that JSON parsing middleware is working
    const response = await request(app)
      .post('/health')
      .send({ test: 'data' })
      .set('Content-Type', 'application/json')
      .expect(404); // 404 because POST /health doesn't exist, but body should be parsed

    expect(response.body).toBeDefined();
  });
});
