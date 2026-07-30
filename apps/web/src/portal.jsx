import { useState } from 'react';
import { Link } from '@tanstack/react-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { BarChart3, Check, ClipboardList, CreditCard, ImageOff, LoaderCircle, Package, Pencil, Plus, Save, Settings, Trash2, Users, Wrench, X } from 'lucide-react';
import { Empty, Seo, SectionTitle, Spinner, api, date, imageUrl, money, useAuth, useToast } from './lib.jsx';

const get = (path, key) => useQuery({ queryKey: key || [path], queryFn: () => api(path) });
const Status = ({ children }) => <span className="status">{String(children || 'pending').replaceAll('_', ' ')}</span>;
const adminLinks = [['/admin','Overview',BarChart3],['/admin/products','Products',Package],['/admin/orders','Orders',ClipboardList],['/admin/complaints','Complaints',Wrench],['/admin/payment','Payments & settings',CreditCard],['/admin/users','Users & roles',Users]];

function AdminNav() { return <nav className="mb-8 flex gap-2 overflow-x-auto border-b border-line pb-3">{adminLinks.map(([to,label,Icon]) => <Link key={to} to={to} className="btn btn-secondary shrink-0 px-3 py-2 text-xs"><Icon size={15}/>{label}</Link>)}</nav>; }
function AdminTitle({ title, detail }) { return <><Seo title={title}/><AdminNav/><div className="mb-7"><h1 className="text-3xl font-bold tracking-tight">{title}</h1>{detail && <p className="mt-2 text-sm text-muted">{detail}</p>}</div></>; }
async function action(run, toast, refresh, success) { try { await run(); toast(success || 'Saved'); refresh?.(); } catch (error) { toast(error.message); } }

export function CustomerDashboard() {
  const { account, refresh } = useAuth(); const queryClient = useQueryClient(); const toast = useToast();
  const { data: orderData, isLoading: ordersLoading } = get('/orders', ['my-orders']);
  const { data: complaintData } = get('/complaints', ['my-complaints']);
  const [profile, setProfile] = useState(null); const [complaint, setComplaint] = useState({ category: 'Maintenance & repair', description: '', priority: 'normal', order_id: '' });
  const current = profile || account?.profile || { full_name: account?.user?.full_name || '', phone: account?.user?.phone || '', address: '', city: '', pincode: '', state: '' };
  const saveProfile = event => { event.preventDefault(); action(() => api('/auth/profile', { method: 'PATCH', body: current }), toast, refresh, 'Profile updated'); };
  const createComplaint = event => { event.preventDefault(); action(async () => { await api('/complaints', { method: 'POST', body: complaint }); setComplaint({ category: 'Maintenance & repair', description: '', priority: 'normal', order_id: '' }); }, toast, () => queryClient.invalidateQueries({ queryKey: ['my-complaints'] }), 'Ticket created — SWS will be in touch'); };
  return <div className="shell py-10"><Seo title="My dashboard"/><SectionTitle eyebrow="Your SWS account" title={'Welcome, ' + (account?.user?.full_name?.split(' ')[0] || '')}/><div className="grid gap-7 xl:grid-cols-[1fr_.85fr]"><div className="grid gap-7"><section className="card p-6"><div className="mb-4 flex justify-between"><h2 className="font-bold">My orders</h2><Link to="/products" className="text-sm text-brand-light">Shop more</Link></div>{ordersLoading ? <Spinner/> : orderData?.orders?.length ? <div className="table-wrap"><table><thead><tr><th>Order</th><th>Date</th><th>Total</th><th>Status</th></tr></thead><tbody>{orderData.orders.map(item => <tr key={item._id}><td><Link className="font-bold text-brand-light" to="/order/$number" params={{ number: item.order_number }}>{item.order_number}</Link></td><td>{date(item.created_at)}</td><td>{money(item.total)}</td><td><Status>{item.status}</Status></td></tr>)}</tbody></table></div> : <Empty title="No orders yet" detail="Your recent purchases will appear here."/>}</section><section className="card p-6"><h2 className="mb-4 font-bold">My service tickets</h2>{complaintData?.complaints?.length ? <div className="table-wrap"><table><thead><tr><th>Ticket</th><th>Issue</th><th>Status</th></tr></thead><tbody>{complaintData.complaints.map(item => <tr key={item._id}><td className="font-bold">{item.ticket_number}</td><td>{item.category}<small className="block text-muted">{date(item.created_at)}</small></td><td><Status>{item.status}</Status></td></tr>)}</tbody></table></div> : <Empty title="No active tickets" detail="Use the form to request help from SWS."/>}</section></div><div className="grid gap-7"><section className="card p-6"><h2 className="font-bold">Request service</h2><form className="mt-4 grid gap-3" onSubmit={createComplaint}><label className="label">Type<select className="input" value={complaint.category} onChange={event => setComplaint({ ...complaint, category: event.target.value })}><option>Maintenance & repair</option><option>RO/UV installation</option><option>Annual maintenance plan</option><option>Product issue</option></select></label><label className="label">Related order (optional)<select className="input" value={complaint.order_id} onChange={event => setComplaint({ ...complaint, order_id: event.target.value })}><option value="">No related order</option>{orderData?.orders?.map(item => <option key={item._id} value={item._id}>{item.order_number}</option>)}</select></label><label className="label">Describe the issue<textarea required minLength="10" className="input min-h-26" value={complaint.description} onChange={event => setComplaint({ ...complaint, description: event.target.value })}/></label><button className="btn btn-primary">Create service ticket</button></form></section><section className="card p-6"><h2 className="font-bold">Profile & address</h2><form className="mt-4 grid gap-3" onSubmit={saveProfile}>{[['full_name','Full name'],['phone','Phone'],['city','City'],['pincode','Pincode'],['state','State']].map(item => <label className="label" key={item[0]}>{item[1]}<input className="input" value={current[item[0]] || ''} onChange={event => setProfile({ ...current, [item[0]]: event.target.value })}/></label>)}<label className="label">Address<textarea className="input min-h-20" value={current.address || ''} onChange={event => setProfile({ ...current, address: event.target.value })}/></label><button className="btn btn-secondary">Save profile</button></form></section></div></div></div>;
}

