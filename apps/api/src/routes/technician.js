import { Router } from 'express';
import { z } from 'zod';
import { Complaint } from '../models.js';
import { asyncRoute } from '../helpers.js';
import { authenticate, requireRole } from '../security.js';

const router = Router();
const update = z.object({ status: z.enum(['assigned', 'in_progress', 'waiting_parts', 'resolved', 'closed']) });

router.use(authenticate, requireRole('technician'));
router.get('/complaints', asyncRoute(async (req, res) => {
  const complaints = await Complaint.find({ technician_id: req.user._id }).populate('user_id', 'full_name phone email').populate('order_id', 'order_number').sort({ updated_at: -1 }).lean();
  res.json({ complaints });
}));
router.patch('/complaints/:id', asyncRoute(async (req, res) => {
  const complaint = await Complaint.findOneAndUpdate({ _id: req.params.id, technician_id: req.user._id }, { $set: update.parse(req.body) }, { new: true, runValidators: true });
  if (!complaint) return res.status(404).json({ error: 'Assigned complaint not found' });
  req.app.get('io').to('user:' + complaint.user_id.toString()).emit('complaint_updated', { ticket_number: complaint.ticket_number, status: complaint.status });
  res.json({ complaint });
}));
export default router;
