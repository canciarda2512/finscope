CREATE TABLE IF NOT EXISTS finscope.notifications
(
    id        String,
    userId    String,
    type      String,           -- e.g. 'trade_executed' | 'limit_order_created' | 'limit_order_triggered' | 'price_alert_triggered'
    title     String,
    message   String,
    symbol    String DEFAULT '',
    isRead    UInt8  DEFAULT 0,
    createdAt DateTime64(3, 'UTC')
)
ENGINE = ReplacingMergeTree()
ORDER BY (userId, id);
