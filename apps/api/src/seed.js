import 'dotenv/config';
import mongoose from 'mongoose';
import { AppSettings, Category, PaymentSettings, Product } from './models.js';
import { ensureCoreRoles } from './security.js';

const uri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/sujala_water_solutions';
await mongoose.connect(uri);
await ensureCoreRoles();
await AppSettings.updateOne({ singleton: 'default' }, { $setOnInsert: { singleton: 'default', free_shipping_threshold: 5000, flat_shipping_fee: 99, gst_rate: 0 } }, { upsert: true });
await PaymentSettings.updateOne({ singleton: 'default' }, { $setOnInsert: { singleton: 'default', instructions: 'Transfer payment and wait for an SWS admin to verify it before the order is confirmed.' } }, { upsert: true });
const categories = [
  { name: 'RO Water Purifiers', slug: 'ro-water-purifiers', description: 'Advanced RO purification systems for homes.' },
  { name: 'UV & UF Purifiers', slug: 'uv-uf-purifiers', description: 'Reliable UV and UF purification solutions.' },
  { name: 'Accessories & Filters', slug: 'accessories-filters', description: 'Replacement filters and essential accessories.' }
];
for (const value of categories) await Category.updateOne({ slug: value.slug }, { $setOnInsert: value }, { upsert: true });
const ro = await Category.findOne({ slug: 'ro-water-purifiers' });
await Product.updateOne({ slug: 'sws-aqua-prime-ro' }, { $setOnInsert: {
  name: 'SWS Aqua Prime RO', slug: 'sws-aqua-prime-ro', description: 'Premium 7-stage RO + UV water purifier with a high-capacity storage tank.',
  price: 14999, discount_price: 12999, stock: 12, category_id: ro._id, images: [], specifications: { 'Purification': 'RO + UV + UF', 'Storage': '10 L', 'Warranty': '12 months' }, is_active: true
} }, { upsert: true });
console.log('SWS roles, settings, categories and sample product seeded');
await mongoose.disconnect();
