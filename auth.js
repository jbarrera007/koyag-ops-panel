require('dotenv').config();
const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;

const allowedEmails = (process.env.ALLOWED_EMAILS || '')
  .split(',')
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean);

// Solo registrar la estrategia si las credenciales están configuradas
if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
  passport.use(
    new GoogleStrategy(
      {
        clientID: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        callbackURL: process.env.GOOGLE_CALLBACK_URL,
      },
      (accessToken, refreshToken, profile, done) => {
        const email = (profile.emails?.[0]?.value || '').toLowerCase();
        if (!allowedEmails.includes(email)) {
          return done(null, false, { message: 'Email no autorizado' });
        }
        return done(null, { email, nombre: profile.displayName });
      }
    )
  );
} else {
  console.warn('[Auth] GOOGLE_CLIENT_ID no configurado — autenticación OAuth deshabilitada');
}

passport.serializeUser((user, done) => done(null, user));
passport.deserializeUser((user, done) => done(null, user));

function requireAuth(req, res, next) {
  if (req.isAuthenticated()) return next();
  res.status(401).json({ error: 'No autenticado' });
}

function setupAuthRoutes(app) {
  app.get('/auth/google', (req, res, next) => {
    if (!process.env.GOOGLE_CLIENT_ID) {
      return res.status(503).send('OAuth no configurado. Define GOOGLE_CLIENT_ID en .env');
    }
    passport.authenticate('google', { scope: ['profile', 'email'] })(req, res, next);
  });

  app.get(
    '/auth/google/callback',
    passport.authenticate('google', { failureRedirect: '/login' }),
    (req, res) => {
      res.redirect('/');
    }
  );

  app.get('/auth/logout', (req, res, next) => {
    req.logout((err) => {
      if (err) return next(err);
      req.session.destroy(() => res.redirect('/login'));
    });
  });

  app.get('/auth/me', (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ error: 'No autenticado' });
    res.json({ email: req.user.email, nombre: req.user.nombre });
  });
}

module.exports = { requireAuth, setupAuthRoutes };
