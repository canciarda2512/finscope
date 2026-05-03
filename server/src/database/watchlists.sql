CREATE TABLE IF NOT EXISTS finscope.watchlists
(
    userId    String,
    symbol    String,
    createdAt DateTime64(3, 'UTC')
)
ENGINE = ReplacingMergeTree()
ORDER BY (userId, symbol);
