function ensureAuthenticated(req, res, next) {
  if (req.isAuthenticated && req.isAuthenticated()) {
    return next();
  }
  req.flash('error', 'Please log in to view that resource');
  res.redirect('/login');
}

module.exports = {
  ensureAuthenticated,
};
