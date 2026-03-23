const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const { Usuario, Espacio, Evento } = require('../db/mongo');
const { requireAuth } = require('../auth');

const LOG_PATH = path.join(__dirname, '..', 'logs', 'acciones.log');

function log(userEmail, accion, plataforma, extras) {
  const linea = `[${new Date().toISOString()}] ${userEmail} | ${accion} | ${plataforma} | ${extras}\n`;
  fs.appendFile(LOG_PATH, linea, () => {});
}

// GET /api/nexo/buscar?q=texto
router.get('/buscar', requireAuth, async (req, res) => {
  const { q } = req.query;
  if (!q) return res.status(400).json({ error: 'Parámetro q requerido' });
  try {
    const regex = new RegExp(q, 'i');
    const usuarios = await Usuario.find(
      { $or: [{ nombre: regex }, { email: regex }] },
      { nombre: 1, email: 1 }
    ).limit(10).lean();
    res.json(usuarios.map((u) => ({ id: u._id, nombre: u.nombre, email: u.email })));
  } catch (err) {
    console.error('[Nexo] buscar:', err.message);
    res.status(503).json({ error: 'No se puede conectar a Nexo en este momento' });
  }
});

// GET /api/nexo/usuarios/:id
router.get('/usuarios/:id', requireAuth, async (req, res) => {
  const { id } = req.params;
  if (!mongoose.Types.ObjectId.isValid(id)) return res.status(400).json({ error: 'ID inválido' });
  try {
    const usuario = await Usuario.findById(id).lean();
    if (!usuario) return res.status(404).json({ error: 'Usuario no encontrado' });

    const espacios = await Espacio.find(
      { miembros: usuario._id },
      { nombre: 1 }
    ).lean();

    const eventos = await Evento.find(
      { inscritos: usuario._id },
      { nombre: 1 }
    ).lean();

    res.json({
      id: usuario._id,
      nombre: usuario.nombre,
      email: usuario.email,
      espacios: espacios.map((e) => ({ id: e._id, nombre: e.nombre })),
      eventos: eventos.map((e) => ({ id: e._id, nombre: e.nombre })),
    });
  } catch (err) {
    console.error('[Nexo] usuario/:id:', err.message);
    res.status(503).json({ error: 'No se puede conectar a Nexo en este momento' });
  }
});

// DELETE /api/nexo/usuarios/:id/espacio/:espacioId
router.delete('/usuarios/:id/espacio/:espacioId', requireAuth, async (req, res) => {
  const { id, espacioId } = req.params;
  try {
    await Espacio.findByIdAndUpdate(espacioId, { $pull: { miembros: new mongoose.Types.ObjectId(id) } });
    log(req.user.email, 'ELIMINAR_ESPACIO', 'nexo', `usuario_id=${id} | espacio_id=${espacioId}`);
    res.json({ ok: true });
  } catch (err) {
    console.error('[Nexo] delete espacio:', err.message);
    res.status(503).json({ error: 'No se puede conectar a Nexo en este momento' });
  }
});

// DELETE /api/nexo/usuarios/:id/evento/:eventoId
router.delete('/usuarios/:id/evento/:eventoId', requireAuth, async (req, res) => {
  const { id, eventoId } = req.params;
  try {
    await Evento.findByIdAndUpdate(eventoId, { $pull: { inscritos: new mongoose.Types.ObjectId(id) } });
    log(req.user.email, 'ELIMINAR_EVENTO', 'nexo', `usuario_id=${id} | evento_id=${eventoId}`);
    res.json({ ok: true });
  } catch (err) {
    console.error('[Nexo] delete evento:', err.message);
    res.status(503).json({ error: 'No se puede conectar a Nexo en este momento' });
  }
});

module.exports = router;
