# Sujala Water Solutions (SWS)

A self-hosted ecommerce and CRM application for water purifier sales, service, installation and order fulfilment. It uses a React 19 storefront with TanStack Router/Query and Tailwind CSS v4, alongside an Express/MongoDB API, Socket.IO notifications and Docker.

## What is included

- Public Samsung-inspired storefront: home, product catalogue/search, product details, services, about, contact and public order/ticket tracking.
- JWT + bcrypt authentication, Google Identity sign-in, profiles and automatic admin assignment for the three supplied SWS email addresses.
- Persistent cart, authenticated checkout, COD and manually verified bank-transfer payment workflow.
- Product catalogue, image upload to local persistent storage, stock handling, configurable delivery charge/threshold and optional GST.
- Customer orders, account profile, service requests and complaint ticket tracking.
- Admin dashboards for products, orders, complaints/technician assignment, payment/SMTP/shipping settings, users and roles.
- Technician workspace for assigned work and status changes.
- Socket.IO real-time admin order/complaint notifications and browser notifications where the browser has granted permission.
- Nodemailer order and complaint alerts with configurable SMTP plus the default admin notification email.
- Docker Compose services for MongoDB, API, storefront and HTTPS-ready Caddy reverse proxy.

## Local development

Requirements: Node.js 22+, npm, and either a local MongoDB server or Docker.

1. Copy .env.example to .env.
2. Set JWT_SECRET to a long random value. For local development, use MONGO_URI=mongodb://127.0.0.1:27017/sujala_water_solutions.
3. Install packages with npm install.
4. Start MongoDB and run npm run seed to create roles, default settings, categories and a sample product.
5. Run npm run dev.

The storefront is available at http://localhost:5173, and the API health endpoint is http://localhost:4000/api/health.

## Production with Docker

1. Copy and complete .env. At minimum provide a production JWT_SECRET, appropriate CLIENT_URL, SMTP credentials and Google client IDs if Google Sign-In is used.
2. Set SWS_DOMAIN in .env to the real public hostname.
3. Set VITE_API_URL=/api so the built browser app talks through Caddy.
4. Run docker compose up -d --build.

Caddy obtains and renews HTTPS certificates automatically for a real public domain. Keep the named mongo_data and uploads_data volumes backed up.

## First administrator and operating setup

Register or sign in with any of these addresses to obtain the admin role automatically:

- sujalawatersolutions@gmail.com
- sanjaypolu3@gmail.com
- 2303a51731@sru.edu.in

After sign-in, open the Payments & settings admin screen to set UPI/bank instructions, free-shipping threshold, GST and SMTP. Create technician users by having them register, then give them the technician role from Users & roles. The admin order workflow prevents a bank-transfer order from being confirmed until its payment status is changed to paid.

## Environment variables

| Name | Purpose |
| --- | --- |
| MONGO_URI | MongoDB connection string |
| JWT_SECRET / JWT_EXPIRES_IN | Session signing configuration |
| PORT / CLIENT_URL | API listener and permitted browser origin |
| GOOGLE_CLIENT_ID | Server-side Google ID token verification |
| VITE_GOOGLE_CLIENT_ID | Browser Google Identity button |
| VITE_API_URL | Browser API URL, normally /api in Docker |
| SMTP_*, SMTP_FROM | Default mail transport (admin values can override) |
| ADMIN_NOTIFICATION_EMAIL | Fallback mail recipient |
| UPLOAD_DIR | Optional local product image directory |

## Backups

Run sh scripts/backup-mongodb.sh from the project root to create a compressed dump. Set BACKUP_DIR, MONGO_DB_NAME, and BACKUP_RETENTION_DAYS as needed. Schedule this script externally, and separately preserve the Docker uploads_data volume containing product images.

## Verification

Run npm run build to parse all API modules and create the production React bundle.
