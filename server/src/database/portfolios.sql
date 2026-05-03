CREATE TABLE IF NOT EXISTS finscope.portfolios
(
    userId      String,
    balance     Float64 DEFAULT 100000,
    totalPnL    Float64 DEFAULT 0,
    sharpeRatio Float64 DEFAULT 0,
    maxDrawdown Float64 DEFAULT 0,
    winRate     Float64 DEFAULT 0
)
ENGINE = ReplacingMergeTree()
ORDER BY (userId);
