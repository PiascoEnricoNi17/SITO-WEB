const mongoose = require('mongoose');

// Schema per i dati delle letture dei sensori
const readingsSchema = new mongoose.Schema({
    timestamp: { type: Date, default: Date.now },
    uv: { type: Number },
    lux: { type: Number },
    temperature: { type: Number },
    humidity: { type: Number },
    pressure: { type: Number },
    gas: { type: Number },
    soilMoisture: { type: Number },
    rain: { type: Number },
    wind: { type: Number } // Ho aggiunto la velocità del vento in Km/h
});

// Schema per i dispositivi (centraline)
const deviceSchema = new mongoose.Schema({
    deviceId: { type: String, required: true, unique: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    position: { type: String, default: 'Non specificata' }, // Aggiungiamo il campo position
    readings: [readingsSchema] // Array di letture invece di un singolo oggetto
}, { timestamps: true });

// Schema per gli utenti
const userSchema = new mongoose.Schema({
    username: { type: String, required: true, unique: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    subscription: { type: String, default: 'standard', enum: ['standard', 'premium', 'professional'] },
    devices: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Device' }]
}, { timestamps: true });

// Funzione per ottenere il numero massimo di centraline in base al piano
userSchema.methods.getMaxDevices = function() {
    // Normalizziamo il piano in minuscolo per evitare problemi di case sensitivity
    const plan = this.subscription ? this.subscription.toLowerCase() : '';
    
    console.log(`Piano abbonamento (normalizzato): '${plan}', originale: '${this.subscription}'`);
    
    switch(plan) {
        case 'base':
        case 'basic': // Per compatibilità con possibili varianti
            return 3;
        case 'standard':
            return 6;
        case 'premium':
            return 10;
        default:
            console.log(`ATTENZIONE: Piano non riconosciuto '${this.subscription}', impostato limite predefinito di 3 dispositivi`);
            return 3; // Impostiamo 3 come predefinito anche per piani non riconosciuti
    }
};

const User = mongoose.model('User', userSchema);
const Device = mongoose.model('Device', deviceSchema);

module.exports = { User, Device };
