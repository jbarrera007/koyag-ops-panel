require('dotenv').config();
const express = require('express');
const session = require('express-session');
const passport = require('passport');
const path = require('path');

const { connect: connectMongo } = require('./db/mongo');
const { testConnection: testMySQL } = require('./db/mysql');
const { setupAuthRoutes } = require('./auth');
const comunidadesRouter = require('./routes/comunidades');
const nexoRouter = require('./routes/nexo');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(
  session({
    secret: process.env.SESSION_SECRET || 'dev-secret',
    resave: false,
    saveUninitialized: false,
    cookie: { secure: false, maxAge: 8 * 60 * 60 * 1000 }, // 8 horas
  })
);

app.use(passport.initialize());
app.use(passport.session());

// Archivos estáticos
app.use(express.static(path.join(__dirname, 'public')));

// Ruta de login (sirve index.html — el frontend maneja el estado)
app.get('/login', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Rutas
setupAuthRoutes(app);
app.use('/api/comunidades', comunidadesRouter);
app.use('/api/nexo', nexoRouter);

// Fallback SPA (Express 5 wildcard syntax)
app.get('/{*path}', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Arrancar servidor y conexiones
app.listen(PORT, async () => {
  console.log(`[Server] Corriendo en http://localhost:${PORT}`);
  await Promise.all([connectMongo(), testMySQL()]);
});
