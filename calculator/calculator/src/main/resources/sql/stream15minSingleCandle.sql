SELECT * FROM (
    SELECT
        symbol,
        toUnixTimestamp64Milli(CAST(toStartOfInterval(timestamp, INTERVAL 15 MINUTE) AS DateTime64(3, 'UTC'))) AS timestamp,
        argMin(open, timestamp) AS open,
        max(high) AS high,
        min(low) AS low,
        argMax(close, timestamp) AS close,
        sum(volume) AS volume
    FROM finscope.market_data
    WHERE symbol = 'BTTCUSDT'
    GROUP BY symbol, timestamp
    ORDER BY timestamp DESC  -- 1. Get the most recent ones first
    LIMIT 15                 -- 2. Grab only the latest 15
)
ORDER BY timestamp ASC       -- 3. Flip them so the oldest of the 15 is at index 0
FORMAT RowBinaryWithNamesAndTypes;