export function AdminDashboard() {
  const { data, isLoading } = get('/admin/dashboard', ['admin-dashboard']);
  if (isLoading) return <Spinner/>; const stats = data.stats;
  return <div className="shell py-10"><AdminTitle title="Control center" detail="A live view of sales, service and customer operations."/><div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{[['Products',stats.products,Package],['Pending orders',stats.pendingOrders,ClipboardList],['Open tickets',stats.openComplaints,Wrench],['Customers',stats.users,Users]].map(([label,value,Icon]) => <div className="card p-5" key={label}><Icon className="text-brand-light" size={20}/><b className="mt-5 block text-3xl">{value}</b><p className="mt-1 text-sm text-muted">{label}</p></div>)}</div><div className="mt-7 grid gap-7 lg:grid-cols-2"><RecentOrders items={data.recentOrders}/><RecentComplaints items={data.recentComplaints}/></div></div>;
}
function RecentOrders({ items }) { return <section className="card p-6"><div className="mb-4 flex justify-between"><h2 className="font-bold">Recent orders</h2><Link to="/admin/orders" className="text-sm text-brand-light">Manage</Link></div>{items.length ? <div className="grid gap-3">{items.map(item => <div className="flex items-center justify-between gap-3 border-b border-line pb-3 text-sm" key={item._id}><div><b>{item.order_number}</b><span className="ml-2 text-muted">{item.user_id?.full_name}</span></div><div className="text-right"><b>{money(item.total)}</b><span className="ml-2"><Status>{item.status}</Status></span></div></div>)}</div> : <Empty/>}</section>; }
function RecentComplaints({ items }) { return <section className="card p-6"><div className="mb-4 flex justify-between"><h2 className="font-bold">Recent tickets</h2><Link to="/admin/complaints" className="text-sm text-brand-light">Manage</Link></div>{items.length ? <div className="grid gap-3">{items.map(item => <div className="flex items-center justify-between gap-3 border-b border-line pb-3 text-sm" key={item._id}><div><b>{item.ticket_number}</b><span className="ml-2 text-muted">{item.category}</span></div><Status>{item.status}</Status></div>)}</div> : <Empty/>}</section>; }

