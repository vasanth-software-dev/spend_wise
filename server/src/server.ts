import { createApp } from './app.js';
import { env } from './config/env.js';
import { connectDatabase, disconnectDatabase } from './config/database.js';
import { initRedis } from './config/redis.js';
import { categoryRepository } from './repositories/CategoryRepository.js';
import { emailSyncJob } from './jobs/EmailSyncJob.js';

async function bootstrap() {
  try {
    // 1. Connect to Database
    await connectDatabase();

    // 2. Initialize Redis (with in-memory fallback)
    initRedis();

    // 3. Seed default system categories if empty
    await categoryRepository.ensureDefaultCategories();

    // 4. Create and start HTTP server
    const app = createApp();
    const server = app.listen(env.PORT, "0.0.0.0", () => {
      console.log(`🚀 SpendWise API running on http://localhost:${env.PORT}`);
      console.log(`🔒 Health check at http://localhost:${env.PORT}/api/health`);
    });

    // 5. Start 24/7 Background Email Synchronization Engine
    emailSyncJob.start();

    // Graceful Shutdown
    const shutdown = async (signal: string) => {
      console.log(`\nReceived ${signal}. Shutting down gracefully...`);
      emailSyncJob.stop();
      server.close(async () => {
        await disconnectDatabase();
        console.log('SpendWise API process terminated cleanly.');
        process.exit(0);
      });
    };

    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('SIGTERM', () => shutdown('SIGTERM'));
  } catch (error) {
    console.error('Failed to start SpendWise server:', error);
    process.exit(1);
  }
}

bootstrap();
