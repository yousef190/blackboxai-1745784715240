const passport = require('passport');
const GitHubStrategy = require('passport-github2').Strategy;
const { findUserByGitHubId, createUser, findUserByUsernameOrEmail } = require('../models/user');

passport.use(new GitHubStrategy({
  clientID: process.env.GITHUB_CLIENT_ID,
  clientSecret: process.env.GITHUB_CLIENT_SECRET,
  callbackURL: '/auth/github/callback',
}, async (accessToken, refreshToken, profile, done) => {
  try {
    let user = await findUserByGitHubId(profile.id);
    if (!user) {
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

passport.serializeUser((user, done) => {
  done(null, user.id);
});

passport.deserializeUser(async (id, done) => {
  try {
    const user = await findUserByUsernameOrEmail(id);
    done(null, user);
  } catch (err) {
    done(err);
  }
});

module.exports = passport;
