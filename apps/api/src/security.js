import jwt from 'jsonwebtoken';
import { Role, User, UserRole } from './models.js';

export const ADMIN_EMAILS = new Set([
  'sujalawatersolutions@gmail.com',
  'sanjaypolu3@gmail.com',
  '2303a51731@sru.edu.in'
]);

export function signToken(user) {
  return jwt.sign({ sub: user._id.toString(), email: user.email }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || '7d' });
}

export async function rolesFor(userId) {
  const assigned = await UserRole.find({ user_id: userId }).populate('role_id', 'name').lean();
  return assigned.map(item => item.role_id.name);
}

export async function ensureCoreRoles() {
  await Promise.all(['admin', 'technician', 'customer'].map(name => Role.updateOne({ name }, { $setOnInsert: { name } }, { upsert: true })));
}

export async function assignRole(userId, roleName) {
  const role = await Role.findOne({ name: roleName });
  if (!role) throw new Error('Role not initialized');
  await UserRole.updateOne({ user_id: userId, role_id: role._id }, { $setOnInsert: { user_id: userId, role_id: role._id, assigned_at: new Date() } }, { upsert: true });
}

export async function setRoles(userId, roleNames) {
  const roles = await Role.find({ name: { $in: roleNames } });
  if (roles.length !== roleNames.length) {
    const error = new Error('One or more roles are invalid');
    error.status = 400;
    throw error;
  }
  await UserRole.deleteMany({ user_id: userId });
  await UserRole.insertMany(roles.map(role => ({ user_id: userId, role_id: role._id })));
}

export async function authenticate(req, res, next) {
  try {
    const token = req.headers.authorization?.replace(/^Bearer\s+/i, '');
    if (!token) return res.status(401).json({ error: 'Authentication required' });
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(payload.sub).lean();
    if (!user) return res.status(401).json({ error: 'Account not found' });
    req.user = user;
    req.roles = await rolesFor(user._id);
    next();
  } catch {
    res.status(401).json({ error: 'Invalid or expired session' });
  }
}

export function requireRole(...allowed) {
  return (req, res, next) => req.roles.some(role => allowed.includes(role))
    ? next()
    : res.status(403).json({ error: 'You do not have permission for this action' });
}

export async function socketUser(token) {
  const payload = jwt.verify(token, process.env.JWT_SECRET);
  const user = await User.findById(payload.sub).lean();
  if (!user) throw new Error('Account not found');
  return { user, roles: await rolesFor(user._id) };
}
