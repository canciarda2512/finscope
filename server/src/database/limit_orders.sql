CREATE TABLE IF NOT EXISTS finscope.limit_orders
(
    id          String,
    userId      String,
    symbol      String,
    type        String,   -- 'buy' | 'sell'
    targetPrice Float64,
    quantity    Float64,
    status      String DEFAULT 'pending',   -- 'pending' | 'executed' | 'cancelled'
    notifiedAt  Nullable(DateTime64(3, 'UTC')),
    createdAt   DateTime64(3, 'UTC')
)
ENGINE = ReplacingMergeTree()
ORDER BY (userId, id);
