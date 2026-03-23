require('dotenv').config();
const mongoose = require('mongoose');

async function connect() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('[MongoDB] Conexión exitosa a Nexo');
  } catch (err) {
    console.error('[MongoDB] Error al conectar a Nexo:', err.message);
  }
}

const opts = { strict: false };

const Usuario = mongoose.model('Usuario', new mongoose.Schema({}, opts), 'usuarios');
const Espacio = mongoose.model('Espacio', new mongoose.Schema({}, opts), 'espacios');
const Evento = mongoose.model('Evento', new mongoose.Schema({}, opts), 'eventos');

module.exports = { connect, Usuario, Espacio, Evento };
