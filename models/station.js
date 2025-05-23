const mongoose = require('mongoose');

const stationSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true
    },
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    location: {
        type: String,
        default: 'Non specificata'
    },
    description: {
        type: String,
        default: ''
    },
    createdAt: {
        type: Date,
        default: Date.now
    },
    lastActive: {
        type: Date,
        default: Date.now
    },
    status: {
        type: String,
        enum: ['active', 'inactive', 'maintenance'],
        default: 'active'
    },
    apiKey: {
        type: String,
        unique: true
    },
    deviceId: {
        type: String,
        required: false,
        default: null
    }
}, { timestamps: true });

// Genera una API key unica se non esiste
stationSchema.pre('save', function(next) {
    if (!this.apiKey) {
        this.apiKey = generateUniqueApiKey();
    }
    next();
});

// Funzione per generare una chiave API casuale
function generateUniqueApiKey() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    const length = 32;
    for (let i = 0; i < length; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
}

const Station = mongoose.model('Station', stationSchema);

module.exports = Station;
