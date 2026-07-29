import { Router } from 'express';
import { z } from 'zod';
import { AppSettings, Complaint, Notification, Order, PaymentSettings, Product, User } from '../models.js';
import { appSettings, asyncRoute, publicUser } from '../helpers.js';
import { authenticate, requireRole, rolesFor, setRoles } from '../security.js';

const router = Router();
const orderUpdate = z.object({
  status: z.enum(['pending', 'confirmed', 'shipped', 'delivered', 'cancelled']).optional(),
  payment_status: z.enum(['pending', 'paid', 'failed']).optional()
});
const complaintUpdate = z.object({
  status: z.enum(['open', 'assigned', 'in_progress', 'waiting_parts', 'resolved', 'closed']).optional(),
  priority: z.enum(['low', 'normal', 'high', 'urgent']).optional(),
  technician_id: z.string().regex(/^[a-f0-9]{24}$/i).nullable().optional()
});
const paymentInput = z.object({
  upi_id: z.string().max(120).optional(),
  bank_name: z.string().max(160).optional(),
  account_name: z.string().max(160).optional(),
  account_number: z.string().max(80).optional(),
  ifsc: z.string().max(30).optional(),
  instructions: z.string().max(2000).optional()
});
const settingInput = z.object({
  free_shipping_threshold: z.coerce.number().min(0),
  flat_shipping_fee: z.coerce.number().min(0),
  gst_rate: z.coerce.number().min(0).max(100),
  smtp: z.object({
    host: z.string().max(200).optional(),
    port: z.coerce.number().int().min(1).max(65535).optional(),
    secure: z.boolean().optional(),
    user: z.string().max(200).optional(),
    pass: z.string().max(500).optional(),
    from: z.string().max(300).optional(),
    notification_email: z.string().email().max(200).optional().or(z.literal(''))
  }).optional()
});

router.use(authenticate, requireRole('admin'));

router.get('/dashboard', asyncRoute(async (req, res) => {
  const [products, pendingOrders, openComplaints, users, recentOrders, recentComplaints] = await Promise.all([
    Product.countDocuments(), Order.countDocuments({ status: { $in: ['pending', 'confirmed'] } }),
    Complaint.countDocuments({ status: { $in: ['open', 'assigned', 'in_progress', 'waiting_parts'] } }),
    User.countDocuments(), Order.find().sort({ created_at: -1 }).limit(6).populate('user_id', 'full_name email').lean(),
    Complaint.find().sort({ created_at: -1 }).limit(6).populate('user_id', 'full_name').populate('technician_id', 'full_name').lean()
  ]);
  res.json({ stats: { products, pendingOrders, openComplaints, users }, recentOrders, recentComplaints });
}));

