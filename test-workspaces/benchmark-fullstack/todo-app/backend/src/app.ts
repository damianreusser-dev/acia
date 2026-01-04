import express, { Express } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { healthRouter } from './routes/health.js';
import { todosRouter } from './routes/todos.js';
import { errorHandler } from './middleware/error-handler.js';

export function createApp(): Express {
  const app = express();

  // Security middleware
  app.use(helmet());
  app.use(cors());

  // Body parsing
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // Routes
  app.use('/api/health', healthRouter);
  app.use('/api/todos', todosRouter);

  // Error handling
  app.use(errorHandler);

  return app;
}
