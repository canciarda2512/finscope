CREATE TABLE IF NOT EXISTS finscope.trades
(
    id        String,
    userId    String,
    symbol    String,
    type      String,   -- 'buy' | 'sell'
    price     Float64,
    quantity  Float64,
    total     Float64,
    timestamp DateTime64(3, 'UTC')
)
ENGINE = ReplacingMergeTree()
ORDER BY (userId, timestamp);
