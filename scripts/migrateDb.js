const mongoose = require('mongoose');
const connectDB = require('../config/db');

// Esegui la connessione al database
connectDB();

// Schema del dispositivo basato sui dati esistenti
const deviceSchema = new mongoose.Schema({
  deviceId: { type: String, required: true, unique: true },
  timestamp: { type: Date, default: Date.now },
  readings: {
    uv: Number,
    lux: Number,
    temperature: Number,
    humidity: Number,
    pressure: Number,
    gas: Number,
    soilMoisture: Number,
    rain: Number
  },
  // Aggiungiamo il campo user che sarà inizialmente null per tutte le centraline esistenti
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null }
}, { timestamps: true });

// Creazione schema utente
const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  subscription: { type: String, default: 'Basic', enum: ['Basic', 'Premium', 'Enterprise'] },
  devices: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Device' }]
}, { timestamps: true });

// Definizione modelli
const OldDevice = mongoose.model('OldDevice', new mongoose.Schema({}, { strict: false }), 'devices');
const Device = mongoose.model('Device', deviceSchema, 'devices');
const User = mongoose.model('User', userSchema, 'users');

async function migrateDatabase() {
  try {
    console.log('Iniziando la migrazione del database...');
    
    // 1. Recupera tutte le centraline esistenti
    const existingDevices = await OldDevice.find({});
    console.log(`Trovate ${existingDevices.length} centraline esistenti`);
    
    // 2. Aggiorna ogni centralina aggiungendo il campo user (inizialmente null)
    for (const device of existingDevices) {
      await Device.updateOne(
        { _id: device._id },
        { $set: { user: null } },
        { upsert: false }
      );
      console.log(`Aggiornata centralina ${device.deviceId || device._id}`);
    }
    
    console.log('Migrazione completata con successo!');
    console.log('La struttura del database è stata aggiornata.');
    console.log('Gli utenti possono ora essere associati alle centraline esistenti.');
    
  } catch (error) {
    console.error('Errore durante la migrazione:', error);
  } finally {
    // Chiudi la connessione al database
    await mongoose.connection.close();
    console.log('Connessione al database chiusa');
    process.exit(0);
  }
}

// Esegui la migrazione
migrateDatabase();
