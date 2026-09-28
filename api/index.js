const { createApp } = require('../server/dist/app.js');
const { connectDatabase } = require('../server/dist/config/database.js');
const { initRedis } = require('../server/dist/config/redis.js');
const { categoryRepository } = require('../server/dist/repositories/CategoryRepository.js');

let appPromise = null;

async function getApp() {
  if (!appPromise) {
    appPromise = (async () => {
      try {
        await connectDatabase();
      } catch (err) {
        console.error('Database connection error in serverless:', err);
      }

      try {
        initRedis();
      } catch (err) {
        console.warn('Redis init error in serverless:', err);
      }

      try {
        await categoryRepository.ensureDefaultCategories();
      } catch (err) {
        console.warn('Warning ensuring default categories:', err);
      }

      return createApp();
    })();
  }
  return appPromise;
}

module.exports = async (req, res) => {
  try {
    const app = await getApp();

    // Vercel rewrites may alter req.url to '/api' or '/api/index'
    // Normalize req.url to match original requested endpoint for Express routes
    const originalUrl = req.headers['x-matched-path'] || req.originalUrl || req.url;
    if (originalUrl && originalUrl.startsWith('/api') && req.url !== originalUrl) {
      req.url = originalUrl;
    }

    return app(req, res);
  } catch (err) {
    console.error('Serverless function error:', err);
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({
      success: false,
      message: 'Internal Server Error',
      error: process.env.NODE_ENV === 'production' ? undefined : err.message,
    }));
  }
};
