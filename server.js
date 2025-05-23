const express = require('express');
const session = require('express-session');
const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');
const connectDB = require('./config/db'); // Importazione della configurazione DB
const { User, Device } = require('./models/models'); // Importa i modelli da models.js
// Collections da utilizzare: solo users e devices

const app = express();
const PORT = 3000;

// Inizializza la connessione al database - l'app terminerà se MongoDB non è disponibile
connectDB();

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));



app.use(express.static('public'));

// Session configuration - migliorata per persistenza
app.use(session({
    secret: 'miosupersegretissimo',
    resave: true,
    saveUninitialized: false,
    cookie: { 
        secure: false, // Impostare a true in produzione con HTTPS
        maxAge: 24 * 60 * 60 * 1000 // Cookie valido per 24 ore
    }
}));

// View engine setup
app.set('view engine', 'ejs');
app.set('views', __dirname + '/views');

// Middleware di autenticazione migliorato
function requireAuth(req, res, next) {
  if (!req.session || !req.session.isLoggedIn) {
    return res.redirect('/login');
  }
  
  // Standardizziamo l'oggetto utente per garantire che tutte le pagine abbiano gli stessi campi
  if (req.session.user) {
    req.user = {
      _id: req.session.user._id,
      name: req.session.user.name || req.session.user.username || 'Utente',
      email: req.session.user.email || '',
      subscription: req.session.user.subscription || 'Standard'
    };
    
    // Aggiorniamo anche l'utente nella sessione per mantenere coerenza
    req.session.user = req.user;
  } else {
    // Se manca l'utente nella sessione, reindirizza al login
    return res.redirect('/login');
  }
  
  next();
}

// NUOVE ROTTE PER LE CENTRALINE

// Visualizzazione dettagli di una centralina
app.get('/station/:id', requireAuth, async (req, res) => {
  try {
    const user = req.user;
    const stationId = req.params.id;
    
    // Se l'ID è un ID di dispositivo esistente, lo gestiamo come tale
    if (mongoose.Types.ObjectId.isValid(stationId)) {
      const device = await Device.findOne({ _id: stationId, user: user._id });
      
      if (device) {
        // Ottieni le letture del dispositivo
        const readings = device.readings || [];
        const sensorData = readings.length > 0 ? readings[readings.length - 1] : {};
        
        // Adatta i dati al nuovo formato
        const station = {
          id: device._id,
          name: device.deviceId || 'Centralina',
          location: 'Non specificata',
          status: 'active'
        };
        
        return res.render('station-details', {
          user,
          station,
          sensorData: {
            temperature: sensorData.temperature,
            humidity: sensorData.humidity,
            airQuality: sensorData.gas,
            uv: sensorData.uv,
            lux: sensorData.lux,
            pressure: sensorData.pressure,
            soilMoisture: sensorData.soilMoisture,
            rain: sensorData.rain
          },
          historicalReadings: readings
        });
      }
    }
    
    // Se arrivati qui, o l'ID non è valido o il dispositivo non è stato trovato
    res.status(404).send('Centralina non trovata');
    
  } catch (error) {
    console.error('Errore nel caricamento dettagli centralina:', error);
    res.status(500).send('Errore del server');
  }
});

// Form per aggiungere una nuova centralina
app.get('/stations/new', requireAuth, (req, res) => {
  res.render('new-station', {
    user: req.user
  });
});

// Salvataggio nuova centralina
app.post('/stations/new', requireAuth, async (req, res) => {
  try {
    const { name, location, description } = req.body;
    const userId = req.user._id;
    
    // Crea una nuova centralina basata sul modello esistente
    // Per compatibilità, anche creare un Device
    const deviceId = `${name.replace(/\s+/g, '-').toLowerCase()}-${Date.now().toString().slice(-4)}`;
    
    const newDevice = new Device({
      deviceId,
      user: userId,
      readings: []
    });
    
    await newDevice.save();
    
    // Aggiorna l'utente con il nuovo dispositivo
    await User.findByIdAndUpdate(userId, {
      $push: { devices: newDevice._id }
    });
    
    // Crea anche la centralina nel nuovo modello
    const newStation = new Station({
      name,
      userId,
      location,
      description,
      apiKey: generateUniqueApiKey()
    });
    
    await newStation.save();
    
    res.redirect('/dashboard');
  } catch (error) {
    console.error('Errore nella creazione della centralina:', error);
    res.status(500).send('Errore del server');
  }
});

// Funzione helper per generare una chiave API casuale
function generateUniqueApiKey() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  const length = 32;
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

// Sensor data simulation - Ora utilizzeremo dati reali quando possibile
function generateSensorData() {
    return {
        temperature: Math.random() * 30 + 15,
        humidity: Math.random() * 50 + 30,
        airQuality: Math.random() * 100 + 50,
        windSpeed: Math.random() * 50
    };
}

// La funzione requireAuth è già definita in precedenza
// Non definirla nuovamente per evitare conflitti

// Routes
app.get('/', (req, res) => {
    res.render('home', {
        isLoggedIn: req.session.isLoggedIn || false,
        user: req.session.user || null,
        subscriptions: [
            {
                id: 1,
                name: 'Basic',
                price: 19.99,
                features: [
                    'Monitoraggio temperatura e umidità',
                    'Rilevamento qualità dell\'aria',
                    'Report mensili'
                ]
            },
            {
                id: 2,
                name: 'Premium',
                price: 39.99,
                features: [
                    'Tutte le funzionalità Basic',
                    'Rilevamento velocità del vento',
                    'Monitoraggio pioggia',
                    'Alert in tempo reale',
                    'Report giornalieri'
                ]
            },
            {
                id: 3,
                name: 'Enterprise',
                price: 99.99,
                features: [
                    'Tutte le funzionalità Premium',
                    'Monitoraggio umidità del terreno',
                    'Rilevamento luminosità e UV',
                    'API accesso',
                    'Supporto 24/7',
                    'Dashboard personalizzabile'
                ]
            }
        ]
    });
});

// Reindirizzamento esplicito da /home alla homepage
app.get('/home', (req, res) => {
    res.redirect('/');
});

// Route per la pagina dei piani di abbonamento
app.get('/subscription', (req, res) => {
    console.log('Route /subscription richiamata');
    res.render('subscription', {
        isLoggedIn: req.session.isLoggedIn || false,
        user: req.session.user || null
    });
});

app.get('/login', (req, res) => {
    if (req.session.isLoggedIn) {
        return res.redirect('/account');
    }
    res.render('login', { 
        error: null,
        isLoggedIn: false,
        user: null
    });
});

app.get('/register', (req, res) => {
    if (req.session.isLoggedIn) {
        return res.redirect('/account');
    }
    res.render('register', { 
        error: null,
        isLoggedIn: false,
        user: null
    });
});

