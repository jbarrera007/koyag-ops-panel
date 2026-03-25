const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const { query } = require('../db/mysql');
const { requireAuth } = require('../auth');

const LOG_PATH = path.join(__dirname, '..', 'logs', 'acciones.log');

function log(userEmail, accion, plataforma, extras) {
  const linea = `[${new Date().toISOString()}] ${userEmail} | ${accion} | ${plataforma} | ${extras}\n`;
  fs.appendFile(LOG_PATH, linea, () => {});
}

// GET /api/comunidades/eventos
router.get('/eventos', requireAuth, async (req, res) => {
  try {
    const rows = await query(
      'SELECT id, name, start_at FROM events WHERE deleted_at IS NULL ORDER BY name',
      []
    );
    res.json(rows.map((e) => ({ id: e.id, nombre: e.name, fechaInicio: e.start_at ?? null })));
  } catch (err) {
    console.error('[Comunidades] eventos:', err.message);
    res.status(503).json({ error: 'No se puede conectar a Comunidades en este momento' });
  }
});

// GET /api/comunidades/eventos/:id/inscriptos
router.get('/eventos/:id/inscriptos', requireAuth, async (req, res) => {
  const { id } = req.params;
  try {
    const rows = await query(
      `SELECT sr.id AS inscripcion_id, u.id AS user_id,
              u.firstname, u.lastname, u.username AS email, u.phone
       FROM signup_registereds sr
       JOIN signups s ON s.id = sr.signup_id
       JOIN users u   ON u.id = sr.user_id
       WHERE s.event_id = ?
         AND sr.deleted_at IS NULL
         AND s.deleted_at IS NULL
         AND u.deleted_at IS NULL
       ORDER BY u.lastname, u.firstname`,
      [id]
    );
    res.json(rows.map((r) => ({
      inscripcionId: r.inscripcion_id,
      userId:        r.user_id,
      nombre:        r.firstname || '',
      apellido:      r.lastname  || '',
      email:         r.email,
      telefono:      r.phone     || '',
    })));
  } catch (err) {
    console.error('[Comunidades] inscriptos:', err.message);
    res.status(503).json({ error: 'No se puede conectar a Comunidades en este momento' });
  }
});

// GET /api/comunidades/personas?page=1&q=texto
router.get('/personas', requireAuth, async (req, res) => {
  const page   = Math.max(1, parseInt(req.query.page) || 1);
  const q      = (req.query.q || '').trim();
  const offset = (page - 1) * 10;
  try {
    const like = `%${q}%`;
    const rows = await query(
      `SELECT u.id, u.firstname, u.lastname, u.username AS email,
              o.name AS empresa, o.nit, o.business_profile
       FROM users u
       LEFT JOIN organizations o ON o.id = u.organization_id
       WHERE u.deleted_at IS NULL
         ${q ? 'AND (u.firstname LIKE ? OR u.lastname LIKE ? OR u.username LIKE ? OR o.name LIKE ?)' : ''}
       ORDER BY u.lastname, u.firstname
       LIMIT 10 OFFSET ?`,
      q ? [like, like, like, like, offset] : [offset]
    );
    res.json({
      data: rows.map((r) => ({
        id:                 r.id,
        nombre:             r.firstname        || '',
        apellido:           r.lastname         || '',
        email:              r.email            || '',
        empresa:            r.empresa          || '',
        nit:                r.nit              || '',
        perfilEmpresarial:  r.business_profile || '',
      })),
      hasMore: rows.length === 10,
    });
  } catch (err) {
    console.error('[Comunidades] personas:', err.message);
    res.status(503).json({ error: 'No se puede conectar a Comunidades en este momento' });
  }
});

