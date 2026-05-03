CREATE TABLE IF NOT EXISTS finscope.alerts
(
    id          String,
    userId      String,
    symbol      String,
    condition   String,   -- '>' | '<'
    targetPrice Float64,
    triggered   UInt8 DEFAULT 0,
    triggeredAt Nullable(DateTime64(3, 'UTC')),
    missedAt    Nullable(DateTime64(3, 'UTC')),
    createdAt   DateTime64(3, 'UTC')
)
ENGINE = ReplacingMergeTree()
ORDER BY (userId, id);
