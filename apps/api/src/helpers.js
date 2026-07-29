import nodemailer from 'nodemailer';
import { AppSettings, Notification, Role, UserRole } from './models.js';

export const asyncRoute = fn => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
export const publicUser = user => ({ _id: user._id, email: user.email, full_name: user.full_name, phone: user.phone, email_verified: user.email_verified, google_id: user.google_id });
export const referenceNumber = prefix => prefix + '-' + Date.now().toString(36).toUpperCase() + '-' + Math.random().toString(36).slice(2, 7).toUpperCase();

export async function appSettings() {
  return AppSettings.findOneAndUpdate({ singleton: 'default' }, { $setOnInsert: { singleton: 'default' } }, { new: true, upsert: true });
}

export async function notifyAdmins(io, type, message, link, emailSubject, emailHtml) {
  const role = await Role.findOne({ name: 'admin' }).lean();
  if (!role) return;
  const assignments = await UserRole.find({ role_id: role._id }).populate('user_id', 'email full_name').lean();
  const ids = assignments.map(item => item.user_id._id);
  if (ids.length) {
    await Notification.insertMany(ids.map(user_id => ({ user_id, type, message, link })));
    io.to('admin').emit('notification', { type, message, link, created_at: new Date() });
  }
  if (!emailSubject) return;
  const settings = await appSettings();
  const smtp = settings.smtp?.host ? settings.smtp : {
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: process.env.SMTP_SECURE === 'true',
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
    from: process.env.SMTP_FROM,
    notification_email: process.env.ADMIN_NOTIFICATION_EMAIL || 'hacxker2023@gmail.com'
  };
  if (!smtp.host || !smtp.notification_email) return;
  const transport = nodemailer.createTransport({
    host: smtp.host, port: Number(smtp.port || 587), secure: Boolean(smtp.secure),
    auth: smtp.user ? { user: smtp.user, pass: smtp.pass } : undefined
  });
  const recipients = [...new Set([smtp.notification_email, ...assignments.map(item => item.user_id.email)])].filter(Boolean);
  try {
    await transport.sendMail({ from: smtp.from || smtp.user, to: recipients.join(','), subject: emailSubject, html: emailHtml });
  } catch (error) {
    console.error('SMTP notification failed:', error.message);
  }
}
