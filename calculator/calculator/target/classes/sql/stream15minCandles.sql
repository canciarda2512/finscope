WITH Aggregated15Min AS (
    SELECT
        symbol,
        toStartOfInterval(timestamp, INTERVAL 15 MINUTE) AS interval_time,
        argMin(open, timestamp) AS o,
        max(high) AS h,
        min(low) AS l,
        argMax(close, timestamp) AS c,
        sum(volume) AS v
    FROM finscope.market_data
    WHERE volume > 0
    GROUP BY symbol, interval_time
)
SELECT 
    symbol, 
    toUnixTimestamp64Milli(CAST(interval_time AS DateTime64(3, 'UTC'))) AS timestamp, 
    o AS open, 
    h AS high, 
    l AS low, 
    c AS close, 
    v AS volume
FROM (
    SELECT *,
           row_number() OVER (PARTITION BY symbol ORDER BY interval_time DESC) as rn
    FROM Aggregated15Min
)
WHERE rn <= 10
ORDER BY symbol ASC, timestamp ASC
FORMAT RowBinaryWithNamesAndTypes;