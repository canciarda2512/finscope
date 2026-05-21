SELECT count() AS remaining
FROM finscope.market_data
WHERE symbol = '${symbol}'
FORMAT JSON;