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
    rain: { type: Number }
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
    switch(this.subscription) {
        case 'standard':
            return 1;
        case 'premium':
            return 3;
        case 'professional':
            return 10;
        default:
            return 0;
    }
};

const User = mongoose.model('User', userSchema);
const Device = mongoose.model('Device', deviceSchema);

module.exports = { User, Device };
