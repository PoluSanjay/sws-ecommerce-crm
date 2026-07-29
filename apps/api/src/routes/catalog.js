import { Router } from 'express';
import { z } from 'zod';
import { AppSettings, Category, PaymentSettings, Product } from '../models.js';
import { asyncRoute } from '../helpers.js';

const router = Router();
const listQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(48).default(12),
  category: z.string().max(100).optional(),
  q: z.string().max(100).optional()
});

router.get('/categories', asyncRoute(async (req, res) => {
  res.json({ categories: await Category.find().sort({ name: 1 }).lean() });
}));

router.get('/products', asyncRoute(async (req, res) => {
  const input = listQuery.parse(req.query);
  const filter = { is_active: true };
  if (input.category) {
    const category = await Category.findOne({ slug: input.category }).lean();
    if (!category) return res.json({ products: [], total: 0, page: input.page, pages: 0 });
    filter.category_id = category._id;
  }
  if (input.q?.trim()) {
    const safeQuery = input.q.trim().replace(/[.*+?^$()|[\]\\]/g, '\\$&');
    filter.$or = [{ name: new RegExp(safeQuery, 'i') }, { description: new RegExp(safeQuery, 'i') }];
  }
  const [products, total] = await Promise.all([
    Product.find(filter).populate('category_id', 'name slug').sort({ created_at: -1 }).skip((input.page - 1) * input.limit).limit(input.limit).lean(),
    Product.countDocuments(filter)
  ]);
  res.json({ products, total, page: input.page, pages: Math.ceil(total / input.limit) });
}));

router.get('/products/:slug', asyncRoute(async (req, res) => {
  const product = await Product.findOne({ slug: req.params.slug, is_active: true }).populate('category_id', 'name slug').lean();
  if (!product) return res.status(404).json({ error: 'Product not found' });
  res.json({ product });
}));

router.get('/settings/public', asyncRoute(async (req, res) => {
  const [payment, app] = await Promise.all([
    PaymentSettings.findOne({ singleton: 'default' }).lean(),
    AppSettings.findOne({ singleton: 'default' }).lean()
  ]);
  res.json({
    payment: payment ? {
      upi_id: payment.upi_id, bank_name: payment.bank_name, account_name: payment.account_name,
      account_number: payment.account_number, ifsc: payment.ifsc, instructions: payment.instructions
    } : {},
    shipping: { free_shipping_threshold: app?.free_shipping_threshold ?? 5000, flat_shipping_fee: app?.flat_shipping_fee ?? 99, gst_rate: app?.gst_rate ?? 0 }
  });
}));

export default router;
