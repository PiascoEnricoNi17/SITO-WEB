const { Device } = require('../models/models');

/**
 * Ottiene il conteggio dei dispositivi associati ad un utente
 * @param {string} userId - ID dell'utente
 * @returns {Promise<number>} - Numero di dispositivi associati all'utente
 */
const getUserDeviceCount = async (userId) => {
    try {
        if (!userId) {
            console.error('getUserDeviceCount: userId non valido');
            return 0;
        }
        
        // Conta i dispositivi associati all'utente
        const count = await Device.countDocuments({ user: userId });
        console.log(`Trovati ${count} dispositivi per l'utente ${userId}`);
        return count;
    } catch (error) {
        console.error('Errore nel conteggio dispositivi:', error);
        return 0; // In caso di errore, restituisci 0
    }
};

module.exports = {
    getUserDeviceCount
};
