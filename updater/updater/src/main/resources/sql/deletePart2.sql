ALTER TABLE finscope.market_data
DELETE WHERE symbol = '${symbol}'
SETTINGS mutations_sync = 2
FORMAT JSON;
