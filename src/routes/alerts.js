import express from 'express';
import { authenticate, attachUser } from '../middleware/auth.js';
import { requireAdmin } from '../middleware/requireAdmin.js';
import { listAdminAlerts } from '../services/adminAlerts.js';

const router = express.Router();

router.use(authenticate, attachUser, requireAdmin);

/** Admin-only system alerts (e.g. a bot reply that WhatsApp refused to deliver). */
router.get('/', async (req, res, next) => {
  try {
    const parsed = typeof req.query.after === 'string' ? new Date(req.query.after) : null;
    const after = parsed && !Number.isNaN(parsed.getTime()) ? parsed : null;
    res.json({ alerts: await listAdminAlerts(after) });
  } catch (err) {
    next(err);
  }
});

export default router;
