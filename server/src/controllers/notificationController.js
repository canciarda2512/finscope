import { Router } from 'express';
import {
  getNotifications,
  getUnreadCount,
  markAllAsRead,
  markAsRead,
} from '../services/NotificationService.js';

const router = Router();

// GET /api/notifications — full list + unread count
router.get('/', async (req, res, next) => {
  try {
    const { notifications, unreadCount } = await getNotifications(req.userId);
    return res.json({ notifications, unreadCount });
  } catch (err) {
    next(err);
  }
});

// GET /api/notifications/count — lightweight badge polling
router.get('/count', async (req, res, next) => {
  try {
    const unreadCount = await getUnreadCount(req.userId);
    return res.json({ unreadCount });
  } catch (err) {
    next(err);
  }
});

// PUT /api/notifications/read-all — mark all as read
router.put('/read-all', async (req, res, next) => {
  try {
    await markAllAsRead(req.userId);
    return res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

// PUT /api/notifications/:id/read — mark single notification as read
router.put('/:id/read', async (req, res, next) => {
  try {
    await markAsRead(req.userId, req.params.id);
    return res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

export default router;
