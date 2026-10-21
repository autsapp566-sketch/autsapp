import express from 'express';
import { authenticate, attachUser } from '../middleware/auth.js';
import { requireAdmin } from '../middleware/requireAdmin.js';
import { requireAgent } from '../middleware/requireAgent.js';
import {
  createKnowledgeItem,
  deleteKnowledgeItem,
  generateKnowledgeWithCopilot,
  listKnowledgeItems,
  updateKnowledgeItem,
} from '../services/knowledgeBase.js';
import { uploadProductImages } from '../middleware/productUpload.js';

const router = express.Router();

router.use(authenticate, attachUser, requireAgent);

router.post('/upload-images', requireAdmin, (req, res, next) => {
  uploadProductImages.array('images', 12)(req, res, (err) => {
    if (err) {
      return next(err);
    }
    const urls = (req.files ?? []).map((f) => `/uploads/products/${f.filename}`);
    res.status(201).json({ urls });
  });
});

router.get('/', async (req, res, next) => {
  try {
    const filter = typeof req.query.type === 'string' ? req.query.type.toLowerCase() : 'all';
    const [items, allItems] = await Promise.all([
      listKnowledgeItems(filter),
      filter === 'all' ? Promise.resolve(null) : listKnowledgeItems('all'),
    ]);
    const forCounts = allItems ?? items;
    const products = forCounts.filter((i) => i.type === 'PRODUCT');
    const faqs = forCounts.filter((i) => i.type === 'FAQ');
    res.json({
      items,
      counts: { all: forCounts.length, product: products.length, faq: faqs.length },
    });
  } catch (err) {
    next(err);
  }
});

router.post('/', requireAdmin, async (req, res, next) => {
  try {
    const item = await createKnowledgeItem(req.body ?? {});
    res.status(201).json({ item });
  } catch (err) {
    next(err);
  }
});

router.post('/ai-copilot', requireAdmin, async (req, res, next) => {
  try {
    const items = await generateKnowledgeWithCopilot(req.body?.brief);
    res.status(201).json({ items, message: `تم توليد ${items.length} عنصر` });
  } catch (err) {
    next(err);
  }
});

router.patch('/:id', requireAdmin, async (req, res, next) => {
  try {
    const item = await updateKnowledgeItem(req.params.id, req.body ?? {});
    res.json({ item });
  } catch (err) {
    next(err);
  }
});

router.delete('/:id', requireAdmin, async (req, res, next) => {
  try {
    await deleteKnowledgeItem(req.params.id);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

export default router;
