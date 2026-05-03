CREATE TABLE IF NOT EXISTS finscope.drawings
(
    id          String,
    userId      String,
    symbol      String,
    timeframe   String,
    type        String,   -- 'trendline' | 'hline'
    coordinates String,   -- JSON string
    createdAt   DateTime64(3, 'UTC')
)
ENGINE = ReplacingMergeTree()
ORDER BY (userId, symbol, id);