const productBlank = { name: '', slug: '', brand: 'Sujala', description: '', price: '', discount_price: '', stock: '10', warranty: '1 Year', category_id: '', specifications: '{}', is_active: true, is_featured: false };
const slugify = value => value.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '');

export function AdminProducts() {
  const queryClient = useQueryClient(); const toast = useToast();
  const { data: productsData, isLoading } = get('/admin/products', ['admin-products']);
  const { data: categoriesData } = get('/categories', ['categories']);
  const [form, setForm] = useState(null); const [files, setFiles] = useState([]); const [saving, setSaving] = useState(false);
  const products = productsData?.products || [];
  const categories = categoriesData?.categories || [];

  const edit = product => { setFiles([]); setForm(product ? { ...product, category_id: product.category_id?._id || product.category_id, specifications: JSON.stringify(product.specifications || {}, null, 2) } : productBlank); };
  const setField = (key, value) => setForm(current => {
    const next = { ...current, [key]: value };
    if (key === 'name' && !current._id && (!current.slug || current.slug === slugify(current.name || ''))) next.slug = slugify(value);
    return next;
  });

  const save = event => {
    event.preventDefault();
    if (!form.name.trim() || String(form.price).trim() === '') { toast('Name and price are required'); return; }
    const numeric = ['price','discount_price','stock','rating'];
    const skip = ['_id','images','created_at','updated_at','__v','specifications'];
    // Build a plain object first so we can send clean JSON when there is nothing to upload.
    const payload = {};
    Object.entries(form).forEach(([key, value]) => {
      if (skip.includes(key)) return;
      if (value === '' || value === null || value === undefined) return;
      if (numeric.includes(key)) { const n = Number(value); if (!Number.isNaN(n)) payload[key] = n; return; }
      payload[key] = value;
    });
    payload.slug = form.slug || slugify(form.name);
    payload.is_active = form.is_active ?? true;
    payload.is_featured = form.is_featured ?? false;
    if (!form.category_id) delete payload.category_id;
    // specifications is edited as JSON text; send an object, never a raw string.
    if (form.specifications && String(form.specifications).trim()) {
      try { payload.specifications = JSON.parse(form.specifications); }
      catch { toast('Specifications must be valid JSON'); return; }
    }
    payload.existing_images = form.images || [];

    let body;
    if (files.length) {
      body = new FormData();
      Object.entries(payload).forEach(([key, value]) => {
        body.append(key, typeof value === 'object' ? JSON.stringify(value) : String(value));
      });
      [...files].forEach(file => body.append('images', file));
    } else {
      body = payload; // JSON — works even if the server has no multipart parser on this route
    }
    setSaving(true);
    action(() => api('/admin/products' + (form._id ? '/' + form._id : ''), { method: form._id ? 'PUT' : 'POST', body }), toast,
      () => { queryClient.invalidateQueries({ queryKey: ['admin-products'] }); setForm(null); setFiles([]); }, form._id ? 'Product updated' : 'Product created')
      .finally(() => setSaving(false));
  };

  const remove = product => { if (confirm('Delete "' + product.name + '"?')) action(() => api('/admin/products/' + product._id, { method: 'DELETE' }), toast, () => queryClient.invalidateQueries({ queryKey: ['admin-products'] }), 'Product deleted'); };

  return <div className="shell py-10">
    <AdminTitle title="Edit products" detail="Use each product card's Edit button to change price, stock, image and details."/>
    <div className="mb-6 flex justify-end"><button className="btn btn-primary" onClick={() => edit(null)}><Plus size={16}/>Add product</button></div>

    {isLoading ? <Spinner/> : products.length ? <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
      {products.map(product => {
        const price = product.discount_price ?? product.price;
        const image = imageUrl(product.images?.[0]);
        return <div key={product._id} className="card card-hover overflow-hidden">
          <div className="aspect-square bg-mint">
            {image ? <img src={image} alt={product.name} className="h-full w-full object-cover"/> : <div className="grid h-full place-items-center gap-2 text-muted"><ImageOff size={26}/><span className="text-xs">No image</span></div>}
          </div>
          <div className="p-4">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="truncate font-semibold text-ink">{product.name}</div>
                <div className="mt-0.5 text-xs text-muted">{product.brand || 'Sujala'} • {product.is_active === false ? 'Hidden' : 'Active'}{product.is_featured ? ' • Featured' : ''}</div>
              </div>
              <div className="shrink-0 text-right">
                <div className="font-bold text-brand">{money(price)}</div>
                {product.discount_price != null && <div className="text-xs text-muted line-through">{money(product.price)}</div>}
              </div>
            </div>
            <div className="mt-2 text-xs text-muted">Stock: {product.stock ?? 0}</div>
            <div className="mt-3 flex gap-2">
              <button className="btn btn-secondary flex-1 px-3 py-2 text-xs" onClick={() => edit(product)}><Pencil size={14}/>Edit price / image</button>
              <button className="btn btn-secondary px-3 py-2 text-xs text-red-700 hover:border-red-300 hover:bg-red-50" aria-label={'Delete ' + product.name} onClick={() => remove(product)}><Trash2 size={14}/></button>
            </div>
          </div>
        </div>;
      })}
    </div> : <div className="empty-panel">No products yet. Click "Add product" to create your first one.</div>}

    {form && <div className="fixed inset-0 z-70 grid place-items-center overflow-y-auto p-4 py-8">
      <div className="absolute inset-0 bg-ink/50" onClick={() => setForm(null)}/>
      <form className="card relative max-h-[92vh] w-full max-w-2xl overflow-y-auto p-6 sm:p-8" onSubmit={save}>
        <div className="mb-6 flex items-center justify-between">
          <h2 className="font-display text-xl font-bold text-ink">{form._id ? 'Edit product' : 'Add product'}</h2>
          <button type="button" onClick={() => setForm(null)} className="rounded-lg p-1.5 text-muted hover:bg-mint hover:text-ink"><X size={20}/></button>
        </div>

        <div className="grid gap-4">
          <label className="label">Name *<input required className="input" placeholder="e.g. Aqua RO+UV 8L" value={form.name} onChange={event => setField('name', event.target.value)}/></label>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="label">Slug (URL)<input pattern="[a-z0-9-]+" className="input" placeholder="auto-generated" value={form.slug || ''} onChange={event => setField('slug', event.target.value)}/></label>
            <label className="label">Brand<input className="input" value={form.brand || ''} onChange={event => setField('brand', event.target.value)}/></label>
          </div>
          <label className="label">Description<textarea rows="4" className="input" value={form.description || ''} onChange={event => setField('description', event.target.value)}/></label>
          <div className="grid gap-4 sm:grid-cols-3">
            <label className="label">Price (₹) *<input required type="number" step="0.01" className="input" value={form.price} onChange={event => setField('price', event.target.value)}/></label>
            <label className="label">Sale price (₹)<input type="number" step="0.01" className="input" placeholder="Optional" value={form.discount_price ?? ''} onChange={event => setField('discount_price', event.target.value)}/></label>
            <label className="label">Stock<input type="number" className="input" value={form.stock ?? 0} onChange={event => setField('stock', event.target.value)}/></label>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="label">Warranty<input className="input" placeholder="e.g. 1 Year" value={form.warranty || ''} onChange={event => setField('warranty', event.target.value)}/></label>
            <label className="label">Category<select className="input" value={form.category_id || ''} onChange={event => setField('category_id', event.target.value)}><option value="">— None —</option>{categories.map(category => <option key={category._id} value={category._id}>{category.name}</option>)}</select></label>
          </div>

          <div className="label">Images
            <div className="flex items-start gap-3">
              <div className="flex gap-2">
                {(form.images || []).slice(0, 2).map(path => <div key={path} className="relative"><img src={imageUrl(path)} alt="" className="h-24 w-24 rounded-lg border border-line object-cover"/><button type="button" aria-label="Remove image" className="absolute -right-2 -top-2 rounded-full bg-white p-1 text-red-700 shadow" onClick={() => setForm({ ...form, images: form.images.filter(item => item !== path) })}><X size={12}/></button></div>)}
              </div>
              <div className="flex-1">
                <label className="btn btn-secondary w-full cursor-pointer text-xs">{files.length ? files.length + ' file(s) selected' : 'Upload file'}<input type="file" accept="image/*" multiple className="hidden" onChange={event => setFiles(event.target.files)}/></label>
                <p className="mt-2 text-xs text-muted">JPG or PNG, up to 5MB each. New uploads are added to the product gallery.</p>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-6 text-sm">
            <label className="flex items-center gap-2"><input type="checkbox" checked={form.is_active ?? true} onChange={event => setField('is_active', event.target.checked)}/>Active (visible on shop)</label>
            <label className="flex items-center gap-2"><input type="checkbox" checked={form.is_featured ?? false} onChange={event => setField('is_featured', event.target.checked)}/>Featured (homepage)</label>
          </div>
        </div>

        <div className="mt-7 flex justify-end gap-2">
          <button type="button" className="btn btn-secondary" onClick={() => setForm(null)}>Cancel</button>
          <button className="btn btn-primary" disabled={saving}>{saving ? <LoaderCircle className="animate-spin" size={16}/> : <Save size={16}/>}{form._id ? 'Save changes' : 'Create product'}</button>
        </div>
      </form>
    </div>}
  </div>;
}
export function AdminOrders() {
  const queryClient = useQueryClient(); const toast = useToast(); const { data, isLoading } = get('/admin/orders', ['admin-orders']);
  const update = (id, changes) => action(() => api('/admin/orders/' + id, { method: 'PATCH', body: changes }), toast, () => queryClient.invalidateQueries({ queryKey: ['admin-orders'] }), 'Order updated');
  return <div className="shell py-10"><AdminTitle title="Orders" detail="Confirm COD orders and verify bank transfers before confirmation."/><div className="card table-wrap">{isLoading ? <Spinner/> : <table><thead><tr><th>Order</th><th>Customer</th><th>Items</th><th>Total</th><th>Fulfilment</th><th>Payment</th></tr></thead><tbody>{data?.orders?.map(item => <tr key={item._id}><td><b>{item.order_number}</b><small className="block text-muted">{date(item.created_at)}</small></td><td>{item.delivery_address.name}<small className="block text-muted">{item.delivery_address.phone}</small></td><td>{item.items.map(part => part.name + ' × ' + part.quantity).join(', ')}</td><td><b>{money(item.total)}</b><small className="block text-muted">{item.payment_method.replace('_', ' ')}</small></td><td><select className="input min-w-30 p-2 text-xs" value={item.status} onChange={event => update(item._id, { status: event.target.value })}>{['pending','confirmed','shipped','delivered','cancelled'].map(value => <option key={value}>{value}</option>)}</select></td><td><select className="input min-w-24 p-2 text-xs" value={item.payment_status} onChange={event => update(item._id, { payment_status: event.target.value })}>{['pending','paid','failed'].map(value => <option key={value}>{value}</option>)}</select></td></tr>)}</tbody></table>}{!isLoading && !data?.orders?.length && <Empty title="No orders to manage"/>}</div></div>;
}

