CREATE TABLE IF NOT EXISTS finscope.strategy_actions
(
    id         String,
    strategyId String,
    type       String,   -- 'buy' | 'sell' | 'sell_all' | 'close_position'
    quantity   Float64
)
ENGINE = ReplacingMergeTree()
ORDER BY (strategyId, id);
