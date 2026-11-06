import * as Joi from 'joi';

export const validationSchema = Joi.object({
  NODE_ENV: Joi.string()
    .valid('development', 'test', 'production')
    .default('development'),
  PORT: Joi.number().port().default(3000),

  DB_HOST: Joi.string().required(),
  DB_PORT: Joi.number().port().default(5432),
  DB_USER: Joi.string().required(),
  DB_PASSWORD: Joi.string().required(),
  DB_NAME: Joi.string().required(),
  DB_SSL: Joi.boolean().default(false),
  DB_POOL_MAX: Joi.number().integer().min(1).max(100).default(20),
  DB_POOL_IDLE_TIMEOUT_MS: Joi.number().integer().min(0).default(30000),
  DB_POOL_CONNECTION_TIMEOUT_MS: Joi.number().integer().min(0).default(5000),

  IGDB_CLIENT_ID: Joi.string().allow('').optional(),
  IGDB_CLIENT_SECRET: Joi.string().allow('').optional(),
  IGDB_ADMIN_SECRET: Joi.string().allow('').optional(),
  IGDB_API_URL: Joi.string().uri().optional(),
  IGDB_TOKEN_URL: Joi.string().uri().optional(),
  IGDB_TIMEOUT_MS: Joi.number().integer().min(1000).max(120000).optional(),

  STEAM_API_KEY: Joi.string().allow('').optional(),
  STEAM_REALM_URI: Joi.string().uri().optional(),
  STEAM_API_BASE_URL: Joi.string().uri().optional(),
  STEAM_COUNTRY_CODE: Joi.string().length(2).optional(),
  STEAM_LANGUAGE: Joi.string().optional(),
  STEAM_TIMEOUT_MS: Joi.number().integer().min(1000).optional(),
  STEAM_MAX_RETRIES: Joi.number().integer().min(1).max(10).optional(),
  STEAM_CACHE_TTL_MS: Joi.number().integer().min(0).optional(),
  STEAM_BATCH_SIZE: Joi.number().integer().min(1).max(100).optional(),
  STEAM_CONCURRENCY: Joi.number().integer().min(1).max(16).optional(),
  STEAM_INTER_BATCH_DELAY_MS: Joi.number().integer().min(0).optional(),
  STEAM_CACHE_MAX_ENTRIES: Joi.number()
    .integer()
    .min(100)
    .max(200000)
    .optional(),
  STEAM_ADMIN_SECRET: Joi.string().allow('').optional(),

  PRICE_SYNC_CRON: Joi.string().allow('').optional(),
  PRICE_SYNC_ENABLED: Joi.boolean().default(true),
  PRICE_SYNC_BATCH_SIZE: Joi.number().integer().min(1).max(5000).optional(),
  PRICE_SYNC_STORE_NAMES: Joi.string().allow('').optional(),
  PRICE_SYNC_ADMIN_SECRET: Joi.string().allow('').optional(),
  PRICE_SYNC_CATALOG_PAGES: Joi.number().integer().min(0).max(200).optional(),
  PRICE_SYNC_LOCK_TIMEOUT_SECONDS: Joi.number()
    .integer()
    .min(60)
    .max(86400)
    .optional(),
  PRICE_SYNC_REQUEST_DELAY_MS: Joi.number()
    .integer()
    .min(0)
    .max(5000)
    .optional(),
  PRICE_SYNC_MAX_FAILURE_RATE: Joi.number().min(0).max(1).optional(),

  ADMIN_SYNC_SECRET: Joi.string().allow('').optional(),
  SYNC_RANDOM_COUNT: Joi.number().integer().min(1).max(100).optional(),
  SYNC_RANDOM_PLATFORMS: Joi.string().allow('').optional(),

  GOOGLE_CLIENT_ID: Joi.string().allow('').optional(),
  GOOGLE_CLIENT_SECRET: Joi.string().allow('').optional(),
  GOOGLE_CALLBACK_URI: Joi.string().uri().optional(),

  CORS_ORIGIN: Joi.string().allow('').optional(),
});