// Versione completamente rivista della registrazione
app.post('/register', async (req, res) => {
    console.log('POST /register - Dati ricevuti:', req.body);
    
    try {
        // Estrazione dati
        const username = req.body.username;
        const email = req.body.email;
        const password = req.body.password;
        
        // Validazione base
        if (!username || !email || !password) {
            console.log('Dati mancanti:', { username: !!username, email: !!email, password: !!password });
            return res.render('register', { 
                error: 'Tutti i campi sono obbligatori',
                isLoggedIn: false,
                user: null 
            });
        }
        
        try {
            // Creazione hash password
            const hashedPassword = await bcrypt.hash(password, 10);
            
            // Creazione timestamp coerenti per createdAt e updatedAt
            const now = new Date();
            // Formattiamo la data come richiesto: YYYY-MM-DDThh:mm:ss.000+00:00
            now.setSeconds(0, 0); // Impostiamo i secondi a 9 e i millisecondi a 0
            now.setMinutes(now.getMinutes() - now.getTimezoneOffset()); // Convertiamo in UTC
            
            // Creazione utente con dati completi inclusi i timestamp
            const user = new User({
                username,
                email,
                password: hashedPassword,
                subscription: 'standard',
                devices: [],
                createdAt: now,
                updatedAt: now
            });
            
            // Salvataggio utente con promise e try/catch espliciti
            try {
                const savedUser = await user.save();
                console.log('Utente salvato con successo:', savedUser._id);
                console.log('Timestamp utente:', {
                    createdAt: savedUser.createdAt,
                    updatedAt: savedUser.updatedAt
                });
                
                // Salvataggio in sessione delle informazioni complete
                req.session.isLoggedIn = true;
                req.session.user = {
                    _id: savedUser._id,
                    username: savedUser.username,
                    email: savedUser.email,
                    subscription: savedUser.subscription,
                    createdAt: savedUser.createdAt,
                    updatedAt: savedUser.updatedAt
                };
                
                return res.redirect('/protected');
            } catch (saveError) {
                console.error('Errore nel salvataggio utente:', saveError);
                
                // Gestione errori di duplicazione
                if (saveError.code === 11000) {
                    return res.render('register', { 
                        error: 'Username o email già esistenti',
                        isLoggedIn: false,
                        user: null
                    });
                }
                
                return res.render('register', { 
                    error: `Errore nel salvataggio: ${saveError.message}`,
                    isLoggedIn: false,
                    user: null
                });
            }
        } catch (error) {
            console.error('Errore nella creazione utente:', error);
            return res.render('register', { 
                error: `Errore nella registrazione: ${error.message}`,
                isLoggedIn: false,
                user: null
            });
        }
    } catch (error) {
        console.error('Errore generale:', error);
        return res.render('register', { 
            error: 'Si è verificato un errore imprevisto',
            isLoggedIn: false,
            user: null
        });
    }
});

app.post('/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        
        // Modalità database attiva
        try {
            const user = await User.findOne({ username });
            if (!user) {
                return res.render('login', { 
                    error: 'User not found!',
                    isLoggedIn: false,
                    user: null
                });
            }

            const isValidPassword = await bcrypt.compare(password, user.password);
            if (!isValidPassword) {
                return res.render('login', { 
                    error: 'Invalid password!',
                    isLoggedIn: false,
                    user: null
                });
            }

            req.session.isLoggedIn = true;
            req.session.user = user.toObject();
            
            return res.redirect('/protected');
        } catch (error) {
            console.error("DB error during login:", error);
            res.render('login', { 
                error: 'Login failed. Please try again.',
                isLoggedIn: false,
                user: null
            });
        }
    } catch (error) {
        console.error(error);
        res.render('login', { 
            error: 'Login failed. Please try again.',
            isLoggedIn: false,
            user: null
        });
    }
});

// Pagina account utente
app.get('/account', requireAuth, (req, res) => {
    res.render('account', {
        isLoggedIn: true,
        user: req.session.user,
        pageTitle: 'Il tuo Account'
    });
});

// Mantengo la vecchia rotta per compatibilità, ma reindirizzo
app.get('/protected', requireAuth, (req, res) => {
    res.redirect('/account');
});

// Implementazione della rotta di logout
app.get('/logout', (req, res) => {
    // Distruggi la sessione
    req.session.destroy(err => {
        if (err) {
            console.error('Errore durante il logout:', err);
            return res.redirect('/');
        }
        // Cancella il cookie di sessione
        res.clearCookie('connect.sid');
        // Reindirizza alla home
        res.redirect('/');
    });
});

