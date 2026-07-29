import { Router } from 'express';
import { z } from 'zod';
import { Complaint, Order, Product } from '../models.js';
import { authenticate } from '../security.js';
import { appSettings, asyncRoute, notifyAdmins, referenceNumber } from '../helpers.js';

const router = Router();
const address = z.object({
  name: z.string().min(2).max(120),
  phone: z.string().min(7).max(25),
  email: z.string().email().max(160),
  address: z.string().min(6).max(500),
  city: z.string().min(2).max(80),
  pincode: z.string().min(4).max(10),
  state: z.string().min(2).max(80)
});
const checkout = z.object({
  items: z.array(z.object({ product_id: z.string().regex(/^[a-f0-9]{24}$/i), quantity: z.coerce.number().int().min(1).max(10) })).min(1).max(20),
  delivery_address: address,
  payment_method: z.enum(['cod', 'bank_transfer'])
});
const complaintInput = z.object({
  order_id: z.string().regex(/^[a-f0-9]{24}$/i).optional().or(z.literal('')),
  category: z.string().min(2).max(80),
  description: z.string().min(10).max(4000),
  priority: z.enum(['low', 'normal', 'high', 'urgent']).default('normal')
});

router.post('/orders', authenticate, asyncRoute(async (req, res) => {
  const input = checkout.parse(req.body);
  const requested = new Map();
  input.items.forEach(item => requested.set(item.product_id, (requested.get(item.product_id) || 0) + item.quantity));
  const products = await Product.find({ _id: { $in: [...requested.keys()] }, is_active: true }).lean();
  if (products.length !== requested.size) return res.status(400).json({ error: 'One or more items are not available' });
  const byId = new Map(products.map(product => [product._id.toString(), product]));
  for (const [id, quantity] of requested) {
    const product = byId.get(id);
    if (!product || product.stock < quantity) return res.status(409).json({ error: 'Insufficient stock for ' + (product?.name || 'an item') });
  }
  const decremented = [];
  try {
    for (const [id, quantity] of requested) {
      const result = await Product.updateOne({ _id: id, stock: { $gte: quantity } }, { $inc: { stock: -quantity } });
      if (result.modifiedCount !== 1) throw new Error('Stock changed while checkout was processing');
      decremented.push({ id, quantity });
    }
    const items = [...requested].map(([id, quantity]) => {
      const product = byId.get(id);
      return { product_id: product._id, name: product.name, price: product.discount_price ?? product.price, quantity, image: product.images?.[0] || '' };
    });
    const subtotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
    const settings = await appSettings();
    const shipping = subtotal >= settings.free_shipping_threshold ? 0 : settings.flat_shipping_fee;
    const tax = Math.round(subtotal * settings.gst_rate) / 100;
    const order = await Order.create({
      order_number: referenceNumber('SWS-ORD'),
      user_id: req.user._id,
      items, subtotal, shipping_amount: shipping, tax_amount: tax, total: subtotal + shipping + tax,
      delivery_address: input.delivery_address, payment_method: input.payment_method
    });
    const message = 'New order ' + order.order_number + ' from ' + input.delivery_address.name + ' for INR ' + order.total;
    await notifyAdmins(req.app.get('io'), 'new_order', message, '/admin/orders', 'New SWS order ' + order.order_number,
      '<h2>New order ' + order.order_number + '</h2><p><strong>Customer:</strong> ' + input.delivery_address.name + '<br><strong>Phone:</strong> ' + input.delivery_address.phone + '<br><strong>Address:</strong> ' + input.delivery_address.address + ', ' + input.delivery_address.city + ', ' + input.delivery_address.state + ' ' + input.delivery_address.pincode + '<br><strong>Total:</strong> INR ' + order.total + '<br><strong>Payment:</strong> ' + order.payment_method + '</p><p>' + items.map(item => item.name + ' x ' + item.quantity).join('<br>') + '</p>');
    res.status(201).json({ order });
  } catch (error) {
    await Promise.all(decremented.map(item => Product.updateOne({ _id: item.id }, { $inc: { stock: item.quantity } })));
    throw error;
  }
}));

router.get('/orders', authenticate, asyncRoute(async (req, res) => {
  const orders = await Order.find({ user_id: req.user._id }).sort({ created_at: -1 }).lean();
  res.json({ orders });
}));

router.get('/orders/:number', authenticate, asyncRoute(async (req, res) => {
  const filter = req.roles.includes('admin') ? { order_number: req.params.number } : { order_number: req.params.number, user_id: req.user._id };
  const order = await Order.findOne(filter).populate('user_id', 'full_name email phone').lean();
  if (!order) return res.status(404).json({ error: 'Order not found' });
  res.json({ order });
}));

router.post('/complaints', authenticate, asyncRoute(async (req, res) => {
  const input = complaintInput.parse(req.body);
  if (input.order_id) {
    const order = await Order.findOne({ _id: input.order_id, user_id: req.user._id });
    if (!order) return res.status(404).json({ error: 'Order not found' });
  }
  const complaint = await Complaint.create({
    ticket_number: referenceNumber('SWS-TKT'),
    user_id: req.user._id,
    order_id: input.order_id || undefined,
    category: input.category,
    description: input.description,
    priority: input.priority
  });
  await notifyAdmins(req.app.get('io'), 'new_complaint', 'New ' + complaint.priority + ' complaint ' + complaint.ticket_number, '/admin/complaints',
    'New SWS complaint ' + complaint.ticket_number, '<h2>New complaint</h2><p>' + complaint.ticket_number + ' — ' + complaint.category + '</p><p>' + complaint.description + '</p>');
  res.status(201).json({ complaint });
}));

router.get('/complaints', authenticate, asyncRoute(async (req, res) => {
  const complaints = await Complaint.find({ user_id: req.user._id }).populate('order_id', 'order_number').sort({ created_at: -1 }).lean();
  res.json({ complaints });
}));

router.get('/track/:number', asyncRoute(async (req, res) => {
  const number = req.params.number.trim().toUpperCase();
  const order = await Order.findOne({ order_number: number }).select('order_number status payment_status payment_method created_at').lean();
  if (order) return res.json({ type: 'order', record: order });
  const complaint = await Complaint.findOne({ ticket_number: number }).select('ticket_number category status priority created_at updated_at').lean();
  if (complaint) return res.json({ type: 'complaint', record: complaint });
  res.status(404).json({ error: 'No order or complaint matches that number' });
}));

export default router;
