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
    // Uso ESATTAMENTE lo stesso approccio della dashboard
    getStationDetails: async (req, res) => {
        try {
            console.log('===================================================');
            console.log('!!!!!!! CONTROLLER ROUTES.JS CHIAMATO !!!!!!!!!!');
            console.log('===================================================');
            
            const deviceId = req.params.id;
            const user = req.user;
            
            console.log('ID dispositivo richiesto:', deviceId);
            console.log('ID utente:', user._id);
            
            // Prima cerca per _id se è un ObjectId valido
            let device;
            const mongoose = require('mongoose');
            
            if (mongoose.Types.ObjectId.isValid(deviceId)) {
                device = await Device.findById(deviceId).lean();
                console.log('Trovato dispositivo per ObjectId:', deviceId);
            }
            
            // Se non trovato, cerca per deviceId
            if (!device) {
                device = await Device.findOne({ deviceId: deviceId }).lean();
                console.log('Trovato dispositivo per deviceId:', deviceId);
            }
            
            if (!device) {
                console.log('!!!! ERRORE - Dispositivo non trovato !!!!');
                return res.status(404).send('Dispositivo non trovato');
            }
            
            // Log dispositivo trovato
            console.log('DISPOSITIVO TROVATO NEL DATABASE:');
            console.log(JSON.stringify({
                _id: device._id,
                deviceId: device.deviceId,
                position: device.position,
                allFields: Object.keys(device)
            }, null, 2));
            
            // Estrai l'ultima lettura
            const lastReading = device.readings && device.readings.length > 0 ? 
                device.readings[device.readings.length - 1] : null;
            
            // Prepara i dati ESATTAMENTE come nella dashboard
            // Crea un oggetto station uguale alla dashboard
            const station = {
                _id: device._id,
                id: device._id,
                name: device.deviceId,
                deviceId: device.deviceId,
                location: device.position || 'Non specificata',  // UGUALE alla dashboard
                position: device.position || 'Non specificata',  // Aggiungiamo anche position
                lastActive: device.updatedAt
            };
            
            console.log('!!!! POSIZIONE INVIATA AL TEMPLATE !!!!');
            console.log('location:', station.location);
            console.log('position:', station.position);
            console.log('===================================================');
            
            // Rendering del template
            res.render('station-details', {
                user,
                station: station,  // Usa l'oggetto station preparato come dashboard
                sensorData: lastReading || {}
            });
        } catch (error) {
            console.error('Errore nei dettagli stazione:', error);
            console.error(error.stack);
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
            // Estrai i dati dalla richiesta
            const { deviceId, position } = req.body;
            const user = req.user;
            
            console.log('Dati ricevuti dal form:', { deviceId, position });
            console.log('Utente corrente:', user ? { id: user._id, username: user.username || user.email } : 'Nessun utente');
            
            // Verifica che l'utente sia autenticato
            if (!user || !user._id) {
                console.error('Utente non autenticato o ID mancante');
                return res.status(401).send('Utente non autenticato');
            }
            
            // Verifica che l'ID del dispositivo sia stato specificato
            if (!deviceId) {
                console.error('ID dispositivo mancante');
                return res.status(400).send('ID dispositivo obbligatorio');
            }
            
            // Crea un nuovo dispositivo con la struttura minima necessaria
            const deviceData = {
                deviceId: deviceId,
                position: position || 'Non specificata',
                user: user._id,
                readings: []  // Array vuoto per le letture future
            };
            
            console.log('Dati dispositivo da inserire:', deviceData);
            
            // Crea una nuova istanza del dispositivo
            const newDevice = new Device(deviceData);
            
            // Salva il dispositivo nella collection 'devices'
            const savedDevice = await newDevice.save();
            console.log('Dispositivo salvato:', savedDevice._id);
            
            // Aggiorna l'utente con il nuovo dispositivo
            await User.findByIdAndUpdate(user._id, {
                $push: { devices: savedDevice._id }
            });
            
            console.log(`Dispositivo ${deviceId} creato con successo e associato all'utente ${user.username || user.email}`);
            
            return res.redirect('/dashboard');
        } catch (error) {
            console.error('Errore dettagliato nella creazione dispositivo:', error);
            
            // Gestione errori specifici
            if (error.code === 11000) {
                // Errore di duplicazione (probabilmente deviceId duplicato)
                return res.status(400).send('ID dispositivo già in uso. Scegli un nome diverso.');
            }
            
            if (error.name === 'ValidationError') {
                // Errore di validazione del modello
                const messages = Object.values(error.errors).map(val => val.message);
                return res.status(400).send(`Errore di validazione: ${messages.join(', ')}`);
            }
            
            // Per altri errori, mostra un messaggio generico
            return res.status(500).send('Errore interno del server. Riprova più tardi.');
        }
    }
};

module.exports = function(app) {
    // Rotte per la dashboard e le centraline (ora dispositivi)
    app.get('/dashboard', requireAuth, deviceController.getDashboard);
    
    // Endpoint di debug per visualizzare i dati raw di un dispositivo
    app.get('/debug/device/:id', requireAuth, async (req, res) => {
        try {
            const deviceId = req.params.id;
            console.log('DEBUG - ID dispositivo:', deviceId);
            
            // Trova il dispositivo direttamente con MongoDB
            const mongoose = require('mongoose');
            let device;
            
            // Cerca per _id se valido
            if (mongoose.Types.ObjectId.isValid(deviceId)) {
                device = await Device.findById(deviceId).lean();
            }
            
            // Se non trovato, cerca per deviceId
            if (!device) {
                device = await Device.findOne({ deviceId: deviceId }).lean();
            }
            
            if (!device) {
                return res.json({ error: 'Dispositivo non trovato' });
            }
            
            // Mostra tutti i dati raw
            return res.json({
                deviceRaw: device,
                _id: device._id,
                deviceId: device.deviceId,
                position: device.position,
                location: device.location, // Questo probabilmente non esiste
                user: device.user,
                hasReadings: device.readings && device.readings.length > 0,
                readingsCount: device.readings ? device.readings.length : 0,
                allFields: Object.keys(device)
            });
        } catch (error) {
            console.error('Errore debug dispositivo:', error);
            res.status(500).json({ error: error.message, stack: error.stack });
        }
    });
    
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
            
            // Non generiamo più dati di fallback, mostriamo solo dati reali
            
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
                    // Se non ci sono letture, restituisci un oggetto vuoto invece di dati fittizi
                    responseData = {
                        timestamp: new Date(),
                        message: 'Nessun dato disponibile'
                    };
                }
                
                // Aggiungi la posizione del dispositivo
                responseData.position = device.position || 'Non specificata';
                
                return res.json(responseData);
            } 
            // Se non è specificato nessun ID stazione, restituisci un errore
            else {
                return res.status(400).json({
                    error: 'ID stazione non specificato',
                    message: 'È necessario specificare un ID stazione valido'
                });
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