export function AdminComplaints() {
  const queryClient = useQueryClient(); const toast = useToast(); const { data, isLoading } = get('/admin/complaints', ['admin-complaints']); const { data: usersData } = get('/admin/users', ['admin-users']);
  const update = (id, changes) => action(() => api('/admin/complaints/' + id, { method: 'PATCH', body: changes }), toast, () => queryClient.invalidateQueries({ queryKey: ['admin-complaints'] }), 'Complaint updated');
  const techs = usersData?.users?.filter(user => user.roles.includes('technician')) || [];
  return <div className="shell py-10"><AdminTitle title="Complaints & service" detail="Assign a technician, track progress and close every service loop."/><div className="card table-wrap">{isLoading ? <Spinner/> : <table><thead><tr><th>Ticket</th><th>Customer</th><th>Details</th><th>Assign</th><th>Status</th></tr></thead><tbody>{data?.complaints?.map(item => <tr key={item._id}><td><b>{item.ticket_number}</b><small className="block text-muted">{date(item.created_at)}</small></td><td>{item.user_id?.full_name}<small className="block text-muted">{item.user_id?.phone}</small></td><td><b>{item.category}</b><small className="mt-1 block max-w-70 text-muted">{item.description}</small><Status>{item.priority}</Status></td><td><select className="input min-w-40 p-2 text-xs" value={item.technician_id?._id || ''} onChange={event => update(item._id, { technician_id: event.target.value || null })}><option value="">Unassigned</option>{techs.map(user => <option key={user._id} value={user._id}>{user.full_name}</option>)}</select></td><td><select className="input min-w-36 p-2 text-xs" value={item.status} onChange={event => update(item._id, { status: event.target.value })}>{['open','assigned','in_progress','waiting_parts','resolved','closed'].map(value => <option key={value}>{value.replace('_',' ')}</option>)}</select></td></tr>)}</tbody></table>}{!isLoading && !data?.complaints?.length && <Empty title="No complaints to manage"/>}</div></div>;
}

