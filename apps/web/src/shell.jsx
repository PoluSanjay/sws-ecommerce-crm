import { useEffect, useState } from 'react';
import { Link, useNavigate } from '@tanstack/react-router';
import { Bell, ChevronDown, Facebook, Headphones, Instagram, Menu, MessageCircle, Minus, Phone, Plus, Search, ShoppingBag, Trash2, UserRound, X, Youtube } from 'lucide-react';
import { io } from 'socket.io-client';
import { API_URL, Logo, Spinner, imageUrl, money, useAuth, useCart, useToast } from './lib.jsx';

const links = [{ to: '/', label: 'Home' }, { to: '/products', label: 'Products' }, { to: '/services', label: 'Services' }, { to: '/about', label: 'About' }, { to: '/contact', label: 'Contact' }];
const socketOrigin = API_URL.startsWith('http') ? new URL(API_URL).origin : window.location.origin;

export function Shell({ children }) {
  const { token, account } = useAuth();
  const toast = useToast();
  useEffect(() => {
    if (!token) return;
    const socket = io(socketOrigin, { auth: { token } });
    socket.on('notification', event => {
      toast(event.message);
      if ('Notification' in window && Notification.permission === 'granted') new Notification('Sujala Water Solutions', { body: event.message });
    });
    socket.on('order_updated', event => toast('Order ' + event.order_number + ' is now ' + event.status));
    socket.on('complaint_updated', event => toast('Ticket ' + event.ticket_number + ' is now ' + event.status.replaceAll('_', ' ')));
    socket.on('complaint_assigned', event => toast('A complaint was assigned to you: ' + event.ticket_number));
    return () => socket.disconnect();
  }, [token]);
  return <div className="min-h-screen bg-ink"><Header account={account}/><main>{children}</main><Footer/></div>;
}

function Header({ account }) {
  const [open, setOpen] = useState(false);
  const [cartOpen, setCartOpen] = useState(false);
  const [search, setSearch] = useState('');
  const navigate = useNavigate();
  const { count } = useCart();
  const { logout } = useAuth();
  const role = account?.roles?.includes('admin') ? 'admin' : account?.roles?.includes('technician') ? 'technician' : 'customer';
  const portal = role === 'admin' ? '/admin' : role === 'technician' ? '/technician' : '/dashboard';
  const searchProducts = event => { event.preventDefault(); navigate({ to: '/products' }); if (search.trim()) setTimeout(() => document.getElementById('catalog-search')?.focus(), 50); };
  return <header className="sticky top-0 z-50 border-b border-slate-800/80 bg-ink/90 backdrop-blur-xl">
    <div className="shell flex h-16 items-center justify-between gap-3">
      <Link to="/" aria-label="Sujala Water Solutions home"><Logo/></Link>
      <nav className="hidden items-center gap-5 lg:flex">{links.map(link => <Link key={link.to} to={link.to} className="text-sm font-semibold text-slate-300 transition hover:text-white">{link.label}</Link>)}</nav>
      <div className="ml-auto hidden items-center gap-2 sm:flex">
        <form onSubmit={searchProducts} className="relative hidden xl:block"><Search size={15} className="absolute left-3 top-2.5 text-muted"/><input aria-label="Search products" value={search} onChange={event => setSearch(event.target.value)} className="w-40 rounded-lg border border-line bg-slate-900 py-2 pl-9 pr-3 text-xs outline-none focus:border-brand" placeholder="Search products"/></form>
        <a className="grid h-9 w-9 place-items-center rounded-lg border border-line text-brand-light hover:bg-slate-800" title="Call SWS" href="tel:+919949792248"><Phone size={17}/></a>
        <a className="grid h-9 w-9 place-items-center rounded-lg border border-line text-emerald-400 hover:bg-slate-800" title="WhatsApp SWS" href="https://wa.me/919949792248" target="_blank" rel="noreferrer"><Headphones size={17}/></a>
      </div>
      <button onClick={() => setCartOpen(true)} className="relative grid h-9 w-9 place-items-center rounded-lg border border-line hover:bg-slate-800" aria-label="Open cart"><ShoppingBag size={18}/>{count > 0 && <span className="absolute -right-1 -top-1 grid h-4 min-w-4 place-items-center rounded-full bg-brand px-1 text-[10px] font-bold text-white">{count}</span>}</button>
      {account ? <div className="group relative hidden md:block"><button className="flex h-9 items-center gap-1 rounded-lg border border-line px-2 text-sm hover:bg-slate-800"><UserRound size={16}/><span className="max-w-24 truncate">{account.user.full_name.split(' ')[0]}</span><ChevronDown size={14}/></button><div className="invisible absolute right-0 top-full mt-2 w-44 rounded-xl border border-line bg-panel p-1 opacity-0 shadow-2xl transition group-hover:visible group-hover:opacity-100"><Link to={portal} className="block rounded-lg px-3 py-2 text-sm hover:bg-slate-700">My workspace</Link>{role === 'admin' && <Link to="/admin/orders" className="block rounded-lg px-3 py-2 text-sm hover:bg-slate-700">Order control</Link>}<button className="w-full rounded-lg px-3 py-2 text-left text-sm text-red-300 hover:bg-slate-700" onClick={logout}>Sign out</button></div></div> : <Link to="/auth" className="btn btn-primary hidden px-3 py-2 text-sm md:inline-flex">Sign in</Link>}
      <button className="grid h-9 w-9 place-items-center rounded-lg border border-line lg:hidden" onClick={() => setOpen(value => !value)} aria-label="Open menu">{open ? <X size={18}/> : <Menu size={18}/>}</button>
    </div>
    {open && <div className="border-t border-line bg-panel px-4 py-3 lg:hidden"><nav className="shell grid gap-1">{links.map(link => <Link key={link.to} to={link.to} onClick={() => setOpen(false)} className="rounded-lg px-3 py-2 text-sm font-semibold text-slate-200 hover:bg-slate-700">{link.label}</Link>)}{account ? <Link to={portal} className="rounded-lg px-3 py-2 text-sm font-semibold text-brand-light">My workspace</Link> : <Link to="/auth" className="rounded-lg px-3 py-2 text-sm font-semibold text-brand-light">Sign in</Link>}</nav></div>}
    <CartDrawer open={cartOpen} close={() => setCartOpen(false)}/>
  </header>;
}

