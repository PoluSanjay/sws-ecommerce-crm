import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';

const { Schema, model } = mongoose;
const opts = { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } };

const userSchema = new Schema({
  email: { type: String, required: true, unique: true, lowercase: true, trim: true, index: true },
  password: { type: String, select: false },
  full_name: { type: String, required: true, trim: true, maxlength: 120 },
  phone: { type: String, trim: true, maxlength: 25 },
  email_verified: { type: Boolean, default: false },
  google_id: { type: String, sparse: true, unique: true }
}, opts);
userSchema.pre('save', async function hashPassword(next) {
  if (!this.isModified('password') || !this.password) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});
userSchema.methods.checkPassword = function checkPassword(value) {
  return bcrypt.compare(value, this.password);
};

const roleSchema = new Schema({ name: { type: String, required: true, unique: true, enum: ['admin', 'technician', 'customer'] } }, { timestamps: { createdAt: 'created_at', updatedAt: false } });
const userRoleSchema = new Schema({
  user_id: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  role_id: { type: Schema.Types.ObjectId, ref: 'Role', required: true, index: true },
  assigned_at: { type: Date, default: Date.now }
}, { versionKey: false });
userRoleSchema.index({ user_id: 1, role_id: 1 }, { unique: true });

const profileSchema = new Schema({
  user_id: { type: Schema.Types.ObjectId, ref: 'User', required: true, unique: true, index: true },
  full_name: { type: String, required: true, trim: true, maxlength: 120 },
  avatar_url: String,
  address: { type: String, trim: true, maxlength: 500 },
  city: { type: String, trim: true, maxlength: 80 },
  pincode: { type: String, trim: true, maxlength: 10 },
  state: { type: String, trim: true, maxlength: 80 },
  phone: { type: String, trim: true, maxlength: 25 }
}, opts);

const categorySchema = new Schema({
  name: { type: String, required: true, trim: true, maxlength: 100 },
  slug: { type: String, required: true, unique: true, lowercase: true, match: /^[a-z0-9-]+$/ },
  description: { type: String, maxlength: 500 },
  image_url: String
}, opts);

const productSchema = new Schema({
  name: { type: String, required: true, trim: true, maxlength: 160 },
  slug: { type: String, required: true, unique: true, lowercase: true, index: true, match: /^[a-z0-9-]+$/ },
  description: { type: String, required: true, maxlength: 8000 },
  price: { type: Number, required: true, min: 0 },
  discount_price: { type: Number, min: 0 },
  stock: { type: Number, required: true, min: 0, default: 0 },
  category_id: { type: Schema.Types.ObjectId, ref: 'Category', required: true, index: true },
  images: [{ type: String }],
  specifications: { type: Map, of: String, default: {} },
  is_active: { type: Boolean, default: true, index: true }
}, opts);
productSchema.index({ name: 'text', description: 'text' });

const itemSchema = new Schema({
  product_id: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
  name: { type: String, required: true },
  price: { type: Number, required: true, min: 0 },
  quantity: { type: Number, required: true, min: 1 },
  image: String
}, { _id: false });
const addressSchema = new Schema({
  name: { type: String, required: true, maxlength: 120 },
  phone: { type: String, required: true, maxlength: 25 },
  email: { type: String, required: true, maxlength: 160 },
  address: { type: String, required: true, maxlength: 500 },
  city: { type: String, required: true, maxlength: 80 },
  pincode: { type: String, required: true, maxlength: 10 },
  state: { type: String, required: true, maxlength: 80 }
}, { _id: false });
const orderSchema = new Schema({
  order_number: { type: String, required: true, unique: true, index: true },
  user_id: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  items: { type: [itemSchema], validate: value => value.length > 0 },
  subtotal: { type: Number, required: true, min: 0 },
  shipping_amount: { type: Number, default: 0, min: 0 },
  tax_amount: { type: Number, default: 0, min: 0 },
  total: { type: Number, required: true, min: 0 },
  delivery_address: { type: addressSchema, required: true },
  status: { type: String, enum: ['pending', 'confirmed', 'shipped', 'delivered', 'cancelled'], default: 'pending', index: true },
  payment_method: { type: String, enum: ['cod', 'bank_transfer'], required: true },
  payment_status: { type: String, enum: ['pending', 'paid', 'failed'], default: 'pending' }
}, opts);
orderSchema.index({ user_id: 1, created_at: -1 });

const complaintSchema = new Schema({
  ticket_number: { type: String, required: true, unique: true, index: true },
  user_id: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  order_id: { type: Schema.Types.ObjectId, ref: 'Order' },
  category: { type: String, required: true, maxlength: 80 },
  description: { type: String, required: true, maxlength: 4000 },
  status: { type: String, enum: ['open', 'assigned', 'in_progress', 'waiting_parts', 'resolved', 'closed'], default: 'open', index: true },
  priority: { type: String, enum: ['low', 'normal', 'high', 'urgent'], default: 'normal' },
  technician_id: { type: Schema.Types.ObjectId, ref: 'User', index: true }
}, opts);
complaintSchema.index({ user_id: 1, created_at: -1 });

const paymentSettingsSchema = new Schema({
  singleton: { type: String, default: 'default', unique: true },
  upi_id: { type: String, trim: true },
  bank_name: { type: String, trim: true },
  account_name: { type: String, trim: true },
  account_number: { type: String, trim: true },
  ifsc: { type: String, trim: true },
  instructions: { type: String, maxlength: 2000 }
}, opts);

const notificationSchema = new Schema({
  user_id: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  type: { type: String, required: true, maxlength: 80 },
  message: { type: String, required: true, maxlength: 500 },
  is_read: { type: Boolean, default: false, index: true },
  link: String
}, { timestamps: { createdAt: 'created_at', updatedAt: false } });

const settingsSchema = new Schema({
  singleton: { type: String, default: 'default', unique: true },
  free_shipping_threshold: { type: Number, default: 5000, min: 0 },
  flat_shipping_fee: { type: Number, default: 99, min: 0 },
  gst_rate: { type: Number, default: 0, min: 0, max: 100 },
  smtp: {
    host: String,
    port: { type: Number, min: 1, max: 65535 },
    secure: Boolean,
    user: String,
    pass: String,
    from: String,
    notification_email: String
  }
}, opts);

export const User = model('User', userSchema);
export const Role = model('Role', roleSchema);
export const UserRole = model('UserRole', userRoleSchema);
export const Profile = model('Profile', profileSchema);
export const Category = model('Category', categorySchema);
export const Product = model('Product', productSchema);
export const Order = model('Order', orderSchema);
export const Complaint = model('Complaint', complaintSchema);
export const PaymentSettings = model('PaymentSettings', paymentSettingsSchema);
export const Notification = model('Notification', notificationSchema);
export const AppSettings = model('AppSettings', settingsSchema);
