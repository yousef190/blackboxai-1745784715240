const express = require('express');
const passport = require('passport');
const GitHubStrategy = require('passport-github2').Strategy;
const { createUser, findUserByUsernameOrEmail, verifyPassword, findUserByGitHubId } = require('../models/user');
const { logLoginAttempt } = require('../models/loginLog');

const router = express.Router();

// Passport GitHub Strategy configuration
passport.use(new GitHubStrategy({
  clientID: process.env.GITHUB_CLIENT_ID,
  clientSecret: process.env.GITHUB_CLIENT_SECRET,
  callbackURL: '/auth/github/callback',
}, async (accessToken, refreshToken, profile, done) => {
  try {
    let user = await findUserByGitHubId(profile.id);
    if (!user) {
      // Auto-provision user on first GitHub login
      const email = profile.emails && profile.emails[0] ? profile.emails[0].value : null;
      user = await createUser({
        username: profile.username,
        email: email,
        github_id: profile.id,
        auth_method: 'github',
      });
    }
    return done(null, user);
  } catch (err) {
    return done(err);
  }
}));

// Serialize user to session
passport.serializeUser((user, done) => {
  done(null, user.id);
});

// Deserialize user from session
passport.deserializeUser(async (id, done) => {
  try {
    const user = await findUserByUsernameOrEmail(id);
    done(null, user);
  } catch (err) {
    done(err);
  }
});

// GET /login - render login page
router.get('/login', (req, res) => {
  res.render('login');
});

// POST /login - manual login
router.post('/login', async (req, res, next) => {
  const { identifier, password, rememberMe } = req.body;
  try {
    const user = await findUserByUsernameOrEmail(identifier);
    if (!user) {
      req.flash('error', 'Invalid username/email or password.');
      return res.redirect('/login');
    }
    const validPassword = await verifyPassword(user, password);
    if (!validPassword) {
      req.flash('error', 'Invalid username/email or password.');
      return res.redirect('/login');
    }
    req.login(user, async (err) => {
      if (err) return next(err);
      // Log login attempt
      await logLoginAttempt(user.id, req.ip);
      // Set session maxAge if rememberMe checked
      if (rememberMe) {
        req.session.cookie.maxAge = 7 * 24 * 60 * 60 * 1000; // 7 days
      } else {
        req.session.cookie.expires = false; // Session cookie
      }
      return res.redirect('/dashboard');
    });
  } catch (err) {
    next(err);
  }
});

// GET /register - render registration page
router.get('/register', (req, res) => {
  res.render('register');
});

// POST /register - create new user
router.post('/register', async (req, res, next) => {
  const { username, email, password } = req.body;
  try {
    await createUser({ username, email, password, auth_method: 'manual' });
    req.flash('success', 'Registration successful. Please log in.');
    res.redirect('/login');
  } catch (err) {
    if (err.code === '23505') { // Unique violation
      req.flash('error', 'Username or email already exists.');
      return res.redirect('/register');
    }
    next(err);
  }
});

// GET /logout - logout user
router.get('/logout', (req, res, next) => {
  req.logout((err) => {
    if (err) return next(err);
    req.session.destroy(() => {
      res.clearCookie('connect.sid');
      res.redirect('/login');
    });
  });
});

// GET /auth/github - start GitHub OAuth login
router.get('/auth/github', passport.authenticate('github', { scope: ['user:email'] }));

// GET /auth/github/callback - GitHub OAuth callback
router.get('/auth/github/callback',
  passport.authenticate('github', {
    failureRedirect: '/login',
    failureFlash: true,
  }),
  async (req, res) => {
    // Log login attempt
    await logLoginAttempt(req.user.id, req.ip);
    res.redirect('/dashboard');
  }
);

module.exports = router;