function CartDrawer({ open, close }) {
  const { items, subtotal, update, remove } = useCart();
  return <div className={'fixed inset-0 z-70 ' + (open ? '' : 'pointer-events-none')}><div className={'absolute inset-0 bg-black/60 transition ' + (open ? 'opacity-100' : 'opacity-0')} onClick={close}/><aside className={'absolute right-0 top-0 flex h-full w-[min(26rem,100%)] flex-col bg-surface shadow-2xl transition-transform duration-300 ' + (open ? 'translate-x-0' : 'translate-x-full')}><div className="flex items-center justify-between border-b border-line p-5"><b className="text-lg">Your cart</b><button onClick={close} className="rounded-lg p-2 hover:bg-slate-700"><X/></button></div><div className="flex-1 overflow-y-auto p-5">{items.length === 0 ? <div className="grid h-full place-items-center text-center text-muted"><ShoppingBag className="mb-3" size={32}/><p>Your cart is ready when you are.</p></div> : <div className="grid gap-4">{items.map(item => <div className="flex gap-3 border-b border-line pb-4" key={item._id}><div className="grid h-16 w-16 shrink-0 place-items-center overflow-hidden rounded-lg bg-slate-800">{item.image ? <img src={imageUrl(item.image)} className="h-full w-full object-cover" alt=""/> : <ShoppingBag className="text-brand-light" size={22}/>}</div><div className="min-w-0 flex-1"><b className="block truncate text-sm">{item.name}</b><span className="text-sm text-brand-light">{money(item.price)}</span><div className="mt-2 flex items-center gap-2"><button onClick={() => update(item._id, item.quantity - 1)} className="rounded border border-line p-1"><Minus size={13}/></button><span className="w-5 text-center text-sm">{item.quantity}</span><button onClick={() => update(item._id, item.quantity + 1)} className="rounded border border-line p-1"><Plus size={13}/></button><button onClick={() => remove(item._id)} className="ml-auto text-red-300"><Trash2 size={16}/></button></div></div></div>)}</div>}</div>{items.length > 0 && <div className="border-t border-line p-5"><div className="mb-4 flex justify-between text-lg font-bold"><span>Subtotal</span><span>{money(subtotal)}</span></div><Link to="/checkout" onClick={close} className="btn btn-primary w-full">Proceed to checkout</Link></div>}</aside></div>;
}

