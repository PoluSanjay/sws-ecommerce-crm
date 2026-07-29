import { Router } from 'express';
import { OAuth2Client } from 'google-auth-library';
import { z } from 'zod';
import { Profile, User } from '../models.js';
import { ADMIN_EMAILS, assignRole, authenticate, ensureCoreRoles, rolesFor, signToken } from '../security.js';
import { asyncRoute, publicUser } from '../helpers.js';

const router = Router();
const registration = z.object({
  email: z.string().email().max(160),
  password: z.string().min(8).max(128),
  full_name: z.string().min(2).max(120),
  phone: z.string().max(25).optional()
});
const login = z.object({ email: z.string().email(), password: z.string().min(1) });
const profileInput = z.object({
  full_name: z.string().min(2).max(120).optional(),
  phone: z.string().max(25).optional(),
  avatar_url: z.string().url().max(500).optional().or(z.literal('')),
  address: z.string().max(500).optional(),
  city: z.string().max(80).optional(),
  pincode: z.string().max(10).optional(),
  state: z.string().max(80).optional()
});

function response(user, roles) {
  return { token: signToken(user), user: publicUser(user), roles };
}

router.post('/register', asyncRoute(async (req, res) => {
  const input = registration.parse(req.body);
  await ensureCoreRoles();
  const email = input.email.toLowerCase();
  if (await User.exists({ email })) return res.status(409).json({ error: 'An account already exists for this email' });
  const user = await User.create({ ...input, email, email_verified: false });
  await Profile.create({ user_id: user._id, full_name: user.full_name, phone: user.phone });
  const role = ADMIN_EMAILS.has(email) ? 'admin' : 'customer';
  await assignRole(user._id, role);
  res.status(201).json(response(user, [role]));
}));

router.post('/login', asyncRoute(async (req, res) => {
  const input = login.parse(req.body);
  const user = await User.findOne({ email: input.email.toLowerCase() }).select('+password');
  if (!user?.password || !(await user.checkPassword(input.password))) return res.status(401).json({ error: 'Invalid email or password' });
  res.json(response(user, await rolesFor(user._id)));
}));

router.post('/google', asyncRoute(async (req, res) => {
  const token = z.object({ credential: z.string().min(10) }).parse(req.body).credential;
  if (!process.env.GOOGLE_CLIENT_ID) return res.status(503).json({ error: 'Google Sign-In is not configured' });
  const ticket = await new OAuth2Client(process.env.GOOGLE_CLIENT_ID).verifyIdToken({ idToken: token, audience: process.env.GOOGLE_CLIENT_ID });
  const payload = ticket.getPayload();
  if (!payload?.email || !payload.sub) return res.status(401).json({ error: 'Unable to verify Google identity' });
  await ensureCoreRoles();
  const email = payload.email.toLowerCase();
  let user = await User.findOne({ $or: [{ google_id: payload.sub }, { email }] });
  if (!user) {
    user = await User.create({ email, google_id: payload.sub, full_name: payload.name || email.split('@')[0], email_verified: Boolean(payload.email_verified) });
    await Profile.create({ user_id: user._id, full_name: user.full_name, avatar_url: payload.picture });
    await assignRole(user._id, ADMIN_EMAILS.has(email) ? 'admin' : 'customer');
  } else if (!user.google_id) {
    user.google_id = payload.sub;
    user.email_verified = Boolean(payload.email_verified) || user.email_verified;
    await user.save();
  }
  res.json(response(user, await rolesFor(user._id)));
}));

router.get('/me', authenticate, asyncRoute(async (req, res) => {
  const profile = await Profile.findOne({ user_id: req.user._id }).lean();
  res.json({ user: publicUser(req.user), roles: req.roles, profile });
}));

router.patch('/profile', authenticate, asyncRoute(async (req, res) => {
  const input = profileInput.parse(req.body);
  const profile = await Profile.findOneAndUpdate(
    { user_id: req.user._id },
    { $set: input, $setOnInsert: { user_id: req.user._id, full_name: input.full_name || req.user.full_name } },
    { new: true, upsert: true, runValidators: true }
  );
  if (input.full_name || input.phone) {
    await User.findByIdAndUpdate(req.user._id, { $set: { ...(input.full_name ? { full_name: input.full_name } : {}), ...(input.phone ? { phone: input.phone } : {}) } });
  }
  res.json({ profile });
}));

export default router;
