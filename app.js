require('dotenv').config();
const express = require('express');
const session = require('express-session');
const pg = require('pg');
const pgSession = require('connect-pg-simple')(session);
const passport = require('./config/passport');
const flash = require('express-flash');
const csurf = require('csurf');
const path = require('path');
const helmet = require('helmet');

const authRoutes = require('./routes/auth');
const { ensureAuthenticated } = require('./middleware/auth');

const app = express();

// Database pool for session store and queries
const pgPool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

// Security HTTP headers
app.use(helmet());

// View engine setup
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Middleware to parse form data
app.use(express.urlencoded({ extended: true }));

// Session configuration with secure cookies and PostgreSQL store
app.use(session({
  store: new pgSession({
    pool: pgPool,
    tableName: 'session',
  }),
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production', // HTTPS only in production
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    sameSite: 'lax',
  },
}));

// Initialize Passport and restore authentication state, if any, from the session
app.use(passport.initialize());
app.use(passport.session());

// Flash messages for errors and info
app.use(flash());

// CSRF protection middleware
app.use(csurf());

// Middleware to pass CSRF token and flash messages to all views
app.use((req, res, next) => {
  res.locals.csrfToken = req.csrfToken();
  res.locals.user = req.user;
  res.locals.errorMessages = req.flash('error');
  res.locals.successMessages = req.flash('success');
  next();
});

// Cache control headers to prevent back navigation after logout
app.use((req, res, next) => {
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  next();
});

// Static files (if any)
app.use(express.static(path.join(__dirname, 'public')));

// Routes
app.use('/', authRoutes);

// Protected dashboard route example
app.get('/dashboard', ensureAuthenticated, (req, res) => {
  res.render('dashboard', { user: req.user });
});

// Error handling middleware
app.use((err, req, res, next) => {
  if (err.code === 'EBADCSRFTOKEN') {
    // CSRF token errors
    req.flash('error', 'Form tampered with.');
    return res.redirect('back');
  }
  console.error(err);
  req.flash('error', err.message || 'An unexpected error occurred.');
  res.redirect('back');
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
