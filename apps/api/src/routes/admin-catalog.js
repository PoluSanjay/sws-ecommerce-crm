import { Router } from 'express';
import { z } from 'zod';
import { Category, Product } from '../models.js';
import { asyncRoute } from '../helpers.js';
import { authenticate, requireRole } from '../security.js';
import { upload, uploadBuffer } from '../upload.js';

const router = Router();

const categoryInput = z.object({
  name: z.string().min(2).max(100),
  slug: z.string().regex(/^[a-z0-9-]+$/).max(100),
  description: z.string().max(500).optional(),
  image_url: z.string().max(500).optional()
});

const productInput = z.object({
  name: z.string().min(2).max(160),
  slug: z.string().regex(/^[a-z0-9-]+$/).max(160),
  description: z.string().min(10).max(8000),
  price: z.coerce.number().min(0),
  discount_price: z.union([z.coerce.number().min(0), z.literal('')]).optional(),
  stock: z.coerce.number().int().min(0),
  category_id: z.string().regex(/^[a-f0-9]{24}$/i),
  is_active: z.union([z.boolean(), z.literal('true'), z.literal('false')]).optional(),
  specifications: z.any().optional(),
  existing_images: z.any().optional()
});

function parseJson(value, fallback) {
  if (value === undefined || value === '') return fallback;
  if (typeof value === 'object') return value;
  try { return JSON.parse(value); } catch { return fallback; }
}

// Keeps already-saved Cloudinary URLs, drops dead Render /uploads/ links.
function keepImages(list) {
  return Array.isArray(list)
    ? list.filter(url => typeof url === 'string' && /^https?:\/\//.test(url) && !url.includes('/uploads/'))
    : [];
}

async function normalProduct(body, files) {
  const data = productInput.parse(body);
  const specifications = parseJson(data.specifications, {});
  const oldImages = keepImages(parseJson(data.existing_images, []));
  const uploaded = [];
  for (const file of files || []) {
    uploaded.push(await uploadBuffer(file.buffer, 'sws/products'));
  }
  return {
    name: data.name,
    slug: data.slug,
    description: data.description,
    price: data.price,
    discount_price: data.discount_price === '' ? undefined : data.discount_price,
    stock: data.stock,
    category_id: data.category_id,
    is_active: data.is_active === undefined ? true : data.is_active === true || data.is_active === 'true',
    specifications: specifications && typeof specifications === 'object' ? specifications : {},
    images: [...oldImages, ...uploaded]
  };
}

router.use(authenticate, requireRole('admin'));

router.post('/categories', asyncRoute(async (req, res) => {
  const category = await Category.create(categoryInput.parse(req.body));
  res.status(201).json({ category });
}));

router.put('/categories/:id', asyncRoute(async (req, res) => {
  const category = await Category.findByIdAndUpdate(req.params.id, categoryInput.parse(req.body), { new: true, runValidators: true });
  if (!category) return res.status(404).json({ error: 'Category not found' });
  res.json({ category });
}));

router.delete('/categories/:id', asyncRoute(async (req, res) => {
  if (await Product.exists({ category_id: req.params.id })) return res.status(409).json({ error: 'Move products out of this category before deleting it' });
  const result = await Category.findByIdAndDelete(req.params.id);
  if (!result) return res.status(404).json({ error: 'Category not found' });
  res.status(204).end();
}));

router.get('/products', asyncRoute(async (req, res) => {
  const products = await Product.find().populate('category_id', 'name slug').sort({ created_at: -1 }).lean();
  res.json({ products });
}));

router.post('/products', upload.array('images', 6), asyncRoute(async (req, res) => {
  const values = await normalProduct(req.body, req.files);
  if (!(await Category.exists({ _id: values.category_id }))) return res.status(400).json({ error: 'Select a valid category' });
  const product = await Product.create(values);
  res.status(201).json({ product });
}));

router.put('/products/:id', upload.array('images', 6), asyncRoute(async (req, res) => {
  const values = await normalProduct(req.body, req.files);
  const product = await Product.findByIdAndUpdate(req.params.id, values, { new: true, runValidators: true });
  if (!product) return res.status(404).json({ error: 'Product not found' });
  res.json({ product });
}));

router.delete('/products/:id', asyncRoute(async (req, res) => {
  const product = await Product.findByIdAndDelete(req.params.id);
  if (!product) return res.status(404).json({ error: 'Product not found' });
  res.status(204).end();
}));

export default router;
