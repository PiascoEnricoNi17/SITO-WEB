const Station = require('../models/station');
const SensorData = require('../models/sensorData');
const User = require('../models/user');

// Controller per la dashboard con elenco centraline
exports.getDashboard = async (req, res) => {
    try {
        const user = req.user;
        
        // Ottieni tutte le centraline dell'utente
        const stations = await Station.find({ userId: user._id });
        
        // Per ogni centralina, ottieni l'ultima lettura
        for (let station of stations) {
            const lastReading = await SensorData.findOne({ stationId: station._id })
                .sort({ timestamp: -1 })
                .limit(1);
            
            station.lastReading = lastReading;
        }
        
        res.render('dashboard', {
            user,
            stations,
            lastLogin: user.lastLogin || new Date()
        });
    } catch (error) {
        console.error('Errore nella pagina dashboard:', error);
        res.status(500).send('Errore del server');
    }
};

// Controller per la pagina di dettaglio della centralina
exports.getStationDetails = async (req, res) => {
    try {
        const user = req.user;
        const stationId = req.params.id;
        
        console.log('getStationDetails - ID dalla URL:', stationId);
        console.log('getStationDetails - ID utente:', user._id);
        
        // Verifica che la stazione appartenga all'utente
        const station = await Station.findOne({ _id: stationId, userId: user._id });
        
        // Log per debug
        if (station) {
            console.log('getStationDetails - Stazione trovata:', {
                id: station._id,
                idString: station._id.toString(),
                name: station.name,
                deviceId: station.deviceId
            });
            
            // Assicuriamoci che l'ID sia rappresentato come stringa
            station._id = station._id.toString();
        } else {
            console.log('getStationDetails - Nessuna stazione trovata con ID:', stationId);
        }
        
        if (!station) {
            return res.status(404).send('Centralina non trovata');
        }
        
        // Otteniamo il device relativo a questa stazione
        const Device = require('../models/models').Device;
        const device = await Device.findOne({ deviceId: station.deviceId });
        
        // Variabili per i dati e le letture storiche
        let sensorData = null;
        let historicalReadings = [];
        
        if (device && device.readings && device.readings.length > 0) {
            // Otteniamo l'ultima lettura per i dati correnti
            const latestReading = device.readings[device.readings.length - 1];
            
            // Recupera la posizione dal dispositivo o imposta un valore predefinito
            let devicePosition = device.position || 'Milano, Italia';
            console.log(`Posizione rilevata per ${device.deviceId}: ${devicePosition}`);
            
            // Se la posizione non esiste nel dispositivo, aggiorniamola nel database
            if (!device.position) {
                try {
                    // Aggiorniamo il documento con un valore di posizione di default
                    await require('../models/models').Device.updateOne(
                        { _id: device._id },
                        { $set: { position: devicePosition } }
                    );
                    console.log(`Dispositivo ${device.deviceId} aggiornato con posizione: ${devicePosition}`);
                } catch (updateError) {
                    console.error('Errore nell\'aggiornamento della posizione:', updateError);
                }
            }
            
            // Formattiamo i dati del sensore nell'oggetto sensorData
            sensorData = {
                timestamp: new Date(latestReading.timestamp),
                position: devicePosition, // Aggiungiamo la posizione all'oggetto sensorData
                temperature: {
                    current: latestReading.temperature,
                    unit: '°C',
                    min: Math.min(...device.readings.map(r => r.temperature)) || latestReading.temperature,
                    max: Math.max(...device.readings.map(r => r.temperature)) || latestReading.temperature
                },
                humidity: {
                    current: latestReading.humidity,
                    unit: '%',
                    min: Math.min(...device.readings.map(r => r.humidity)) || latestReading.humidity,
                    max: Math.max(...device.readings.map(r => r.humidity)) || latestReading.humidity
                },
                airQuality: {
                    current: latestReading.gas,
                    unit: 'ppm'
                },
                pressure: latestReading.pressure,
                uv: latestReading.uv,
                lux: latestReading.lux,
                soilMoisture: latestReading.soilMoisture,
                rain: latestReading.rain
            };
            
            // Prepariamo le letture storiche
            historicalReadings = device.readings
                .map(reading => ({
                    timestamp: new Date(reading.timestamp),
                    temperature: reading.temperature,
                    humidity: reading.humidity,
                    gas: reading.gas,
                    pressure: reading.pressure,
                    uv: reading.uv,
                    lux: reading.lux,
                    soilMoisture: reading.soilMoisture,
                    rain: reading.rain
                }))
                .sort((a, b) => b.timestamp - a.timestamp);
            
            console.log(`Trovate ${historicalReadings.length} letture storiche per il dispositivo ${device.deviceId}`);
        } else {
            console.log(`Nessuna lettura trovata per il dispositivo associato alla stazione ${stationId}`);
            // Dati di fallback (simulati)
            sensorData = {
                temperature: {
                    current: 22.5,
                    unit: '°C',
                    min: 21,
                    max: 24
                },
                humidity: {
                    current: 65,
                    unit: '%',
                    min: 60,
                    max: 70
                },
                airQuality: {
                    current: 450,
                    unit: 'ppm'
                },
                pressure: 1013.25,
                uv: 5.2,
                lux: 1200,
                soilMoisture: 75.8,
                rain: 0,
                timestamp: new Date()
            };
        }
        
        // Assicuriamoci che l'ID della stazione sia una stringa
        let stationIdString = station && station._id ? station._id.toString() : '';
        console.log('stationController - ID stazione (convertito a stringa):', stationIdString);
        
        // Prepara l'oggetto station con _id come stringa
        const stationWithStringId = {
            ...station.toObject(),
            _id: stationIdString
        };
        
        console.log('stationController - stationWithStringId:', {
            _id: stationWithStringId._id,
            name: stationWithStringId.name
        });
        
        console.log('Dati finali passati al template:', {
            name: stationWithStringId.name,
            sensorData: sensorData,
            sensorDataKeys: sensorData ? Object.keys(sensorData) : 'nessun dato'
        });
        
        // Renderizza la pagina con il template originale
        res.render('station-details', {
            station: stationWithStringId,
            device: device,
            user: req.user,
            sensorData: sensorData,
            historicalData: historicalReadings,
            stationId: stationWithStringId._id.toString() // Passa esplicitamente l'ID come stringa
        });
    } catch (error) {
        console.error('Errore nella pagina station-details:', error);
        res.status(500).send('Errore del server');
    }
};

