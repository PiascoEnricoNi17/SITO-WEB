const mongoose = require('mongoose');

const SensorReadingSchema = new mongoose.Schema({
  timestamp: {
    type: Date,
    default: Date.now
  },
  deviceId: {
    type: String,
    required: true
  },
  readings: {
    uv: {
      type: Number,
      required: true
    },
    lux: {
      type: Number,
      required: true
    },
    temperature: {
      type: Number,
      required: true
    },
    humidity: {
      type: Number,
      required: true
    },
    pressure: {
      type: Number,
      required: true
    },
    gas: {
      type: Number,
      required: true
    },
    soilMoisture: {
      type: Number,
      required: true
    },
    rain: {
      type: Number,
      required: true
    }
  },
  location: {
    lat: {
      type: Number,
      required: false
    },
    lng: {
      type: Number,
      required: false
    }
  },
  batteryLevel: {
    type: Number,
    required: false
  }
}, {
  timestamps: true // Aggiunge createdAt e updatedAt automaticamente
});

// Crea indici per migliorare le performance delle query
SensorReadingSchema.index({ timestamp: 1 });
SensorReadingSchema.index({ deviceId: 1 });
SensorReadingSchema.index({ 'readings.temperature': 1 });
SensorReadingSchema.index({ 'readings.humidity': 1 });

module.exports = mongoose.model('SensorReading', SensorReadingSchema);