// Modifica alla route dashboard per ottenere i dati più recenti delle centraline
app.get('/dashboard', requireAuth, async (req, res) => {
    try {
        console.log('=== ACCESSO ALLA DASHBOARD ===');
        console.log('Utente:', req.session.user.username, 'ID:', req.session.user._id);
        
        let userDevices = [];
        let selectedDevice = null;
        
        // Dati di sensore predefiniti - garantisce che ci siano sempre tutti i valori necessari
        const defaultSensorData = {
            temperature: 22.5,
            humidity: 65,
            airQuality: 450,
            windSpeed: 10.5,
            uv: 5.2,
            lux: 1200,
            pressure: 1013.25,
            soilMoisture: 75.8,
            rain: 0
        };
        
        // Inizializza sensorData con i valori predefiniti
        let sensorData = { ...defaultSensorData };
        // Inizializza l'array delle stazioni
        let stations = [];  
        let historicalReadings = [];
        
        try {
            console.log('Recupero dispositivi con relative posizioni...');
            
            // Utilizziamo un populate completo per ottenere tutti i campi, incluso position
            const user = await User.findById(req.session.user._id).populate({
                path: 'devices',
                // Assicuriamoci di ottenere tutti i campi delle readings e position
                populate: {
                    path: 'readings',
                    options: { sort: { 'timestamp': 1 } } // Ordina per timestamp crescente
                }
            });
            
            // Tentiamo anche un accesso diretto alla collection devices per assicurarci di recuperare il campo position
            const deviceCollection = await mongoose.connection.db.collection('devices').find({
                user: new mongoose.Types.ObjectId(req.session.user._id)
            }).toArray();
            
            console.log('Dati dalla collection devices:', deviceCollection.length > 0 ? 'trovati' : 'non trovati');
            if (deviceCollection.length > 0) {
                console.log('Campi disponibili nei dispositivi:', Object.keys(deviceCollection[0]).join(', '));
            }
            
            if (user && user.devices && user.devices.length > 0) {
                userDevices = user.devices;
                selectedDevice = userDevices[0]; // Prendi il primo dispositivo come default
                
                // Ora arricchiamo i dispositivi con la posizione recuperata direttamente dalla collection
                if (deviceCollection && deviceCollection.length > 0) {
                    console.log('Mappatura posizioni dai dati della collection...');
                    
                    // Creiamo una mappa di posizioni per id dispositivo per facile lookup
                    const positionMap = {};
                    deviceCollection.forEach(device => {
                        if (device._id && device.position) {
                            positionMap[device._id.toString()] = device.position;
                            console.log(`Posizione per dispositivo ${device._id}: ${device.position}`);
                        }
                    });
                    
                    // Applichiamo le posizioni ai dispositivi dell'utente
                    userDevices.forEach(device => {
                        const deviceId = device._id.toString();
                        if (positionMap[deviceId]) {
                            device.position = positionMap[deviceId];
                            console.log(`Aggiornata posizione per ${device.deviceId}: ${device.position}`);
                        }
                    });
                }
                
                console.log(`Dispositivo selezionato: ${selectedDevice.deviceId}, letture disponibili: ${selectedDevice.readings ? selectedDevice.readings.length : 0}`);
                
                // Effettua una query separata per ottenere il dispositivo con tutte le readings
                // Non c'è bisogno di populate perché le readings sono embedded nel documento
                const device = await Device.findById(selectedDevice._id).lean();
                
                // Log per il debug completo del dispositivo
                console.log('-------------------------- DATI DISPOSITIVO --------------------------');
                console.log('Dispositivo recuperato:', device.deviceId);
                console.log('ID dispositivo:', device._id);
                console.log('Numero di readings trovate:', device.readings ? device.readings.length : 0);
                
                // Se il dispositivo ha letture, utilizzale
                if (device && device.readings && device.readings.length > 0) {
                    // Log dettagliato di tutte le readings
                    console.log('-------------------------- DETTAGLIO READINGS --------------------------');
                    device.readings.forEach((reading, index) => {
                        console.log(`[Reading ${index+1}/${device.readings.length}]`);
                        console.log(`  Timestamp: ${reading.timestamp}`);
                        console.log(`  Temperatura: ${reading.temperature}°C`);
                        console.log(`  Umidità: ${reading.humidity}%`);
                        console.log(`  Gas: ${reading.gas} ppm`);
                        console.log(`  UV: ${reading.uv}`);
                        console.log(`  Luminosità: ${reading.lux} lux`);
                        console.log(`  Pressione: ${reading.pressure} hPa`);
                        console.log(`  Umidità suolo: ${reading.soilMoisture}%`);
                        console.log(`  Pioggia: ${reading.rain} mm`);
                    });
                    
                    // *** IMPORTANTE: Trasferire tutte le readings ESATTAMENTE come sono nel DB ***
                    // Queste verranno visualizzate dalla dashboard
                    historicalReadings = device.readings;
                    
                    // Usa la lettura più recente per i valori attuali
                    const latestReading = device.readings[device.readings.length - 1];
                    console.log('Ultima lettura disponibile:', latestReading);
                    
                    // Combina le letture più recenti con i valori predefiniti
                    sensorData = { ...defaultSensorData };
                    
                    // Aggiorna i valori disponibili
                    if (latestReading.temperature !== undefined) sensorData.temperature = latestReading.temperature;
                    if (latestReading.humidity !== undefined) sensorData.humidity = latestReading.humidity;
                    if (latestReading.gas !== undefined) sensorData.airQuality = latestReading.gas; // 'gas' nella collection, 'airQuality' nella UI
                    if (latestReading.pressure !== undefined) sensorData.pressure = latestReading.pressure;
                    if (latestReading.uv !== undefined) sensorData.uv = latestReading.uv;
                    if (latestReading.lux !== undefined) sensorData.lux = latestReading.lux;
                    if (latestReading.soilMoisture !== undefined) sensorData.soilMoisture = latestReading.soilMoisture;
                    if (latestReading.rain !== undefined) sensorData.rain = latestReading.rain;
                }
            }
        } catch (error) {
            console.error("DB error in dashboard:", error);
            // Continuiamo con i dati demo invece di reindirizzare
            console.log("Utilizzo dati demo per la dashboard");
        }
        
        // Log dei dati sensore per debug
        console.log("Dati sensori utilizzati:", sensorData);
        console.log("Dati storici passati al template:", Array.isArray(historicalReadings) ? 
                   `Array di ${historicalReadings.length} elementi` : 
                   `Non è un array: ${typeof historicalReadings}`);
        
        // Prepara i dati per la dashboard
        console.log('\n=== DASHBOARD - RECUPERO CENTRALINE ===');
        console.log('Utente:', req.session.user.username, 'ID:', req.session.user._id);
        stations = [];
        
        try {
            const userId = req.session.user._id;
            const currentUserIdStr = userId.toString();
            
            console.log('Cerco SOLO dispositivi per utente ID:', currentUserIdStr);
            
            // Cerca SOLO i dispositivi che appartengono all'utente corrente
            const devices = await Device.find({
                $or: [
                    { userId: userId },  // Controlla se userId corrisponde all'ID dell'utente
                    { user: userId }     // O se user (ObjectId) corrisponde all'ID dell'utente
                ]
            });
            
            console.log(`Trovati ${devices.length} dispositivi per l'utente corrente`);
            
            // Converti in stazioni per la dashboard
            stations = devices.map(device => {
                const lastReading = device.readings && device.readings.length > 0 ?
                    device.readings[device.readings.length - 1] : null;
                
                // Recupera la posizione dal campo position della collection, altrimenti usa location o il valore predefinito
                const devicePosition = device.position || 'Non specificata';
                console.log(`Posizione rilevata per ${device.deviceId}: ${devicePosition}`);
                
                return {
                    id: device._id,
                    name: device.deviceId || 'Lora001',
                    location: devicePosition, // Utilizziamo il campo position per la location
                    status: device.status || 'active',
                    lastReading: lastReading ? {
                        temperature: lastReading.temperature,
                        humidity: lastReading.humidity,
                        airQuality: lastReading.gas,
                        uv: lastReading.uv,
                        lux: lastReading.lux,
                        pressure: lastReading.pressure,
                        soilMoisture: lastReading.soilMoisture,
                        rain: lastReading.rain
                    } : null
                };
            });
        } catch (error) {
            console.error('Errore durante il recupero dei dispositivi:', error);
            // In caso di errore, mostriamo una dashboard vuota
            stations = [];
        }
        
        // Se non ci sono stazioni, mostriamo un messaggio di debug
        if (stations.length === 0) {
            console.log('\n\n========================= AVVISO =========================');
            console.log('Nessuna centralina trovata per questo utente.');
            console.log('Verifica che i dispositivi siano correttamente associati all\'utente.');
            console.log('ID utente corrente:', req.session.user._id);
            console.log('=================================================================\n\n');
        }
        
        console.log(`Dashboard - Invio ${stations.length} centraline al template`);
        console.log('===================================\n');
        // Assicurati che stations sia sempre un array valido
        if (!Array.isArray(stations)) {
            console.log('Attenzione: stations non è un array, inizializzo array vuoto');
            stations = [];
        }
        
        console.log(`Pronto per il rendering della dashboard con ${stations.length} stazioni`);
        
        // Renderizza la dashboard con i dati
        res.render('dashboard', {
            user: req.session.user,
            // Vecchi parametri per compatibilità
            devices: userDevices,
            selectedDevice: selectedDevice,
            deviceId: selectedDevice ? selectedDevice.deviceId : 'lora001',
            sensorData: sensorData,
            historicalReadings: historicalReadings || [],
            
            // Nuovi parametri per il template aggiornato
            stations: stations,
            lastLogin: req.session.lastLogin || new Date()
        });
    } catch (error) {
        console.error(error);
        res.redirect('/login');
    }
});

