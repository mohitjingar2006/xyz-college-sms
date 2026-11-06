# XYZ College Student Management System (SMS)

A modern, zero-cost, full-stack Student Management System built for the web. This application serves as a lightweight Academic ERP, providing role-based portals for Students, Faculty, and Administrators.

## 🚀 Live Demo
**[Insert Vercel Deployment Link Here]**

## 🛠️ Tech Stack
* **Frontend:** HTML5, CSS3 (Tailwind CSS via CDN), Vanilla JavaScript (ES6 Modules)
* **Backend & Auth:** Supabase (PostgreSQL, GoTrue Authentication)
* **Deployment:** Vercel (Global CDN)

## ✨ Key Features
* **Role-Based Access Control (RBAC):** Secure, distinct routing and data access for `admin`, `faculty`, and `student` roles.
* **Authentication:** Secure email/password login, automatic session handling, and custom database-driven password recovery via security questions.
* **Admin Dashboard:** Manage users, toggle global registration windows, and view institution-wide metrics.
* **Faculty Portal:** View assigned courses, manage student attendance, update marks, and submit course teaching applications.
* **Student Portal:** Browse and register for active courses, view personal attendance and grades, and update profile information.
* **Zero-Cost Infrastructure:** Architected to run entirely on free-tier services without a build step.

## 📂 Project Structure
```text
xyz-college-sms/
├── index.html            # Main landing and authentication page
├── admin.html            # Admin dashboard and user management
├── faculty.html          # Faculty portal
├── student.html          # Student portal
├── styles.css            # Global CSS variables and custom styles
├── scripts/
│   ├── auth.js           # Login, logout, and password recovery logic
│   ├── profile.js        # Universal profile editing component
│   └── supabaseClient.js # Supabase connection and database API methods
└── seed.mjs              # Node.js script for database population
```

## ⚙️ Local Setup & Deployment

1. **Clone the repository:**
   ```bash
   git clone https://github.com/YOUR-USERNAME/xyz-college-sms.git
   cd xyz-college-sms
   ```

2. **Configure Supabase:**
   * Create a Supabase project and run the provided SQL schema to generate tables.
   * Open `scripts/supabaseClient.js` and update the environment variables:
     ```javascript
     export const SUPABASE_URL = 'https://your-project-id.supabase.co';
     export const SUPABASE_ANON_KEY = 'your-anon-key';
     ```

3. **Run Locally:**
   Use any local web server to serve the files (e.g., VS Code Live Server, Python HTTP server).
   ```bash
   python -m http.server 8000
   ```

4. **Deploy to Vercel:**
   * Push your code to GitHub.
   * Import the repository in Vercel.
   * Leave Build Command and Output Directory blank. Deploy!