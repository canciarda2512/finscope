CREATE TABLE IF NOT EXISTS finscope.users
(
    id           String,
    username     String,
    email        String,
    passwordHash String,
    refreshToken String,
    theme        String DEFAULT 'dark',
    createdAt    DateTime64(3, 'UTC')
)
ENGINE = ReplacingMergeTree()
ORDER BY (id);
