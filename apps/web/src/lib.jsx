import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { CheckCircle2, Droplets, LoaderCircle } from 'lucide-react';

export const API_URL = import.meta.env.VITE_API_URL || '/api';
export const api = async (path, options = {}) => {
  const token = options.token ?? localStorage.getItem('sws_token');
  const headers = { ...(options.body instanceof FormData ? {} : { 'Content-Type': 'application/json' }), ...(options.headers || {}) };
  if (token) headers.Authorization = 'Bearer ' + token;
  const response = await fetch(API_URL + path, { method: options.method || 'GET', headers, body: options.body instanceof FormData ? options.body : options.body ? JSON.stringify(options.body) : undefined });
  const data = response.status === 204 ? null : await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || 'Something went wrong');
  return data;
};
export const money = amount => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(amount || 0);
export const date = value => value ? new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium' }).format(new Date(value)) : '—';
export const imageUrl = path => path?.startsWith('/uploads/') && API_URL.startsWith('http') ? API_URL.replace(/\/api$/, '') + path : path;

const AuthContext = createContext(null);
export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => localStorage.getItem('sws_token') || '');
  const [account, setAccount] = useState(null);
  const [loading, setLoading] = useState(Boolean(token));
  const refresh = async () => {
    if (!token) { setAccount(null); setLoading(false); return; }
    try { setAccount(await api('/auth/me', { token })); } catch { localStorage.removeItem('sws_token'); setToken(''); setAccount(null); }
    finally { setLoading(false); }
  };
  useEffect(() => { refresh(); }, [token]);
  const signIn = async payload => {
    localStorage.setItem('sws_token', payload.token);
    setToken(payload.token);
    setAccount({ user: payload.user, roles: payload.roles, profile: null });
    return payload;
  };
  const logout = () => { localStorage.removeItem('sws_token'); setToken(''); setAccount(null); };
  return <AuthContext.Provider value={{ token, account, loading, refresh, signIn, logout }}>{children}</AuthContext.Provider>;
}
export const useAuth = () => useContext(AuthContext);

const CartContext = createContext(null);
export function CartProvider({ children }) {
  const [items, setItems] = useState(() => JSON.parse(localStorage.getItem('sws_cart') || '[]'));
  useEffect(() => localStorage.setItem('sws_cart', JSON.stringify(items)), [items]);
  const add = (product, quantity = 1) => setItems(current => {
    const found = current.find(item => item._id === product._id);
    return found ? current.map(item => item._id === product._id ? { ...item, quantity: Math.min(item.quantity + quantity, product.stock) } : item) : [...current, { _id: product._id, name: product.name, slug: product.slug, price: product.discount_price ?? product.price, image: product.images?.[0] || '', stock: product.stock, quantity }];
  });
  const update = (id, quantity) => setItems(current => quantity < 1 ? current.filter(item => item._id !== id) : current.map(item => item._id === id ? { ...item, quantity: Math.min(quantity, item.stock) } : item));
  const remove = id => setItems(current => current.filter(item => item._id !== id));
  const clear = () => setItems([]);
  const value = useMemo(() => ({ items, add, update, remove, clear, count: items.reduce((sum, item) => sum + item.quantity, 0), subtotal: items.reduce((sum, item) => sum + item.price * item.quantity, 0) }), [items]);
  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}
export const useCart = () => useContext(CartContext);

const ToastContext = createContext(null);
export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const toast = message => {
    const id = Date.now() + Math.random();
    setToasts(items => [...items, { id, message }]);
    setTimeout(() => setToasts(items => items.filter(item => item.id !== id)), 4500);
  };
  return <ToastContext.Provider value={toast}>{children}<div className="fixed right-4 top-20 z-80 grid w-[min(24rem,calc(100vw-2rem))] gap-2">{toasts.map(item => <div className="glass flex items-start gap-2 rounded-xl p-3 text-sm shadow-2xl" key={item.id}><CheckCircle2 className="mt-.5 shrink-0 text-brand-light" size={18}/><span>{item.message}</span></div>)}</div></ToastContext.Provider>;
}
export const useToast = () => useContext(ToastContext);

export function Logo({ compact = false }) {
  return <div className="flex items-center gap-2"><span className="grid h-9 w-9 place-items-center rounded-xl bg-brand font-black text-white shadow-lg shadow-blue-500/20">SWS</span>{!compact && <span className="leading-tight"><b className="block text-sm tracking-tight text-ink font-display">Sujala Water</b><span className="block text-[10px] font-semibold tracking-[.18em] text-brand-light">SOLUTIONS</span></span>}</div>;
}
export function Spinner() { return <div className="grid min-h-48 place-items-center text-muted"><LoaderCircle className="animate-spin" size={28}/></div>; }
export function Empty({ title = 'Nothing here yet', detail }) { return <div className="card grid min-h-40 place-items-center p-6 text-center"><Droplets className="mb-3 text-brand-light" size={28}/><b>{title}</b>{detail && <p className="mt-1 text-sm text-muted">{detail}</p>}</div>; }
export function Seo({ title, description }) {
  useEffect(() => {
    document.title = title ? title + ' | Sujala Water Solutions' : 'Sujala Water Solutions | Pure water. Protected life.';
    if (description) document.querySelector('meta[name="description"]')?.setAttribute('content', description);
  }, [title, description]);
  return null;
}
export function SectionTitle({ eyebrow, title, children }) {
  return <div className="mb-7 flex flex-wrap items-end justify-between gap-4"><div>{eyebrow && <p className="eyebrow mb-3">{eyebrow}</p>}<h2 className="font-display text-2xl font-bold tracking-tight text-ink sm:text-3xl">{title}</h2></div>{children}</div>;
}
