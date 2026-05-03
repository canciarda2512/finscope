CREATE TABLE IF NOT EXISTS finscope.market_data
(
    symbol    String,
    timestamp DateTime64(3, 'UTC'),
    open      Float64,
    high      Float64,
    low       Float64,
    close     Float64,
    volume    Float64
)
ENGINE = ReplacingMergeTree()
PARTITION BY toYYYYMM(timestamp)
ORDER BY (symbol, timestamp);
