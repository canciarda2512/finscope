SELECT count(DISTINCT symbol) AS total_unique_coins
FROM finscope.market_data
FORMAT JSON;