export function AdminPayment() {
  const toast = useToast(); const { data: paymentData, refetch: refetchPayment } = get('/admin/payment', ['payment']); const { data: settingsData, refetch: refetchSettings } = get('/admin/settings', ['settings']); const [payment, setPayment] = useState(null); const [settings, setSettings] = useState(null);
  const pay = payment || paymentData?.payment || {}; const app = settings || settingsData?.settings || { free_shipping_threshold: 5000, flat_shipping_fee: 99, gst_rate: 0, smtp: {} };
  const savePayment = event => { event.preventDefault(); action(() => api('/admin/payment', { method: 'PUT', body: pay }), toast, refetchPayment, 'Payment details updated'); };
  const saveSettings = event => { event.preventDefault(); action(() => api('/admin/settings', { method: 'PUT', body: app }), toast, refetchSettings, 'Operational settings saved'); };
  return <div className="shell py-10"><AdminTitle title="Payments & settings" detail="Configure transfer instructions, delivery pricing and SMTP order notifications."/><div className="grid gap-7 lg:grid-cols-2"><form className="card grid gap-4 p-6" onSubmit={savePayment}><h2 className="font-bold">Bank transfer / UPI</h2>{[['upi_id','UPI ID'],['bank_name','Bank name'],['account_name','Account name'],['account_number','Account number'],['ifsc','IFSC code']].map(item => <label className="label" key={item[0]}>{item[1]}<input className="input" value={pay[item[0]] || ''} onChange={event => setPayment({ ...pay, [item[0]]: event.target.value })}/></label>)}<label className="label">Instructions<textarea className="input min-h-24" value={pay.instructions || ''} onChange={event => setPayment({ ...pay, instructions: event.target.value })}/></label><button className="btn btn-primary">Save payment details</button></form><form className="card grid gap-4 p-6" onSubmit={saveSettings}><h2 className="font-bold">Delivery & tax</h2>{[['free_shipping_threshold','Free shipping over (INR)'],['flat_shipping_fee','Flat delivery fee (INR)'],['gst_rate','GST rate (%)']].map(item => <label className="label" key={item[0]}>{item[1]}<input required type="number" min="0" className="input" value={app[item[0]] ?? ''} onChange={event => setSettings({ ...app, [item[0]]: Number(event.target.value) })}/></label>)}<h2 className="mt-2 font-bold">SMTP notifications</h2>{[['host','SMTP host'],['port','Port'],['user','Username'],['pass','Password'],['from','From address'],['notification_email','Notification email']].map(item => <label className="label" key={item[0]}>{item[1]}<input type={item[0] === 'pass' ? 'password' : 'text'} className="input" value={app.smtp?.[item[0]] || ''} onChange={event => setSettings({ ...app, smtp: { ...(app.smtp || {}), [item[0]]: item[0] === 'port' ? Number(event.target.value) : event.target.value } })}/></label>)}<label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={Boolean(app.smtp?.secure)} onChange={event => setSettings({ ...app, smtp: { ...(app.smtp || {}), secure: event.target.checked } })}/>Use TLS from connection start</label><button className="btn btn-primary">Save operational settings</button></form></div></div>;
}