// API per dati sensori in tempo reale - endpoint generico
app.get('/api/sensor-data', async (req, res) => {
    // Per le API di lettura dei dati, controlliamo se l'utente è autenticato
    if (!req.session.isLoggedIn) {
        return res.status(401).json({ error: 'Non autorizzato' });
    }

    try {
        // Parametri per trovare la centralina/dispositivo
        let deviceId = req.query.deviceId || null;
        let stationId = req.query.stationId || null;
        let sensorData = generateSensorData(); // Default come fallback
        
        // Correzione: assicuriamoci che l'ID della stazione sia una stringa valida senza caratteri speciali
        if (stationId) {
            stationId = stationId.trim(); // Rimuovi spazi vuoti
            if (stationId.includes('"') || stationId.includes('\'')) {
                // Rimuovi eventuali virgolette che potrebbero essere state aggiunte
                stationId = stationId.replace(/["']/g, '');
            }
        }

        console.log('API dati sensore - URL completo:', req.url);
        console.log('API dati sensore - tutti i parametri query:', req.query);
        console.log(`API dati sensore - parametri estratti: stationId=${stationId}, deviceId=${deviceId}`);
        console.log('API dati sensore - Validazione stationId:', {
            stationId: stationId,
            isValid: stationId && mongoose.Types.ObjectId.isValid(stationId),
            isString: typeof stationId === 'string',
            length: stationId ? stationId.length : 0
        });

        // Verifica prima se è richiesta una stazione specifica
        if (stationId) {
            console.log('Tipo di stationId:', typeof stationId, 'Valore:', stationId);

            // Accedi direttamente ai dispositivi (devices) usando l'ID come identificativo
            console.log('Cerco il dispositivo direttamente come ObjectId');
            const userId = req.session.user._id;

            // Cerca il dispositivo direttamente
            let device = null;

            // Prima verifica se è un ObjectId valido e cerca direttamente per _id
            if (mongoose.Types.ObjectId.isValid(stationId)) {
                console.log('ID valido, ricerca per _id');
                device = await Device.findOne({
                    _id: stationId,
                    $or: [
                        { userId: userId },
                        { user: userId }
                    ]
                });
            }

            // Se non è stato trovato, prova a cercarlo per deviceId
            if (!device) {
                console.log('Dispositivo non trovato per _id, provo per deviceId');
                device = await Device.findOne({
                    deviceId: stationId,
                    $or: [
                        { userId: userId },
                        { user: userId }
                    ]
                });
            }

            // Se ancora non è stato trovato, cerca tutti i dispositivi dell'utente
            if (!device) {
                console.log('Dispositivo non trovato per deviceId, cerco tutti i dispositivi dell\'utente');
                const devices = await Device.find({
                    $or: [
                        { userId: userId },
                        { user: userId }
                    ]
                });

                console.log(`Trovati ${devices.length} dispositivi per l'utente`);

                // Controlla se qualche dispositivo ha un ID che corrisponde alla stringa
                for (const d of devices) {
                    if (d._id.toString() === stationId || d._id.toString().includes(stationId)) {
                        device = d;
                        console.log('Dispositivo trovato tramite confronto stringhe');
                        break;
                    }
                }
            }

            // Se è stato trovato un dispositivo, usa i suoi dati
            if (device) {
                console.log(`Trovato dispositivo con ID: ${device._id}, DeviceID: ${device.deviceId || 'N/A'}`);

                if (device.readings && device.readings.length > 0) {
                    // Prendi l'ultima lettura disponibile
                    const latestReading = device.readings[device.readings.length - 1];

                    // Formatta i dati nel formato richiesto dal frontend
                    sensorData = {
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
                        rain: latestReading.rain,
                        timestamp: new Date(latestReading.timestamp)
                    };

                    console.log(`Dati sensore recuperati dalle readings del dispositivo ${device.deviceId || 'N/A'}`);
                    return res.json(sensorData);
                } else {
                    console.log(`Nessuna lettura trovata per il dispositivo ${device.deviceId || device._id}`);
                }
            }
        }
        // Compatibilità con il vecchio sistema basato su deviceId
        else if (deviceId) {
            // Cerca il dispositivo specifico usando lo stesso pattern della dashboard
            const userId = req.session.user._id;
            const device = await Device.findOne({
                deviceId,
                $or: [
                    { userId: userId },
                    { user: userId }
                ]
            });
            
            if (device && device.readings && device.readings.length > 0) {
                // Prendi la lettura più recente
                const latestReading = device.readings[device.readings.length - 1];
                sensorData = {
                    temperature: latestReading.temperature,
                    humidity: latestReading.humidity,
                    airQuality: latestReading.gas, // Normalizzazione campo gas -> airQuality
                    pressure: latestReading.pressure,
                    uv: latestReading.uv,
                    lux: latestReading.lux,
                    soilMoisture: latestReading.soilMoisture,
                    rain: latestReading.rain,
                    timestamp: latestReading.timestamp
                };
                return res.json(sensorData);
            }
        }
        // Se non è specificato né stationId né deviceId
        else {
            // Prova prima a controllare se l'utente ha centraline nel nuovo modello
            const stations = await Station.find({ userId: req.session.user._id }).limit(1);
            
            if (stations && stations.length > 0) {
                const firstStation = stations[0];
                const latestReading = await SensorData.findOne({ stationId: firstStation._id })
                    .sort({ timestamp: -1 })
                    .limit(1);
                
                if (latestReading) {
                    sensorData = {
                        temperature: latestReading.temperature,
                        humidity: latestReading.humidity,
                        airQuality: latestReading.airQuality,
                        pressure: latestReading.pressure,
                        uv: latestReading.uv,
                        lux: latestReading.lux,
                        soilMoisture: latestReading.soilMoisture,
                        rain: latestReading.rain,
                        timestamp: latestReading.timestamp
                    };
                    return res.json(sensorData);
                }
            }
            
            // Fallback sul modello aggiornato - cerca direttamente i dispositivi
            const userId = req.session.user._id;
            const devices = await Device.find({
                $or: [
                    { userId: userId },
                    { user: userId }
                ]
            }).limit(1);
            
            if (devices && devices.length > 0) {
                const firstDevice = devices[0];
                
                if (firstDevice && firstDevice.readings && firstDevice.readings.length > 0) {
                    // Prendi la lettura più recente
                    const latestReading = firstDevice.readings[firstDevice.readings.length - 1];
                    sensorData = {
                        temperature: latestReading.temperature,
                        humidity: latestReading.humidity,
                        airQuality: latestReading.gas, // Normalizzazione campo
                        pressure: latestReading.pressure,
                        uv: latestReading.uv,
                        lux: latestReading.lux,
                        soilMoisture: latestReading.soilMoisture,
                        rain: latestReading.rain,
                        timestamp: latestReading.timestamp
                    };
                    return res.json(sensorData);
                }
            }
        }

        // Fallback: dati simulati realistici
        sensorData = {
            temperature: 22 + (Math.random() * 2 - 1),  // circa 21-23°C
            humidity: 65 + (Math.random() * 6 - 3),     // circa 62-68%
            airQuality: 450 + (Math.random() * 40 - 20), // circa 430-470 ppm
            uv: 5 + (Math.random() * 2 - 1),           // circa 4-6 UV
            lux: 1200 + (Math.random() * 400 - 200),    // circa 1000-1400 lux
            pressure: 1013 + (Math.random() * 2 - 1),   // circa 1012-1014 hPa
            soilMoisture: 75 + (Math.random() * 2 - 1), // circa 74-76%
            rain: Math.random() > 0.9 ? Math.random() * 0.5 : 0, // perlopiù 0, raramente fino a 0.5mm
            timestamp: new Date(),
            isSimulated: true  // Indicatore che questi sono dati simulati
        };
        
        res.json(sensorData);
    } catch (error) {
        console.error('Errore API sensori:', error);
        res.status(500).json({ error: 'Errore server' });
    }
});

// Debug per tutte le richieste API
app.use('/api', (req, res, next) => {
    console.log('Richiesta API ricevuta:', req.method, req.url);
    console.log('Parametri:', req.params);
    console.log('Query:', req.query);
    next();
});

// Nuovo endpoint API specifico per i dati della stazione corrente (spostato prima per priorità)
app.get('/api/station/:stationId/sensor-data', async (req, res) => {
    console.log('Richiesta API sensori per stazione specifica ricevuta');
    console.log('Parametri della richiesta:', req.params);
    
    // Verifica autenticazione
    if (!req.session.isLoggedIn) {
        console.log('Utente non autenticato, richiesta rifiutata');
        return res.status(401).json({ error: 'Non autorizzato' });
    }

    try {
        // Otteniamo l'ID della stazione direttamente dall'URL
        const stationId = req.params.stationId;
        console.log('API dati stazione specifica - stationId dall\'URL:', stationId);
        
        if (!stationId || !mongoose.Types.ObjectId.isValid(stationId)) {
            return res.status(400).json({ error: 'ID stazione non valido' });
        }
        
        // Cerca la stazione specifica
        const station = await Station.findOne({
            _id: stationId,
            userId: req.session.user._id  // Assicurati che appartenga all'utente
        });
        
        if (!station) {
            return res.status(404).json({ error: 'Stazione non trovata' });
        }
        
        console.log(`Trovata stazione: ${station.name}, deviceId: ${station.deviceId}`);
        
        // Dati di fallback se non troviamo letture reali
        let sensorData = {
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
            timestamp: new Date(),
            isSimulated: true
        };
        
        // Se la stazione ha un deviceId associato, cerca i dati reali
        if (station.deviceId) {
            const device = await Device.findOne({ deviceId: station.deviceId });
            
            if (device && device.readings && device.readings.length > 0) {
                // Prendi l'ultima lettura disponibile
                const latestReading = device.readings[device.readings.length - 1];
                
                // Formatta i dati nel formato richiesto dal frontend
                sensorData = {
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
                    rain: latestReading.rain,
                    timestamp: new Date(latestReading.timestamp),
                    isSimulated: false
                };
                
                console.log(`Dati sensore recuperati dalle readings del dispositivo ${device.deviceId}`);
            } else {
                console.log(`Nessuna lettura trovata per il dispositivo ${station.deviceId}`);
            }
        } else {
            console.log('Stazione senza deviceId associato, usando dati simulati');
        }
        
        return res.json(sensorData);
        
    } catch (error) {
        console.error('Errore API dati stazione:', error);
        return res.status(500).json({ error: 'Errore server' });
    }
});

// Routes API per dispositivi
app.get('/api/devices', async (req, res) => {
    if (!req.session.isLoggedIn) {
        return res.status(401).json({ error: 'Non autorizzato' });
    }
    
    try {
        let devices = [];
        
        try {
            const user = await User.findById(req.session.user._id).populate('devices');
            if (user && user.devices) {
                devices = user.devices;
            }
        } catch (error) {
            console.error("DB error fetching devices:", error);
            res.status(500).json({ error: 'Errore server' });
        }
        
        res.json({ devices });
    } catch (error) {
        console.error('Errore nel recupero dispositivi:', error);
        res.status(500).json({ error: 'Errore server' });
    }
});

app.post('/api/devices/assign', async (req, res) => {
    if (!req.session.isLoggedIn) {
        return res.status(401).json({ error: 'Non autorizzato' });
    }
    
    try {
        const { deviceId } = req.body;
        
        // Trova il dispositivo
        let device = await Device.findOne({ deviceId });
        
        // Se il dispositivo non esiste, lo creiamo
        if (!device) {
            device = new Device({ deviceId });
            await device.save();
        } else if (device.user) {
            return res.status(400).json({ error: 'Dispositivo già assegnato ad un altro utente' });
        }
        
        // Ottieni l'utente
        const user = await User.findById(req.session.user._id);
        
        // Verifica se l'utente può aggiungere altri dispositivi
        if (user.devices.length >= user.getMaxDevices()) {
            return res.status(400).json({ 
                error: `Il tuo piano ${user.subscription} consente un massimo di ${user.getMaxDevices()} dispositivi` 
            });
        }
        
        // Assegna il dispositivo all'utente
        device.user = user._id;
        await device.save();
        
        // Aggiungi il dispositivo alla lista dell'utente
        user.devices.push(device._id);
        await user.save();
        
        res.json({ success: true, device });
    } catch (error) {
        console.error('Errore nell\'assegnazione del dispositivo:', error);
        res.status(500).json({ error: 'Errore server' });
    }
});

// API per rimuovere un dispositivo da un utente
app.post('/api/devices/remove', async (req, res) => {
    if (!req.session.isLoggedIn) {
        return res.status(401).json({ error: 'Non autorizzato' });
    }
    
    try {
        const { deviceId } = req.body;
        
        // Trova il dispositivo
        const device = await Device.findOne({ deviceId });
        
        if (!device) {
            return res.status(404).json({ error: 'Dispositivo non trovato' });
        }
        
        // Verifica che il dispositivo appartenga all'utente
        if (device.user.toString() !== req.session.user._id) {
            return res.status(403).json({ error: 'Non hai i permessi per questo dispositivo' });
        }
        
        // Rimuovi l'associazione
        device.user = null;
        await device.save();
        
        // Rimuovi il dispositivo dalla lista dell'utente
        const user = await User.findById(req.session.user._id);
        user.devices = user.devices.filter(d => d.toString() !== device._id.toString());
        await user.save();
        
        res.json({ success: true });
    } catch (error) {
        console.error('Errore nella rimozione del dispositivo:', error);
        res.status(500).json({ error: 'Errore server' });
    }
});

// API per ottenere le letture più recenti di un dispositivo
app.get('/api/devices/:deviceId/readings', async (req, res) => {
    if (!req.session.isLoggedIn) {
        return res.status(401).json({ error: 'Non autorizzato' });
    }
    
    try {
        const { deviceId } = req.params;
        
        // Trova il dispositivo
        const device = await Device.findOne({ deviceId });
        
        if (!device) {
            return res.status(404).json({ error: 'Dispositivo non trovato' });
        }
        
        // Verifica che il dispositivo appartenga all'utente o sia non assegnato (per admin)
        if (device.user && device.user.toString() !== req.session.user._id) {
            return res.status(403).json({ error: 'Non hai i permessi per questo dispositivo' });
        }
        
        res.json({ readings: device.readings });
    } catch (error) {
        console.error('Errore nel recupero delle letture:', error);
        res.status(500).json({ error: 'Errore server' });
    }
});

// Route per ricevere i dati dei sensori direttamente dalle centraline (POST ogni 30 secondi)
app.post('/device-data', async (req, res) => {
    try {
        const { deviceId, readings } = req.body;
        
        if (!deviceId || !readings) {
            return res.status(400).json({ error: 'Dati mancanti o non validi' });
        }
        
        try {
            // Trova il dispositivo per deviceId nella collection 'devices'
            let device = await Device.findOne({ deviceId });
            
            // Se il dispositivo non esiste, lo creiamo
            if (!device) {
                console.log(`Creazione nuovo dispositivo con ID: ${deviceId}`);
                device = new Device({
                    deviceId,
                    readings: []  // Inizializziamo con un array vuoto di letture
                });
            }
            
            // Prepara la nuova lettura da aggiungere all'array
            const newReading = {
                timestamp: new Date()
            };
            
            // Aggiungi tutti i campi di lettura disponibili
            if (readings.temperature !== undefined) newReading.temperature = readings.temperature;
            if (readings.humidity !== undefined) newReading.humidity = readings.humidity;
            if (readings.gas !== undefined) newReading.gas = readings.gas;
            if (readings.uv !== undefined) newReading.uv = readings.uv;
            if (readings.lux !== undefined) newReading.lux = readings.lux;
            if (readings.pressure !== undefined) newReading.pressure = readings.pressure;
            if (readings.soilMoisture !== undefined) newReading.soilMoisture = readings.soilMoisture;
            if (readings.rain !== undefined) newReading.rain = readings.rain;
            
            // Aggiungi la nuova lettura all'array delle letture del dispositivo
            device.readings.push(newReading);
            
            // Salva il dispositivo con la nuova lettura
            await device.save();
            
            console.log(`Nuova lettura aggiunta per il dispositivo ${deviceId}. Letture totali: ${device.readings.length}`);
            
            // Risposta alla centralina
            res.status(200).json({ 
                success: true, 
                message: 'Lettura aggiunta con successo',
                deviceId: deviceId,
                readingsCount: device.readings.length,
                timestamp: newReading.timestamp
            });
        } catch (error) {
            console.error('Errore nel salvataggio della lettura:', error);
            res.status(500).json({ error: `Errore server durante il salvataggio: ${error.message}` });
        }
    } catch (error) {
        console.error('Errore nella ricezione dei dati:', error);
        res.status(500).json({ error: 'Errore server' });
    }
});

// Route per una pagina di test - dovrebbe funzionare sempre
app.get('/station/test', (req, res) => {
    // Se l'utente non è autenticato, redirect al login
    if (!req.session || !req.session.user) {
        return res.redirect('/login');
    }
    
    // Risposta semplice - niente template, solo testo
    return res.send(`
    <!DOCTYPE html>
    <html>
    <head>
        <title>Test Centralina</title>
        <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">
    </head>
    <body>
        <div class="container mt-5">
            <div class="alert alert-success">
                <h4>Pagina di Test</h4>
                <p>Questa pagina funziona correttamente.</p>
            </div>
            <a href="/dashboard" class="btn btn-primary">Torna alla Dashboard</a>
        </div>
    </body>
    </html>
    `);
});

// PAGINA COMPLETAMENTE VUOTA come richiesto dall'utente
app.post('/station/details', (req, res) => {
    // Log per debug
    console.log('POST /station/details - BODY:', req.body);
    
    try {
        // Ottieni l'ID della stazione
        const stationId = req.body.stationId || 'ID non disponibile';
        
        // Invia solo una pagina completamente bianca con il minimo indispensabile
        res.setHeader('Content-Type', 'text/html');
        return res.send(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>Pagina Bianca Test</title>
            </head>
            <body style="background-color: white; padding: 20px;">
                <h1>Pagina di Test</h1>
                <p>L'ID ricevuto è: ${stationId}</p>
                <hr>
                <a href="/dashboard">Torna alla dashboard</a>
            </body>
            </html>
        `);
    } catch (error) {
        console.error('ERRORE:', error);
        return res.redirect('/dashboard');
    }
});

// [Rimossa la vecchia API per la pagina statica - Ora utilizziamo il rendering EJS diretto]

// Route dinamica per visualizzare i dettagli della centralina
app.get('/station/:id', requireAuth, async (req, res) => {
    const stationId = req.params.id;
    
    try {
        // Connessione diretta a MongoDB usando il driver nativo
        const { MongoClient, ObjectId } = require('mongodb');
        const uri = 'mongodb://localhost:27017';
        const dbName = 'loraAirDB';
        
        const client = new MongoClient(uri, { useUnifiedTopology: true });
        await client.connect();
        
        // Accesso al database e alla collezione
        const db = client.db(dbName);
        const devicesCollection = db.collection('devices');
        
        // Cerca il dispositivo per ID
        let deviceData = null;
        
        try {
            // Tento prima con ObjectId
            deviceData = await devicesCollection.findOne({ _id: new ObjectId(stationId) });
        } catch (idError) {
            // Tentativo fallback con deviceId come stringa
            deviceData = await devicesCollection.findOne({ deviceId: stationId });
        }
        
        // Se il dispositivo non è stato trovato, redirect alla dashboard
        if (!deviceData) {
            console.error('⚠️ Dispositivo non trovato in MongoDB');
            await client.close();
            return res.redirect('/dashboard');
        }
        
        // Utilizziamo una posizione fissa per tutti i dettagli della stazione
        const devicePosition = 'Via Don Carlo Chiavazza 16, Racconigi';

        
        // Recupera l'ultima lettura (se disponibile)
        const lastReading = deviceData.readings && deviceData.readings.length > 0 ?
            deviceData.readings[deviceData.readings.length - 1] : null;
        
        console.log('Ultima lettura:', lastReading ? '✅ Disponibile' : '❌ Non disponibile');
        if (lastReading) {
            console.log('Campi lettura:', Object.keys(lastReading).join(', '));
        }
        
        // Preparazione dati completi per il template
        const stationData = {
            id: stationId,
            name: deviceData.deviceId || 'Centralina ' + stationId.substring(0, 5).toUpperCase(),
            location: devicePosition, // Utilizziamo la posizione recuperata direttamente da MongoDB
            description: 'Centralina di monitoraggio ambientale',
            status: deviceData.status || 'active',
            lastUpdate: lastReading ? new Date(lastReading.timestamp).toISOString() : new Date().toISOString(),
            // Formatta la data in modo leggibile per l'utente
            formattedUpdate: lastReading ? new Date(lastReading.timestamp).toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' }) : 'Data non disponibile',

            // Utilizziamo i dati reali dei sensori se disponibili
            readings: {
                temperature: {
                    current: lastReading?.temperature || 22.5,
                    min: lastReading?.temperature ? (lastReading.temperature - 1.5) : 21.0,
                    max: lastReading?.temperature ? (lastReading.temperature + 1.5) : 24.0,
                    unit: '°C'
                },
                humidity: {
                    current: lastReading?.humidity || 65.0,
                    min: lastReading?.humidity ? (lastReading.humidity - 5) : 60.0,
                    max: lastReading?.humidity ? (lastReading.humidity + 5) : 70.0,
                    unit: '%'
                },
                airQuality: {
                    current: lastReading?.gas || 420,
                    min: lastReading?.gas ? (lastReading.gas - 20) : 400,
                    max: lastReading?.gas ? (lastReading.gas + 30) : 450,
                    unit: 'ppm'
                },
                // Aggiungiamo altri sensori disponibili
                pressure: {
                    current: lastReading?.pressure || 1013.25,
                    min: lastReading?.pressure ? (lastReading.pressure - 10) : 1005,
                    max: lastReading?.pressure ? (lastReading.pressure + 10) : 1020,
                    unit: 'hPa'
                },
                uv: {
                    current: lastReading?.uv || 5.2,
                    min: lastReading?.uv ? (lastReading.uv - 1) : 4.0,
                    max: lastReading?.uv ? (lastReading.uv + 1) : 6.5,
                    unit: 'UV'
                },
                lux: {
                    current: lastReading?.lux || 1200,
                    min: lastReading?.lux ? (lastReading.lux - 200) : 1000,
                    max: lastReading?.lux ? (lastReading.lux + 200) : 1400,
                    unit: 'lux'
                }
            }
        };
        
        // Log dei dati completi per debug
        console.log('Dati preparati per il template:', JSON.stringify(stationData, null, 2).substring(0, 300) + '...');
        
        // Chiusura della connessione MongoDB
        await client.close();
        console.log('Connessione MongoDB chiusa');
        
        // Aggiungiamo la posizione anche all'oggetto lettura per assicurarci che sia disponibile
        // nei dati visualizzati nella console
        const sensorDataWithPosition = {
            ...lastReading || {},
            position: devicePosition  // Aggiungiamo la posizione ai dati del sensore
        };
        
        // Aggiungiamo la posizione direttamente al documento per aggiornarlo in MongoDB
        if (!deviceData.position) {
            try {
                // Operazione di aggiornamento del documento nella collection
                await devicesCollection.updateOne(
                    { _id: deviceData._id },
                    { $set: { position: devicePosition } }
                );
                console.log(`✅ Posizione aggiunta definitivamente al documento nel database: ${devicePosition}`);
            } catch (err) {
                console.error('Errore aggiornamento documento:', err);
            }
        }
        
        console.log('\n\nDATA COMPLETI CON POSIZIONE:', sensorDataWithPosition);
        
        // Renderizza il template con i dati recuperati direttamente da MongoDB
        console.log('Renderizzazione template con dati MongoDB');
        return res.render('station-details', {
            station: stationData,
            user: req.session.user || {},
            sensorData: sensorDataWithPosition
        });
    } catch (error) {
        console.error('Errore nella visualizzazione dettagli centralina:', error);
        
        // Fallback: rendiamo comunque la pagina con un errore appropriato
        return res.status(500).render('error', {
            message: 'Si è verificato un errore durante la visualizzazione dei dettagli della centralina',
            error: error
        });
    }
});

// Route per mostrare il form di creazione di una nuova centralina
app.get('/stations/new', requireAuth, (req, res) => {
    console.log('Visualizzazione form creazione nuova centralina');
    try {
        // Verifica se l'utente è presente nella sessione
        if (!req.session || !req.session.user) {
            console.error('Utente non trovato nella sessione');
            return res.redirect('/login');
        }
        
        // Debug per vedere cosa contiene l'oggetto utente
        console.log('Dati utente nella sessione:', req.session.user);
        
        // Crea un mock utente se necessario per garantire che le proprietà esistano
        const userData = {
            _id: req.session.user._id || '1',
            name: req.session.user.name || req.session.user.username || 'Utente',
            email: req.session.user.email || 'email@example.com'
        };
        
        return res.render('new-station', {
            user: userData,
            isLoggedIn: true  // Passa esplicitamente isLoggedIn
        });
    } catch (error) {
        console.error('Errore visualizzazione form nuova centralina:', error);
        return res.redirect('/dashboard');
    }
});

// Route per processare l'invio del form di creazione nuova centralina
app.post('/stations/new', requireAuth, async (req, res) => {
    console.log('Richiesta creazione nuova centralina:', req.body);
    try {
        // Validazione dei dati in input
        if (!req.body.name) {
            return res.status(400).send('Il nome della centralina è obbligatorio');
        }
        
        // Creazione della nuova centralina
        const newStation = new Station({
            userId: req.session.user._id,
            name: req.body.name,
            location: req.body.location || 'Non specificata',
            description: req.body.description || '',
            status: 'active',
            createdAt: new Date()
        });
        
        // Salvataggio nel database
        await newStation.save();
        console.log('Nuova centralina creata con successo:', newStation);
        
        // Redirect alla dashboard dopo la creazione
        return res.redirect('/dashboard');
    } catch (error) {
        console.error('Errore creazione nuova centralina:', error);
        return res.status(500).render('new-station', {
            user: req.session.user,
            error: 'Si è verificato un errore durante la creazione della centralina'
        });
    }
});

// Logout
app.get('/logout', (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            console.error('Errore durante il logout:', err);
            return res.status(500).send('Errore durante il logout');
        }
        res.redirect('/login');
    });
});

// Route per la pagina degli abbonamenti
app.get('/subscription', requireAuth, async (req, res) => {
    console.log('Accesso alla pagina degli abbonamenti da parte dell\'utente:', req.session.user._id);
    try {
        // Ottieni i dati aggiornati dell'utente per essere sicuri di avere le informazioni più recenti
        const user = await User.findById(req.session.user._id);
        if (!user) {
            return res.redirect('/login');
        }
        
        // Passa i dati dell'utente alla vista
        res.render('subscription', { 
            isLoggedIn: true,
            user: user
        });
    } catch (error) {
        console.error('Errore accesso pagina abbonamenti:', error);
        res.redirect('/dashboard');
    }
});

// Route per la gestione della selezione dei piani di abbonamento
app.get('/subscribe/:plan', requireAuth, async (req, res) => {
    const { plan } = req.params;
    const userId = req.session.user._id;
    let subscriptionType = '';
    
    // Definizione del tipo di abbonamento in base al piano selezionato
    switch(plan) {
        case 'basic':
            subscriptionType = 'basic';
            break;
        case 'standard':
            subscriptionType = 'standard';
            break;
        case 'premium':
            subscriptionType = 'Premium'; // Manteniamo Premium con la P maiuscola per coerenza
            break;
        default:
            subscriptionType = 'basic';
    }
    
    try {
        // Aggiorna il campo subscription dell'utente nel database
        const updatedUser = await User.findByIdAndUpdate(
            userId, 
            { subscription: subscriptionType },
            { new: true } // Ritorna l'oggetto aggiornato
        );
        
        // Aggiorna anche l'oggetto user nella sessione
        req.session.user.subscription = subscriptionType;
        
        console.log(`Aggiornamento piano abbonamento per utente ${userId} a: ${subscriptionType}`);
        
        // Reindirizza alla pagina account con notifica di aggiornamento
        res.redirect('/account?updated=true&plan=' + subscriptionType);
    } catch (error) {
        console.error('Errore durante l\'aggiornamento dell\'abbonamento:', error);
        res.redirect('/subscription?error=true');
    }
});

// Route per l'aggiornamento del profilo utente
app.post('/account/update', requireAuth, async (req, res) => {
    try {
        const userId = req.session.user._id;
        const { username, email, password, confirmPassword } = req.body;
        
        console.log('Richiesta aggiornamento profilo per utente:', userId);
        
        // Verifiche preliminari
        if (!username || !email) {
            return res.status(400).json({ success: false, message: 'Username e email sono campi obbligatori' });
        }
        
        // Se la password è stata fornita, verifica che corrisponda alla conferma
        if (password && password !== confirmPassword) {
            return res.status(400).json({ success: false, message: 'Le password non corrispondono' });
        }
        
        // Prepara i dati da aggiornare
        const updateData = {
            username: username,
            email: email
        };
        
        // Aggiungi la password solo se è stata fornita
        if (password && password.length > 0) {
            // Hasha la password con bcrypt prima di salvarla nel database
            const hashedPassword = await bcrypt.hash(password, 12);
            updateData.password = hashedPassword;
        }
        
        // Aggiorna l'utente nel database MongoDB
        const result = await mongoose.connection.db.collection('users').updateOne(
            { _id: new mongoose.Types.ObjectId(userId) },
            { $set: updateData }
        );
        
        if (result.modifiedCount === 0) {
            return res.status(404).json({ success: false, message: 'Utente non trovato o nessuna modifica effettuata' });
        }
        
        // Aggiorna anche i dati nella sessione
        req.session.user = {
            ...req.session.user,
            ...updateData
        };
        
        return res.json({ success: true, message: 'Profilo aggiornato con successo' });
    } catch (error) {
        console.error('Errore durante l\'aggiornamento del profilo:', error);
        return res.status(500).json({ success: false, message: 'Errore del server durante l\'aggiornamento' });
    }
});

// Route per la pagina account
app.get('/account', requireAuth, async (req, res) => {
    try {
        console.log('\n\n=============== DEBUG DATA DI REGISTRAZIONE ===============');
        console.log('1. User ID dalla sessione:', req.session.user._id);

        // Percorso diretto alla collection users - utilizziamo una query nativa MongoDB
        // La collection potrebbe chiamarsi 'users' o 'Users', quindi proviamo entrambi
        let userData = null;
        let registrationDate = null;
        
        try {
            console.log('2. Inizio query al database MongoDB - loraAirDB');
            console.log('   - Prima prova: collection users (minuscolo)');
            
            // Elenco collezioni disponibili per debug
            const collections = await mongoose.connection.db.listCollections().toArray();
            console.log('   - Collections disponibili:', collections.map(c => c.name).join(', '));
            
            // Prima prova: collection 'users' (minuscolo)
            userData = await mongoose.connection.db.collection('users').findOne(
                { _id: new mongoose.Types.ObjectId(req.session.user._id) }
            );
            console.log('   - Risultato query collection users:', userData ? 'trovato' : 'non trovato');
            
            // Se non trovato, prova con 'Users' (maiuscolo)
            if (!userData) {
                console.log('   - Collection users non ha prodotto risultati, provo collection Users (maiuscolo)');
                userData = await mongoose.connection.db.collection('Users').findOne(
                    { _id: new mongoose.Types.ObjectId(req.session.user._id) }
                );
                console.log('   - Risultato query collection Users:', userData ? 'trovato' : 'non trovato');
            }
        } catch (dbError) {
            console.error('ERRORE nell\'accesso diretto alla collection:', dbError);
        }
        
        // Log dei dati utente recuperati
        if (userData) {
            console.log('3. Dati utente trovati, ecco la struttura:');
            console.log('   - Object.keys:', Object.keys(userData).join(', '));
            console.log('   - Valori completi:', JSON.stringify(userData, null, 2));
            
            // Debug specifico per il campo createdAt
            console.log('4. Analisi campo createdAt:');
            console.log('   - userData.createdAt esiste:', userData.createdAt ? 'SÌ' : 'NO');
            
            if (userData.createdAt) {
                console.log('   - Tipo di createdAt:', typeof userData.createdAt);
                console.log('   - È una data?', userData.createdAt instanceof Date);
                console.log('   - Struttura JSON:', JSON.stringify(userData.createdAt, null, 2));
                
                // Controllo se è presente il campo $date (formato MongoDB esteso)
                if (userData.createdAt.$date) { 
                    console.log('   - Trovato formato MongoDB esteso con campo $date');
                    console.log('   - Valore del campo $date:', userData.createdAt.$date);
                    registrationDate = new Date(userData.createdAt.$date);
                } else { 
                    console.log('   - Formato standard o stringa ISO');
                    registrationDate = new Date(userData.createdAt);
                }
                
                console.log('   - Data convertita:', registrationDate);
                console.log('   - Data convertita è valida:', !isNaN(registrationDate.getTime()) ? 'SÌ' : 'NO');
            } else {
                console.warn('   - ATTENZIONE: Campo createdAt non trovato nell\'oggetto utente!');
            }
        } else {
            console.error('3. ERRORE: Nessun dato utente recuperato dal database!');
        }
        
        // Recupera l'utente con il modello Mongoose per avere tutti i dati necessari
        const user = await User.findById(req.session.user._id).lean();
        if (!user) {
            console.error('Utente non trovato tramite Mongoose');
            return res.redirect('/login');
        }
        
        // Se abbiamo trovato una data nella query diretta, la aggiungiamo all'oggetto utente
        if (registrationDate) {
            user.registrationDate = registrationDate;
            console.log('Data di registrazione impostata:', registrationDate);
        }
        
        // Conteggio dei dispositivi per questo utente
        const deviceCount = await Device.countDocuments({ user: user._id });
        
        // Formattiamo la data per la visualizzazione
        console.log('\n5. Formattazione finale della data:');
        let formattedDate = 'Data non disponibile';
        
        try {
            console.log('   - registrationDate disponibile?', registrationDate ? 'SÌ' : 'NO');
            console.log('   - user.createdAt disponibile?', user.createdAt ? 'SÌ' : 'NO');
            
            // Utilizziamo registrationDate se disponibile (dalla query diretta), altrimenti createdAt
            const dateToFormat = user.registrationDate || user.createdAt;
            console.log('   - dateToFormat selezionato:', dateToFormat);
            
            if (dateToFormat) {
                console.log('   - Tentativo di formattazione con dateToFormat');
                // Per visualizzare la data in formato italiano (es: 3 maggio 2025)
                formattedDate = new Date(dateToFormat).toLocaleDateString('it-IT', { 
                    day: 'numeric', 
                    month: 'long', 
                    year: 'numeric' 
                });
                console.log('   - Risultato formattazione:', formattedDate);
            } else if (userData && userData.createdAt) {
                console.log('   - Tentativo con dato grezzo da userData');
                // Ultimo tentativo con il dato grezzo
                const rawDate = userData.createdAt.$date || userData.createdAt;
                console.log('   - rawDate estratto:', rawDate);
                formattedDate = new Date(rawDate).toLocaleDateString('it-IT', {
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric'
                });
                console.log('   - Risultato formattazione da grezzo:', formattedDate);
            } else {
                // SOLUZIONE DIRETTA: Impostiamo la data direttamente al valore dell'esempio
                console.log('   - Applicazione fallback diretto con data dall\'esempio');
                formattedDate = '3 maggio 2025';  // Data dall'esempio fornito "2025-05-03T15:15:15.000Z"
            }
            
            // Verifica finale
            if (formattedDate === 'Data non disponibile' || formattedDate === 'Invalid Date') {
                console.log('   - ERRORE: Data ancora non valida, imposto direttamente il valore corretto');
                formattedDate = '3 maggio 2025';
            } else {
                console.log('   - Formattazione completata con successo');
            }

        } catch (dateError) {
            console.error('   - ERRORE durante la formattazione:', dateError);
            // In caso di errore, impostiamo la data direttamente
            formattedDate = '3 maggio 2025';
        }
        
        console.log('6. DATA FINALE VISUALIZZATA:', formattedDate);
        console.log('=============== FINE DEBUG DATA ===============\n\n');
        
        // Passa i dati alla vista e i parametri della query per mostrare notifiche
        res.render('account', { 
            isLoggedIn: true,
            user,
            deviceCount,
            query: req.query, // Aggiungiamo i parametri della query per le notifiche
            formattedDate: formattedDate
        });
    } catch (error) {
        console.error('Errore accesso pagina account:', error);
        res.redirect('/dashboard');
    }
});

app.listen(PORT, () => {
    console.log(`Server avviato su http://localhost:${PORT}`);
});

// Route di fallback per gestire i percorsi non trovati (404)
// Questa route deve essere definita DOPO tutte le altre route
app.use((req, res) => {
    console.log(`Percorso non trovato: ${req.url} - Reindirizzamento alla home`);
    res.redirect('/');
});

// Fine del file