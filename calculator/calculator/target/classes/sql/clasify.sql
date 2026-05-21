SELECT
    symbol,
    argMax(close, timestamp) AS last_close,
    max(timestamp) AS last_update
FROM finscope.market_data
GROUP BY symbol
ORDER BY last_close ASC 
FORMAT JSON;