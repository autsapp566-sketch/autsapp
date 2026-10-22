import express from 'express';
import { authenticate, attachUser } from '../middleware/auth.js';
import { requirePermission } from '../middleware/requirePermission.js';
import { requireAgent } from '../middleware/requireAgent.js';
import {
  createKnowledgeItem,
  deleteKnowledgeItem,
  generateKnowledgeWithCopilot,
  listKnowledgeItems,
  updateKnowledgeItem,
} from '../services/knowledgeBase.js';
import { uploadProductImages } from '../middleware/productUpload.js';
import { saveUploadedImage } from '../services/uploadedImages.js';
import { analyzeProductImages } from '../services/productVision.js';

const router = express.Router();

router.use(authenticate, attachUser, requireAgent);

function requestBaseUrl(req) {
  const proto = String(req.headers['x-forwarded-proto'] ?? req.protocol ?? 'https')
    .split(',')[0]
    .trim();
  const host = String(req.headers['x-forwarded-host'] ?? req.get('host') ?? '')
    .split(',')[0]
    .trim();
  return `${proto}://${host}`;
}

router.post('/upload-images', requirePermission('knowledgeEdit'), (req, res, next) => {
  uploadProductImages.array('images', 12)(req, res, async (err) => {
    if (err) {
      return next(err);
    }
    try {
      const base = requestBaseUrl(req);
      const urls = [];
      for (const file of req.files ?? []) {
        const id = await saveUploadedImage(file.buffer, file.mimetype);
        urls.push(`${base}/api/uploads/images/${id}`);
      }
      res.status(201).json({ urls });
    } catch (saveErr) {
      next(saveErr);
    }
  });
});

/** Fill title / description / colors from product photos (OpenAI vision). */
router.post('/analyze-images', requirePermission('knowledgeEdit'), async (req, res, next) => {
  try {
    const result = await analyzeProductImages(req.body?.imageUrls);
    res.json(result);
  } catch (err) {
    if (!err.status) {
      err.expose = true;
    }
    next(err);
  }
});

router.get('/', requirePermission('knowledge', 'knowledgeEdit'), async (req, res, next) => {
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

router.post('/', requirePermission('knowledgeEdit'), async (req, res, next) => {
  try {
    const item = await createKnowledgeItem(req.body ?? {});
    res.status(201).json({ item });
  } catch (err) {
    next(err);
  }
});

router.post('/ai-copilot', requirePermission('knowledgeEdit'), async (req, res, next) => {
  try {
    const items = await generateKnowledgeWithCopilot(req.body?.brief);
    res.status(201).json({ items, message: `تم توليد ${items.length} عنصر` });
  } catch (err) {
    next(err);
  }
});

router.patch('/:id', requirePermission('knowledgeEdit'), async (req, res, next) => {
  try {
    const item = await updateKnowledgeItem(req.params.id, req.body ?? {});
    res.json({ item });
  } catch (err) {
    next(err);
  }
});

router.delete('/:id', requirePermission('knowledgeEdit'), async (req, res, next) => {
  try {
    await deleteKnowledgeItem(req.params.id);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

export default router;
