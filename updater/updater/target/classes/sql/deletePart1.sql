SELECT count() AS rows_to_delete
FROM finscope.market_data
WHERE symbol = '${symbol}'
FORMAT JSON;
