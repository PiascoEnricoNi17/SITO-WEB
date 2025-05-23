// Importa solo i modelli necessari
const { User, Device } = require('./models/models');
const { getUserDeviceCount } = require('./utils/accountHelper');

// Controller temporaneo per gestire le funzionalità precedentemente fornite da stationController
const deviceController = {
    // Mostra tutti i dispositivi dell'utente (ex dashboard)
    getDashboard: async (req, res) => {
        try {
            const user = req.user;
            
            // Ottieni tutti i dispositivi dell'utente
            const devices = await Device.find({ user: user._id });
            
            res.render('dashboard', {
                user,
                stations: devices.map(device => ({
                    _id: device._id,
                    name: device.deviceId,
                    location: device.position || 'Non specificata',
                    deviceId: device.deviceId,
                    lastReading: device.readings && device.readings.length > 0 ? 
                        device.readings[device.readings.length - 1] : null,
                    lastActive: device.updatedAt
                })),
                lastLogin: user.lastLogin || new Date()
            });
        } catch (error) {
            console.error('Errore nella pagina dashboard:', error);
            res.status(500).send('Errore del server');
        }
    },
    
    // Mostra i dettagli di un dispositivo specifico (ex dettagli stazione)
    getStationDetails: async (req, res) => {
        try {
            const deviceId = req.params.id;
            const user = req.user;
            
            // Ottieni il dispositivo richiesto
            const device = await Device.findOne({ _id: deviceId, user: user._id });
            
            if (!device) {
                return res.status(404).send('Dispositivo non trovato');
            }
            
            // Prendi l'ultima lettura dal dispositivo
            const lastReading = device.readings && device.readings.length > 0 ? 
                device.readings[device.readings.length - 1] : null;
            
            res.render('station-details', {
                user,
                station: {
                    _id: device._id,
                    name: device.deviceId,
                    location: device.position || 'Non specificata',
                    deviceId: device.deviceId
                },
                sensorData: lastReading,
                position: device.position || 'Non specificata'
            });
        } catch (error) {
            console.error('Errore nei dettagli stazione:', error);
            res.status(500).send('Errore del server');
        }
    },
    
    // Form per aggiungere nuovo dispositivo
    getNewStationForm: async (req, res) => {
        res.render('new-station', { user: req.user });
    },
    
    // Crea nuovo dispositivo
    createNewStation: async (req, res) => {
        try {
            const { name, location, deviceId } = req.body;
            const user = req.user;
            
            // Crea un nuovo dispositivo
            const newDevice = new Device({
                deviceId: deviceId || name.toLowerCase().replace(/\s+/g, '-'),
                position: location || 'Non specificata',
                user: user._id,
                readings: []
            });
            
            await newDevice.save();
            
            // Aggiorna l'utente con il nuovo dispositivo
            await User.findByIdAndUpdate(user._id, {
                $push: { devices: newDevice._id }
            });
            
            res.redirect('/dashboard');
        } catch (error) {
            console.error('Errore nella creazione dispositivo:', error);
            res.status(500).send('Errore del server');
        }
    }
};

