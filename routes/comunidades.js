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

// GET /api/comunidades/buscar?q=texto
router.get('/buscar', requireAuth, async (req, res) => {
  const { q } = req.query;
  if (!q) return res.status(400).json({ error: 'Parámetro q requerido' });
  try {
    const rows = await query(
      `SELECT id, nombre, apellido, email, telefono
       FROM usuarios
       WHERE nombre LIKE ? OR apellido LIKE ? OR email LIKE ?
       LIMIT 10`,
      [`%${q}%`, `%${q}%`, `%${q}%`]
    );
    res.json(rows);
  } catch (err) {
    console.error('[Comunidades] buscar:', err.message);
    res.status(503).json({ error: 'No se puede conectar a Comunidades en este momento' });
  }
});

// GET /api/comunidades/usuarios/:id
router.get('/usuarios/:id', requireAuth, async (req, res) => {
  const { id } = req.params;
  try {
    const [usuarios] = await Promise.all([
      query('SELECT id, nombre, apellido, email, telefono FROM usuarios WHERE id = ?', [id]),
    ]);
    if (!usuarios.length) return res.status(404).json({ error: 'Usuario no encontrado' });

    const comunidades = await query(
      `SELECT c.id, c.nombre
       FROM comunidades c
       JOIN usuario_comunidad uc ON uc.comunidad_id = c.id
       WHERE uc.usuario_id = ?`,
      [id]
    );

    const eventos = await query(
      `SELECT e.id, e.nombre
       FROM eventos e
       JOIN usuario_evento ue ON ue.evento_id = e.id
       WHERE ue.usuario_id = ?`,
      [id]
    );

    res.json({ ...usuarios[0], comunidades, eventos });
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
  if (nombre !== undefined) { campos.push('nombre = ?'); valores.push(nombre); }
  if (apellido !== undefined) { campos.push('apellido = ?'); valores.push(apellido); }
  if (email !== undefined) { campos.push('email = ?'); valores.push(email); }
  if (telefono !== undefined) { campos.push('telefono = ?'); valores.push(telefono); }
  if (!campos.length) return res.status(400).json({ error: 'No hay campos para actualizar' });
  valores.push(id);
  try {
    await query(`UPDATE usuarios SET ${campos.join(', ')} WHERE id = ?`, valores);
    log(req.user.email, 'EDITAR_USUARIO', 'comunidades', `usuario_id=${id}`);
    res.json({ ok: true });
  } catch (err) {
    console.error('[Comunidades] patch usuario:', err.message);
    res.status(503).json({ error: 'No se puede conectar a Comunidades en este momento' });
  }
});

// DELETE /api/comunidades/usuarios/:id/comunidad/:comunidadId
router.delete('/usuarios/:id/comunidad/:comunidadId', requireAuth, async (req, res) => {
  const { id, comunidadId } = req.params;
  try {
    await query(
      'DELETE FROM usuario_comunidad WHERE usuario_id = ? AND comunidad_id = ?',
      [id, comunidadId]
    );
    log(req.user.email, 'ELIMINAR_COMUNIDAD', 'comunidades', `usuario_id=${id} | comunidad_id=${comunidadId}`);
    res.json({ ok: true });
  } catch (err) {
    console.error('[Comunidades] delete comunidad:', err.message);
    res.status(503).json({ error: 'No se puede conectar a Comunidades en este momento' });
  }
});

// DELETE /api/comunidades/usuarios/:id/evento/:eventoId
router.delete('/usuarios/:id/evento/:eventoId', requireAuth, async (req, res) => {
  const { id, eventoId } = req.params;
  try {
    await query(
      'DELETE FROM usuario_evento WHERE usuario_id = ? AND evento_id = ?',
      [id, eventoId]
    );
    log(req.user.email, 'ELIMINAR_EVENTO', 'comunidades', `usuario_id=${id} | evento_id=${eventoId}`);
    res.json({ ok: true });
  } catch (err) {
    console.error('[Comunidades] delete evento:', err.message);
    res.status(503).json({ error: 'No se puede conectar a Comunidades en este momento' });
  }
});

module.exports = router;