export function AdminUsers() {
  const queryClient = useQueryClient(); const toast = useToast(); const { account } = useAuth(); const { data, isLoading } = get('/admin/users', ['admin-users']);
  const save = (user, roles) => action(() => api('/admin/users/' + user._id + '/roles', { method: 'PATCH', body: { roles } }), toast, () => queryClient.invalidateQueries({ queryKey: ['admin-users'] }), 'Roles updated');
  return <div className="shell py-10"><AdminTitle title="Users & roles" detail="Grant technician access to team members and keep administration controlled."/><div className="card table-wrap">{isLoading ? <Spinner/> : <table><thead><tr><th>User</th><th>Email</th><th>Joined</th><th>Roles</th></tr></thead><tbody>{data?.users?.map(user => <tr key={user._id}><td><b>{user.full_name}</b><small className="block text-muted">{user.phone}</small></td><td>{user.email}</td><td>{date(user.created_at)}</td><td><RoleEditor user={user} disabled={user._id === account.user._id} onSave={save}/></td></tr>)}</tbody></table>}</div></div>;
}
function RoleEditor({ user, disabled, onSave }) { const [roles,setRoles] = useState(user.roles); const changed = roles.join() !== user.roles.join(); return <div className="flex min-w-68 flex-wrap items-center gap-2">{['customer','technician','admin'].map(role => <label className="flex items-center gap-1 text-xs" key={role}><input disabled={disabled} type="checkbox" checked={roles.includes(role)} onChange={event => setRoles(event.target.checked ? [...roles,role] : roles.filter(item => item !== role))}/>{role}</label>)}{changed && <button disabled={disabled || !roles.length} className="btn btn-primary px-2 py-1 text-xs" onClick={() => onSave(user, roles)}>Save</button>}</div>; }

