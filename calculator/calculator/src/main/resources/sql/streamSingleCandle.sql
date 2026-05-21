SELECT symbol, toUnixTimestamp64Milli(timestamp) AS timestamp, open, high, low, close, volume 
FROM finscope.market_data
WHERE volume > 0 AND symbol = '${symbol}'
ORDER BY timestamp ASC 
FORMAT RowBinaryWithNamesAndTypes;

