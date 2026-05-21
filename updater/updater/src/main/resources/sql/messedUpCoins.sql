WITH per_symbol AS (
    SELECT
        symbol,
        toUnixTimestamp64Milli(min(timestamp)) AS start_ts,
        toUnixTimestamp64Milli(max(timestamp)) AS end_ts,
        count() AS row_count
    FROM finscope.market_data
    GROUP BY symbol
),
consensus AS (
    SELECT
        (SELECT start_ts FROM per_symbol GROUP BY start_ts ORDER BY count() DESC LIMIT 1) AS c_start,
        (SELECT end_ts FROM per_symbol GROUP BY end_ts ORDER BY count() DESC LIMIT 1) AS c_end,
        (SELECT row_count FROM per_symbol GROUP BY row_count ORDER BY count() DESC LIMIT 1) AS c_rows
)

SELECT 
    symbol,
    start_ts,
    end_ts,
    row_count,
    start_ts != (SELECT c_start FROM consensus) AS bad_start,
    end_ts != (SELECT c_end FROM consensus) AS bad_end,
    row_count != (SELECT c_rows FROM consensus) AS bad_count

FROM per_symbol
WHERE start_ts != (SELECT c_start FROM consensus)
   OR end_ts != (SELECT c_end FROM consensus)
   OR row_count != (SELECT c_rows FROM consensus)

FORMAT JSON;




