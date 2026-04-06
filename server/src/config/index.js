import dotenv from 'dotenv'
  dotenv.config()

  export const config = {
    port: process.env.PORT || 4000,
    jwtSecret: process.env.JWT_SECRET,
    jwtRefreshSecret: process.env.JWT_REFRESH_SECRET,
    redis: {
      host: process.env.REDIS_HOST || 'localhost',
      port: process.env.REDIS_PORT || 6379
    },
    clickhouse: {
      host: process.env.CLICKHOUSE_HOST || 'localhost',
      port: process.env.CLICKHOUSE_PORT || 8123,
      database: process.env.CLICKHOUSE_DATABASE || 'finscope'
    },
    binance: {
      restUrl: process.env.BINANCE_REST_URL,
      wsUrl: process.env.BINANCE_WS_URL
    },
    aiServiceUrl: process.env.AI_SERVICE_URL
  }
