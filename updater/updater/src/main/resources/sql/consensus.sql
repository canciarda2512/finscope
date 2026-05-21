WITH per_symbol AS
(
    SELECT
        symbol,
         toUnixTimestamp64Milli(min(timestamp)) AS start_ts,
         toUnixTimestamp64Milli(max(timestamp)) AS end_ts,
        count() AS row_count
    FROM finscope.market_data
    GROUP BY symbol
)

SELECT
    (SELECT start_ts
     FROM per_symbol
     GROUP BY start_ts
     ORDER BY count() DESC
     LIMIT 1) AS consensus_start_ts,

    (SELECT end_ts
     FROM per_symbol
     GROUP BY end_ts
     ORDER BY count() DESC
     LIMIT 1) AS consensus_end_ts,

    (SELECT row_count
     FROM per_symbol
     GROUP BY row_count
     ORDER BY count() DESC
     LIMIT 1) AS consensus_row_count

FORMAT JSON;