export function TechnicianDashboard() {
  const queryClient = useQueryClient(); const toast = useToast(); const { data, isLoading } = get('/technician/complaints', ['technician-complaints']);
  const update = (id, status) => action(() => api('/technician/complaints/' + id, { method: 'PATCH', body: { status } }), toast, () => queryClient.invalidateQueries({ queryKey: ['technician-complaints'] }), 'Ticket status updated');
  return <div className="shell py-10"><Seo title="Technician workspace"/><SectionTitle eyebrow="Field service workspace" title="My assigned complaints"/>{isLoading ? <Spinner/> : data?.complaints?.length ? <div className="grid gap-5 md:grid-cols-2">{data.complaints.map(item => <article className="card p-6" key={item._id}><div className="flex justify-between gap-3"><div><p className="eyebrow">{item.ticket_number}</p><h2 className="mt-1 font-bold">{item.category}</h2></div><Status>{item.priority}</Status></div><p className="mt-4 text-sm leading-6 text-slate-300">{item.description}</p><div className="mt-5 border-t border-line pt-4 text-sm"><b>{item.user_id?.full_name}</b><p className="text-muted">{item.user_id?.phone} · {item.user_id?.email}</p>{item.order_id?.order_number && <p className="mt-1 text-brand-light">{item.order_id.order_number}</p>}</div><label className="label mt-5">Update job status<select className="input" value={item.status} onChange={event => update(item._id, event.target.value)}>{['assigned','in_progress','waiting_parts','resolved','closed'].map(value => <option key={value}>{value.replace('_',' ')}</option>)}</select></label></article>)}</div> : <Empty title="No assigned tickets" detail="New assignments will appear here in real time."/ >}</div>;
}
