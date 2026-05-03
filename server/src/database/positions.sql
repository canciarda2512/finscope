CREATE TABLE IF NOT EXISTS finscope.positions
(
    userId     String,
    symbol     String,
    quantity   Float64,
    entryPrice Float64
)
ENGINE = ReplacingMergeTree()
ORDER BY (userId, symbol);
