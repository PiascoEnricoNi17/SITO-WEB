const mongoose = require('mongoose');
require('dotenv').config();

const connectDB = async () => {
  try {
    // Utilizziamo le variabili d'ambiente per la connessione a MongoDB
    // Se non sono presenti, usiamo la connessione locale di default
    const mongoURI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/loraAirDB'; // QUI VA MESSO: const mongoURI = 'mongodb+srv://doadmin:6BsQ94q83wo02r1A@dbaas-db-8396718-38526fb0.mongo.ondigitalocean.com/loraAirDB?tls=true&authSource=admin';
    
    const conn = await mongoose.connect(mongoURI, {
      // Parametri opzionali di configurazione se necessari
    });
    
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