router.get('/orders', asyncRoute(async (req, res) => {
  const filter = req.query.status ? { status: req.query.status } : {};
  const orders = await Order.find(filter).populate('user_id', 'full_name email phone').sort({ created_at: -1 }).lean();
  res.json({ orders });
}));
router.patch('/orders/:id', asyncRoute(async (req, res) => {
  const changes = orderUpdate.parse(req.body);
  const existing = await Order.findById(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Order not found' });
  const resultingPayment = changes.payment_status || existing.payment_status;
  if (changes.status === 'confirmed' && existing.payment_method === 'bank_transfer' && resultingPayment !== 'paid') {
    return res.status(409).json({ error: 'Verify the bank transfer before confirming this order' });
  }
  Object.assign(existing, changes);
  await existing.save();
  req.app.get('io').to('user:' + existing.user_id.toString()).emit('order_updated', { order_number: existing.order_number, status: existing.status, payment_status: existing.payment_status });
  res.json({ order: existing });
}));

router.get('/complaints', asyncRoute(async (req, res) => {
  const complaints = await Complaint.find().populate('user_id', 'full_name email phone').populate('order_id', 'order_number').populate('technician_id', 'full_name email').sort({ created_at: -1 }).lean();
  res.json({ complaints });
}));
router.patch('/complaints/:id', asyncRoute(async (req, res) => {
  const changes = complaintUpdate.parse(req.body);
  if (changes.technician_id) {
    const tech = await User.findById(changes.technician_id);
    if (!tech || !(await rolesFor(tech._id)).includes('technician')) return res.status(400).json({ error: 'Assigned user must be a technician' });
    if (!changes.status) changes.status = 'assigned';
  }
  const complaint = await Complaint.findByIdAndUpdate(req.params.id, { $set: changes }, { new: true, runValidators: true });
  if (!complaint) return res.status(404).json({ error: 'Complaint not found' });
  req.app.get('io').to('user:' + complaint.user_id.toString()).emit('complaint_updated', { ticket_number: complaint.ticket_number, status: complaint.status });
  if (complaint.technician_id) req.app.get('io').to('user:' + complaint.technician_id.toString()).emit('complaint_assigned', { ticket_number: complaint.ticket_number });
  res.json({ complaint });
}));

router.get('/payment', asyncRoute(async (req, res) => {
  const payment = await PaymentSettings.findOneAndUpdate({ singleton: 'default' }, { $setOnInsert: { singleton: 'default' } }, { new: true, upsert: true });
  res.json({ payment });
}));
router.put('/payment', asyncRoute(async (req, res) => {
  const payment = await PaymentSettings.findOneAndUpdate({ singleton: 'default' }, { $set: paymentInput.parse(req.body), $setOnInsert: { singleton: 'default' } }, { new: true, upsert: true, runValidators: true });
  res.json({ payment });
}));

router.get('/settings', asyncRoute(async (req, res) => {
  const settings = await appSettings();
  const plain = settings.toObject();
  if (plain.smtp?.pass) plain.smtp.pass = '••••••••';
  res.json({ settings: plain });
}));
router.put('/settings', asyncRoute(async (req, res) => {
  const input = settingInput.parse(req.body);
  const current = await appSettings();
  const smtp = { ...(current.smtp?.toObject?.() || current.smtp || {}), ...(input.smtp || {}) };
  if (input.smtp?.pass === '••••••••' || input.smtp?.pass === '') smtp.pass = current.smtp?.pass;
  const settings = await AppSettings.findByIdAndUpdate(current._id, { $set: { free_shipping_threshold: input.free_shipping_threshold, flat_shipping_fee: input.flat_shipping_fee, gst_rate: input.gst_rate, smtp } }, { new: true, runValidators: true });
  const plain = settings.toObject();
  if (plain.smtp?.pass) plain.smtp.pass = '••••••••';
  res.json({ settings: plain });
}));

router.get('/users', asyncRoute(async (req, res) => {
  const users = await User.find().sort({ created_at: -1 }).limit(500).lean();
  const records = await Promise.all(users.map(async user => ({ ...publicUser(user), created_at: user.created_at, roles: await rolesFor(user._id) })));
  res.json({ users: records });
}));
router.patch('/users/:id/roles', asyncRoute(async (req, res) => {
  const roles = z.object({ roles: z.array(z.enum(['admin', 'technician', 'customer'])).min(1) }).parse(req.body).roles;
  if (req.user._id.toString() === req.params.id && !roles.includes('admin')) return res.status(400).json({ error: 'You cannot remove your own admin role' });
  if (!(await User.exists({ _id: req.params.id }))) return res.status(404).json({ error: 'User not found' });
  await setRoles(req.params.id, roles);
  res.status(204).end();
}));

router.get('/notifications', asyncRoute(async (req, res) => {
  const notifications = await Notification.find({ user_id: req.user._id }).sort({ created_at: -1 }).limit(50).lean();
  res.json({ notifications });
}));
router.patch('/notifications/:id/read', asyncRoute(async (req, res) => {
  await Notification.updateOne({ _id: req.params.id, user_id: req.user._id }, { $set: { is_read: true } });
  res.status(204).end();
}));

export default router;
