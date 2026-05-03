CREATE TABLE IF NOT EXISTS finscope.strategy_conditions
(
    id         String,
    strategyId String,
    type       String,   -- 'indicator' | 'price' | 'volume' | 'time'
    parameter  String,
    operator   String,   -- '>' | '<' | 'crosses_above' | 'crosses_below'
    value      Float64
)
ENGINE = ReplacingMergeTree()
ORDER BY (strategyId, id);