// GET /api/comunidades/buscar?q=texto
// Busca por firstname, lastname o username (email)
router.get('/buscar', requireAuth, async (req, res) => {
  const { q } = req.query;
  if (!q) return res.status(400).json({ error: 'Parámetro q requerido' });
  try {
    const rows = await query(
      `SELECT id, firstname, lastname, username, phone
       FROM users
       WHERE (firstname LIKE ? OR lastname LIKE ? OR username LIKE ?)
         AND deleted_at IS NULL
       LIMIT 10`,
      [`%${q}%`, `%${q}%`, `%${q}%`]
    );
    res.json(rows.map((u) => ({
      id: u.id,
      nombre: `${u.firstname || ''} ${u.lastname || ''}`.trim(),
      email: u.username,
    })));
  } catch (err) {
    console.error('[Comunidades] buscar:', err.message);
    res.status(503).json({ error: 'No se puede conectar a Comunidades en este momento' });
  }
});

// GET /api/comunidades/usuarios/:id
router.get('/usuarios/:id', requireAuth, async (req, res) => {
  const { id } = req.params;
  try {
    const usuarios = await query(
      'SELECT id, firstname, lastname, username, phone FROM users WHERE id = ? AND deleted_at IS NULL',
      [id]
    );
    if (!usuarios.length) return res.status(404).json({ error: 'Usuario no encontrado' });

    // Eventos: events -> signups -> signup_registereds
    // Retornamos signup_registereds.id como id de la inscripción (es lo que se elimina)
    const eventos = await query(
      `SELECT sr.id, e.name
       FROM signup_registereds sr
       JOIN signups s ON s.id = sr.signup_id
       JOIN events e ON e.id = s.event_id
       WHERE sr.user_id = ?
         AND sr.deleted_at IS NULL
         AND s.deleted_at IS NULL
         AND e.deleted_at IS NULL`,
      [id]
    );

    const u = usuarios[0];
    res.json({
      id: u.id,
      nombre: u.firstname || '',
      apellido: u.lastname || '',
      email: u.username,
      telefono: u.phone || '',
      eventos: eventos.map((e) => ({ id: e.id, nombre: e.name })),
    });
  } catch (err) {
    console.error('[Comunidades] usuario/:id:', err.message);
    res.status(503).json({ error: 'No se puede conectar a Comunidades en este momento' });
  }
});

// PATCH /api/comunidades/usuarios/:id
router.patch('/usuarios/:id', requireAuth, async (req, res) => {
  const { id } = req.params;
  const { nombre, apellido, email, telefono } = req.body;
  const campos = [];
  const valores = [];
  if (nombre !== undefined)   { campos.push('firstname = ?'); valores.push(nombre); }
  if (apellido !== undefined) { campos.push('lastname = ?');  valores.push(apellido); }
  if (email !== undefined)    { campos.push('username = ?');  valores.push(email); }
  if (telefono !== undefined) { campos.push('phone = ?');     valores.push(telefono); }
  if (!campos.length) return res.status(400).json({ error: 'No hay campos para actualizar' });
  valores.push(id);
  try {
    await query(`UPDATE users SET ${campos.join(', ')} WHERE id = ? AND deleted_at IS NULL`, valores);
    log(req.user.email, 'EDITAR_USUARIO', 'comunidades', `usuario_id=${id}`);
    res.json({ ok: true });
  } catch (err) {
    console.error('[Comunidades] patch usuario:', err.message);
    res.status(503).json({ error: 'No se puede conectar a Comunidades en este momento' });
  }
});

// DELETE /api/comunidades/usuarios/:id/evento/:signupRegisteredId
// Soft delete sobre signup_registereds
router.delete('/usuarios/:id/evento/:signupRegisteredId', requireAuth, async (req, res) => {
  const { id, signupRegisteredId } = req.params;
  try {
    await query(
      'UPDATE signup_registereds SET deleted_at = NOW() WHERE id = ? AND user_id = ? AND deleted_at IS NULL',
      [signupRegisteredId, id]
    );
    log(req.user.email, 'ELIMINAR_EVENTO', 'comunidades', `usuario_id=${id} | signup_registered_id=${signupRegisteredId}`);
    res.json({ ok: true });
  } catch (err) {
    console.error('[Comunidades] delete evento:', err.message);
    res.status(503).json({ error: 'No se puede conectar a Comunidades en este momento' });
  }
});

module.exports = router;