// Controller per la pagina di creazione nuova centralina
exports.getNewStationForm = (req, res) => {
    res.render('new-station', {
        user: req.user
    });
};

// Controller per creare una nuova centralina
exports.createNewStation = async (req, res) => {
    try {
        const { name, location, description } = req.body;
        const userId = req.user._id;
        
        const newStation = new Station({
            name,
            location,
            description,
            userId
        });
        
        await newStation.save();
        
        res.redirect('/dashboard');
    } catch (error) {
        console.error('Errore nella creazione della centralina:', error);
        res.status(500).send('Errore del server');
    }
};

// Controller per aggiornare i dati di una centralina
exports.updateStation = async (req, res) => {
    try {
        const stationId = req.params.id;
        const { name, location, description, status } = req.body;
        
        // Verifica che la stazione appartenga all'utente
        const station = await Station.findOne({ _id: stationId, userId: req.user._id });
        
        if (!station) {
            return res.status(404).send('Centralina non trovata');
        }
        
        // Aggiorna i dati
        station.name = name;
        station.location = location;
        station.description = description;
        if (status) station.status = status;
        
        await station.save();
        
        res.redirect(`/station/${stationId}`);
    } catch (error) {
        console.error('Errore nell\'aggiornamento della centralina:', error);
        res.status(500).send('Errore del server');
    }
};

// Controller per eliminare una centralina
exports.deleteStation = async (req, res) => {
    try {
        const stationId = req.params.id;
        
        // Verifica che la stazione appartenga all'utente
        const station = await Station.findOne({ _id: stationId, userId: req.user._id });
        
        if (!station) {
            return res.status(404).send('Centralina non trovata');
        }
        
        // Elimina la stazione
        await Station.deleteOne({ _id: stationId });
        
        // Opzionale: elimina anche tutti i dati associati
        await SensorData.deleteMany({ stationId });
        
        res.redirect('/dashboard');
    } catch (error) {
        console.error('Errore nell\'eliminazione della centralina:', error);
        res.status(500).send('Errore del server');
    }
};
