import express from 'express';
import request from 'supertest';
import { expect, it, vi } from 'vitest';
import { registerSignCommentRoutes } from './sign-comment-routes.js';
it('sign-comments REQ-004: session, feature and Origin protect discussion routes', async () => {
  const app = express();
  app.use(express.json());
  const list = vi.fn().mockResolvedValue({ comments: [], nextCursor: null });
  registerSignCommentRoutes(app, {
    enabled: true,
    allowedOrigin: 'http://localhost:5173',
    resolve: () => Promise.resolve(null),
    record: vi.fn(),
    feature: { list, submit: vi.fn(), people: vi.fn(), react: vi.fn() },
    attachments: {
      initiate: vi.fn(),
      complete: vi.fn(),
      download: vi.fn(),
      thumbnail: vi.fn(),
      discard: vi.fn(),
      cleanup: vi.fn(),
    },
  });
  const path =
    '/api/sites/f38e482b-7956-4ec8-bbae-3545e0540264/signs/f38e482b-7956-4ec8-bbae-3545e0540264/comments';
  expect((await request(app).get(path)).status).toBe(401);
  expect(
    (
      await request(app)
        .post(path)
        .set('Origin', 'https://attacker.test')
        .send({})
    ).status,
  ).toBe(403);
  expect(list).not.toHaveBeenCalled();
});
