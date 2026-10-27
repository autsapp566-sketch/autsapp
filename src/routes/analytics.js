import express from 'express';
import { authenticate, attachUser } from '../middleware/auth.js';
import { requireAgent } from '../middleware/requireAgent.js';
import { requirePermission } from '../middleware/requirePermission.js';
import { getAnalyticsOverview } from '../services/analytics.js';

const router = express.Router();

router.use(authenticate, attachUser, requireAgent, requirePermission('analytics'));

router.get('/overview', async (req, res, next) => {
  try {
    // Agents restricted to some WhatsApp numbers only get statistics of those numbers.
    const overview = await getAnalyticsOverview({ instanceIds: req.user.instanceIds });
    res.json(overview);
  } catch (err) {
    next(err);
  }
});

export default router;
