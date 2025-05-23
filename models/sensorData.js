const mongoose = require('mongoose');

// Schema per i dati delle letture dei sensori
const sensorDataSchema = new mongoose.Schema({
    stationId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Station',
        required: true
    },
    timestamp: { 
        type: Date, 
        default: Date.now 
    },
    temperature: { type: Number },
    humidity: { type: Number },
    airQuality: { type: Number },
    uv: { type: Number },
    lux: { type: Number },
    pressure: { type: Number },
    soilMoisture: { type: Number },
    rain: { type: Number }
}, { timestamps: true });

// Indice per ottimizzare le ricerche
sensorDataSchema.index({ stationId: 1, timestamp: -1 });

const SensorData = mongoose.model('SensorData', sensorDataSchema);

module.exports = SensorData;
