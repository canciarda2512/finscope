SELECT 
    count() AS frequency,               
    total_rows,                         
    toUnixTimestamp64Milli(min(first_ts)) AS start_boundary,    
    toUnixTimestamp64Milli(max(last_ts)) AS end_boundary        
FROM (
    SELECT 
        symbol, 
        count() AS total_rows, 
        min(timestamp) AS first_ts, 
        max(timestamp) AS last_ts
    FROM finscope.market_data
    GROUP BY symbol
)
GROUP BY total_rows
ORDER BY frequency DESC
FORMAT JSON;