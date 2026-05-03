import crypto from 'crypto';
import { execute, insert, query } from './ClickHouseClient.js';

let publishNotification = null;

function nowClickHouse() {
  return new Date().toISOString().replace('T', ' ').replace('Z', '');
}

export function setNotificationPublisher(publisher) {
  publishNotification = typeof publisher === 'function' ? publisher : null;
}

/**
 * Insert a new notification for a user.
 * Called fire-and-forget from trade/order handlers — errors are non-fatal.
 */
export async function createNotification({ userId, type, title, message, symbol = '' }) {
  const id = crypto.randomUUID();
  const notification = {
    id,
    userId,
    type,
    title,
    message,
    symbol,
    isRead: 0,
    createdAt: nowClickHouse(),
  };

  console.log(`[Notification] Creating: type=${type} userId=${userId} id=${id}`);
  await insert('notifications', [notification]);
  console.log(`[Notification] Inserted: ${id}`);

  if (publishNotification) {
    publishNotification(notification);
  }

  return notification;
}

/**
 * Fetch the last `limit` notifications for a user (newest first).
 * Returns notifications array + current unread count.
 */
export async function getNotifications(userId, limit = 30) {
  const { rows } = await query(
    `
    SELECT id, type, title, message, symbol, isRead, createdAt
    FROM notifications FINAL
    WHERE userId = {userId:String}
    ORDER BY createdAt DESC
    LIMIT {limit:UInt32}
    `,
    { userId, limit }
  );

  const unreadCount = rows.filter(r => Number(r.isRead) === 0).length;
  return { notifications: rows, unreadCount };
}

/**
 * Count only unread notifications — used for lightweight badge polling.
 */
export async function getUnreadCount(userId) {
  const { rows } = await query(
    `
    SELECT count() AS cnt
    FROM notifications FINAL
    WHERE userId = {userId:String}
      AND isRead = 0
    `,
    { userId }
  );
  return Number(rows[0]?.cnt || 0);
}

/**
 * Mark all of a user's notifications as read.
 */
export async function markAllAsRead(userId) {
  await execute(
    `
    ALTER TABLE notifications
    UPDATE isRead = 1
    WHERE userId = {userId:String}
      AND isRead = 0
    `,
    { userId }
  );
}

/**
 * Mark a single notification as read.
 */
export async function markAsRead(userId, id) {
  await execute(
    `
    ALTER TABLE notifications
    UPDATE isRead = 1
    WHERE userId = {userId:String}
      AND id = {id:String}
    `,
    { userId, id }
  );
}
