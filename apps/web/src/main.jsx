import React from 'react';
import ReactDOM from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Outlet, RouterProvider, createRootRoute, createRoute, createRouter } from '@tanstack/react-router';
import { AuthPage, Checkout, Contact, Home, About, OrderDetail, ProductDetail, Products, Services, Track } from './storefront.jsx';
import { AdminComplaints, AdminDashboard, AdminOrders, AdminPayment, AdminProducts, AdminUsers, CustomerDashboard, TechnicianDashboard } from './portal.jsx';
import { AuthProvider, CartProvider, ToastProvider } from './lib.jsx';
import { Guard, Shell } from './shell.jsx';
import './styles.css';

const queryClient = new QueryClient();
function Root() {
  return <QueryClientProvider client={queryClient}><AuthProvider><CartProvider><ToastProvider><Shell><Outlet/></Shell></ToastProvider></CartProvider></AuthProvider></QueryClientProvider>;
}
const rootRoute = createRootRoute({ component: Root });
const route = (path, component) => createRoute({ getParentRoute: () => rootRoute, path, component });
const routeTree = rootRoute.addChildren([
  route('/', Home), route('/products', Products), route('/product/$slug', ProductDetail),
  route('/services', Services), route('/about', About), route('/contact', Contact), route('/auth', AuthPage), route('/track', Track),
  route('/checkout', () => <Guard><Checkout/></Guard>),
  route('/dashboard', () => <Guard><CustomerDashboard/></Guard>),
  route('/complaints', () => <Guard><CustomerDashboard/></Guard>),
  route('/order/$number', () => <Guard><OrderDetail/></Guard>),
  route('/admin', () => <Guard roles={['admin']}><AdminDashboard/></Guard>),
  route('/admin/products', () => <Guard roles={['admin']}><AdminProducts/></Guard>),
  route('/admin/orders', () => <Guard roles={['admin']}><AdminOrders/></Guard>),
  route('/admin/complaints', () => <Guard roles={['admin']}><AdminComplaints/></Guard>),
  route('/admin/payment', () => <Guard roles={['admin']}><AdminPayment/></Guard>),
  route('/admin/users', () => <Guard roles={['admin']}><AdminUsers/></Guard>),
  route('/technician', () => <Guard roles={['technician']}><TechnicianDashboard/></Guard>)
]);
const router = createRouter({ routeTree, defaultPreload: 'intent' });

ReactDOM.createRoot(document.getElementById('root')).render(<React.StrictMode><RouterProvider router={router}/></React.StrictMode>);
