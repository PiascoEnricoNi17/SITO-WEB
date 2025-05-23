const mongoose = require('mongoose');
const connectDB = require('../config/db');
const { User, Device } = require('../models/models');

// Parametri da modificare
const USERNAME = 'mario_rossi'; // Nome utente dell'account a cui assegnare la centralina
const DEVICE_ID = 'lora001';    // ID della centralina da assegnare

// Funzione per collegare la centralina all'utente
async function linkDeviceToUser() {
  try {
    // Connessione al database
    await connectDB();
    console.log('Connesso al database MongoDB');
    
    // Trova l'utente
    const user = await User.findOne({ username: USERNAME });
    if (!user) {
      console.error(`Utente '${USERNAME}' non trovato`);
      process.exit(1);
    }
    
    // Trova la centralina
    const device = await Device.findOne({ deviceId: DEVICE_ID });
    if (!device) {
      console.error(`Centralina '${DEVICE_ID}' non trovata`);
      process.exit(1);
    }
    
    // Verifica se l'utente può aggiungere altre centraline
    const maxDevices = user.subscription === 'Basic' ? 1 : 
                      user.subscription === 'Premium' ? 3 : 10;
                      
    if (user.devices.length >= maxDevices) {
      console.error(`L'utente ha già raggiunto il limite di centraline (${maxDevices}) per il piano ${user.subscription}`);
      process.exit(1);
    }
    
    // Verifica se la centralina è già assegnata
    if (device.user) {
      console.error(`La centralina '${DEVICE_ID}' è già assegnata a un altro utente`);
      process.exit(1);
    }
    
    // Collega la centralina all'utente
    device.user = user._id;
    await device.save();
    
    // Aggiungi la centralina all'utente
    user.devices.push(device._id);
    await user.save();
    
    console.log(`Centralina '${DEVICE_ID}' collegata con successo all'utente '${USERNAME}'`);
    
  } catch (error) {
    console.error('Errore durante il collegamento:', error);
  } finally {
    // Chiudi la connessione al database
    await mongoose.connection.close();
    console.log('Connessione al database chiusa');
    process.exit(0);
  }
}

// Avvia il processo
linkDeviceToUser();