export function Guard({ roles, children }) {
  const { account, loading } = useAuth();
  const navigate = useNavigate();
  useEffect(() => { if (!loading && !account) navigate({ to: '/auth' }); }, [loading, account]);
  if (loading) return <Spinner/>;
  if (!account) return <div className="shell py-20"><Spinner/></div>;
  if (roles && !roles.some(role => account.roles.includes(role))) return <div className="shell py-20 text-center"><h1 className="text-2xl font-bold">Access restricted</h1><p className="mt-2 text-muted">Your account does not have access to this workspace.</p></div>;
  return children;
}

export function ProductCard({ product }) {
  const { add } = useCart();
  const toast = useToast();
  const price = product.discount_price ?? product.price;
  return <article className="card group overflow-hidden"><Link to="/product/$slug" params={{ slug: product.slug }} className="grid aspect-[4/3] place-items-center overflow-hidden bg-slate-800">{product.images?.[0] ? <img src={imageUrl(product.images[0])} alt={product.name} className="h-full w-full object-cover transition duration-500 group-hover:scale-105"/> : <ShoppingBag className="text-brand-light" size={40}/>}</Link><div className="p-4"><p className="mb-1 text-xs font-bold uppercase tracking-wider text-brand-light">{product.category_id?.name || 'Water care'}</p><Link to="/product/$slug" params={{ slug: product.slug }} className="line-clamp-1 font-bold text-white hover:text-brand-light">{product.name}</Link><div className="mt-3 flex items-center justify-between gap-2"><div><b>{money(price)}</b>{product.discount_price && <s className="ml-2 text-xs text-muted">{money(product.price)}</s>}</div><button disabled={product.stock < 1} onClick={() => { add(product); toast(product.name + ' added to cart'); }} className="btn btn-primary px-3 py-2 text-xs disabled:opacity-50">{product.stock ? 'Add' : 'Out of stock'}</button></div></div></article>;
}

function Footer() {
  return <footer className="mt-16 border-t border-line bg-[#0b1220]"><div className="shell grid gap-10 py-12 md:grid-cols-[1.3fr_1fr_1fr]"><div><Logo/><p className="mt-4 max-w-sm text-sm leading-6 text-muted">Premium water purifiers, dependable installations and responsive care for healthier homes and businesses.</p></div><div><b className="text-sm text-white">Quick links</b><div className="mt-3 grid gap-2 text-sm text-muted"><Link to="/products">Products</Link><Link to="/services">Service booking</Link><Link to="/track">Track order or ticket</Link><Link to="/about">About SWS</Link></div></div><div><b className="text-sm text-white">Talk to SWS</b><div className="mt-3 grid gap-2 text-sm text-muted"><a href="tel:+919949792248">+91 9949792248</a><a href="mailto:sujalawatersolutions@gmail.com">sujalawatersolutions@gmail.com</a><a href="https://maps.app.goo.gl/YTEotBoCWof5gvMJA" target="_blank" rel="noreferrer">Find us on Google Maps</a></div><div className="mt-4 flex gap-3"><a className="text-emerald-400" aria-label="WhatsApp" href="https://wa.me/919949792248" target="_blank" rel="noreferrer"><MessageCircle size={19}/></a><a aria-label="Facebook" href="#" onClick={event => event.preventDefault()}><Facebook size={19}/></a><a aria-label="Instagram" href="#" onClick={event => event.preventDefault()}><Instagram size={19}/></a><a aria-label="YouTube" href="#" onClick={event => event.preventDefault()}><Youtube size={19}/></a></div></div></div><div className="border-t border-line py-5 text-center text-xs text-muted">© {new Date().getFullYear()} Sujala Water Solutions. Pure water. Protected life.</div></footer>;
}