module.exports = function(app) {
    // Rotte per la dashboard e le centraline (ora dispositivi)
    app.get('/dashboard', requireAuth, deviceController.getDashboard);
    
    // Visualizzazione dettagli dispositivo/centralina
    app.get('/station/:id', requireAuth, deviceController.getStationDetails);
    
    // Pagina dell'account utente con conteggio dinamico dei dispositivi
    app.get('/account', requireAuth, async (req, res) => {
        try {
            // Ottieni l'utente corrente
            const userId = req.user._id;
            
            // Verifica che l'ID utente sia valido
            console.log('ID utente:', userId);
            
            // Recupera direttamente dalla collezione MongoDB il conteggio dei dispositivi
            const deviceCount = await getUserDeviceCount(userId);
            console.log(`Dispositivi associati all'utente: ${deviceCount}`);
            
            // Prepariamo i dati dell'utente con il conteggio corretto dai dispositivi MongoDB
            const userData = {
                ...req.user._doc || req.user,
                devicesCount: deviceCount,
                stationsCount: deviceCount,
                subscription: req.user.subscription || 'Base'
            };
            
            // Log per debug
            console.log('Dati utente per la pagina account:', {
                id: userId,
                username: userData.username || userData.name,
                deviceCount: deviceCount
            });
            
            // Rendering della pagina con i dati aggiornati dalla query al DB
            res.render('account', {
                user: userData,
                stationsCount: deviceCount,  // Aggiungi anche come variabile separata
                deviceCount: deviceCount,    // Aggiungi in più formati per sicurezza
                pageTitle: 'Il tuo Account'
            });
        } catch (error) {
            console.error('Errore nella pagina account:', error);
            res.status(500).send('Errore del server');
        }
    });
    
    // Form per aggiungere un nuovo dispositivo
    app.get('/stations/new', requireAuth, deviceController.getNewStationForm);
    
    // Salvataggio nuovo dispositivo
    app.post('/stations/new', requireAuth, deviceController.createNewStation);
    
    // API per ottenere dati sensore di un dispositivo specifico
    app.get('/api/sensor-data', requireAuth, async (req, res) => {
        try {
            const { stationId } = req.query;  // Manteniamo stationId per retrocompatibilità
            
            // Funzione per generare dati di sensore di default quando non ci sono dati reali
            function generateSensorData() {
                return {
                    timestamp: new Date(),
                    temperature: { current: 21.7, min: 21.0, max: 23.0, unit: '°C' },
                    humidity: { current: 67.0, min: 63.0, max: 67.0, unit: '%' },
                    airQuality: { current: 440.0, unit: 'ppm' },
                    pressure: 1013.8,
                    uv: 4.8,
                    lux: 1100,
                    rain: 0,
                    soilMoisture: 75.2
                };
            }
            
            // Se viene richiesto un dispositivo specifico
            if (stationId) {
                // Verifica che il dispositivo appartenga all'utente
                const device = await Device.findOne({ _id: stationId, user: req.user._id });
                
                if (!device) {
                    return res.status(404).json({ error: 'Dispositivo non trovato' });
                }
                
                // Ottieni l'ultima lettura del dispositivo
                const lastReading = device.readings && device.readings.length > 0 ? 
                    device.readings[device.readings.length - 1] : null;
                
                // Prepara i dati da restituire
                let responseData = {};
                
                if (lastReading) {
                    // Formatta i dati per la compatibilità con l'interfaccia esistente
                    responseData = {
                        timestamp: lastReading.timestamp,
                        temperature: { 
                            current: lastReading.temperature, 
                            min: lastReading.temperature - 1, 
                            max: lastReading.temperature + 1, 
                            unit: '°C' 
                        },
                        humidity: { 
                            current: lastReading.humidity, 
                            min: Math.max(0, lastReading.humidity - 5), 
                            max: Math.min(100, lastReading.humidity + 5), 
                            unit: '%' 
                        },
                        airQuality: { current: lastReading.gas, unit: 'ppm' },
                        pressure: lastReading.pressure,
                        uv: lastReading.uv,
                        lux: lastReading.lux,
                        rain: lastReading.rain,
                        soilMoisture: lastReading.soilMoisture
                    };
                } else {
                    // Altrimenti generiamo dati fittizi
                    responseData = generateSensorData();
                }
                
                // Aggiungi la posizione del dispositivo
                responseData.position = device.position || 'Non specificata';
                
                return res.json(responseData);
            } 
            // Altrimenti restituisci i dati del sensore predefinito
            else {
                // Comportamento esistente per compatibilità
                return res.json(generateSensorData());
            }
        } catch (error) {
            console.error('Errore nel recupero dati sensore:', error);
            res.status(500).json({ error: 'Errore del server' });
        }
    });
};

// Questa è una funzione helper per la verifica dell'autenticazione
function requireAuth(req, res, next) {
    if (!req.session.isLoggedIn) {
        return res.redirect('/login');
    }
    next();
}
