const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    // Utilizziamo esplicitamente l'indirizzo IP 127.0.0.1 (IPv4) invece di localhost
    const conn = await mongoose.connect('mongodb://127.0.0.1:27017/loraAirDB');
    
    console.log(`MongoDB Connected: ${conn.connection.host}`);
    return true;
  } catch (error) {
    console.error(`MongoDB Error: ${error.message}`);
    // Interrompiamo l'applicazione se MongoDB non è disponibile
    console.error('Impossibile connettersi a MongoDB. Assicurati che il servizio sia in esecuzione.');
    process.exit(1);
  }
};

module.exports = connectDB;
