const mongoose = require('mongoose');

// Schema per gli utenti - COMPLETAMENTE NUOVO E SEMPLIFICATO
const userSchema = new mongoose.Schema({
    username: String,
    email: String,
    password: String
});

// Usiamo un nome diverso per evitare conflitti
module.exports = mongoose.model('UserNew', userSchema);
