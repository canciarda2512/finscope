CREATE TABLE IF NOT EXISTS finscope.strategies
(
    id                 String,
    userId             String,
    name               String,
    isActive           UInt8 DEFAULT 0,
    lastBacktestResult String DEFAULT '',  -- JSON string
    createdAt          DateTime64(3, 'UTC')
)
ENGINE = ReplacingMergeTree()
ORDER BY (userId, id);
