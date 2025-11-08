// sync-manager.js - Gestionnaire de synchronisation des données
const SyncManager = {
    // Clé pour identifier l'appareil
    deviceId: localStorage.getItem('lunagestio_device_id') || generateDeviceId(),
    
    // URL de base pour l'API (à adapter selon votre hébergement)
    apiBaseUrl: 'https://votre-serveur.com/api',
    
    // Générer un ID d'appareil unique
    generateDeviceId: function() {
        const id = 'device_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
        localStorage.setItem('lunagestio_device_id', id);
        return id;
    },
    
    // Synchroniser les données
    syncData: async function() {
        try {
            // Récupérer les données locales
            const localData = this.getLocalData();
            
            // Envoyer les données au serveur
            const response = await this.sendToServer(localData);
            
            // Mettre à jour les données locales avec celles du serveur
            if (response && response.success) {
                this.updateLocalData(response.data);
            }
            
            return true;
        } catch (error) {
            console.error('Erreur de synchronisation:', error);
            return false;
        }
    },
    
    // Récupérer toutes les données locales
    getLocalData: function() {
        return {
            deviceId: this.deviceId,
            users: JSON.parse(localStorage.getItem('lunagestio_users') || '[]'),
            appointments: JSON.parse(localStorage.getItem('lunagestio_appointments') || '[]'),
            lastSync: localStorage.getItem('lunagestio_last_sync') || 0
        };
    },
    
    // Envoyer les données au serveur
    sendToServer: async function(data) {
        // Simulation d'envoi - À REMPLACER par votre API réelle
        console.log('Envoi des données au serveur:', data);
        
        // Pour le moment, on simule une réponse réussie
        return new Promise((resolve) => {
            setTimeout(() => {
                resolve({
                    success: true,
                    data: data // En production, le serveur renverrait les données fusionnées
                });
            }, 1000);
        });
        
        /* 
        // CODE RÉEL POUR PRODUCTION :
        try {
            const response = await fetch(`${this.apiBaseUrl}/sync`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(data)
            });
            
            return await response.json();
        } catch (error) {
            throw new Error('Erreur réseau: ' + error.message);
        }
        */
    },
    
    // Mettre à jour les données locales
    updateLocalData: function(serverData) {
        if (serverData.users) {
            localStorage.setItem('lunagestio_users', JSON.stringify(serverData.users));
        }
        if (serverData.appointments) {
            localStorage.setItem('lunagestio_appointments', JSON.stringify(serverData.appointments));
        }
        
        localStorage.setItem('lunagestio_last_sync', Date.now().toString());
    },
    
    // Vérifier la connexion internet
    isOnline: function() {
        return navigator.onLine;
    },
    
    // Initialiser la synchronisation automatique
    initAutoSync: function() {
        // Synchroniser au chargement de la page
        window.addEventListener('load', () => {
            if (this.isOnline()) {
                this.syncData();
            }
        });
        
        // Synchroniser quand la connexion revient
        window.addEventListener('online', () => {
            this.syncData();
        });
        
        // Synchroniser toutes les 5 minutes
        setInterval(() => {
            if (this.isOnline()) {
                this.syncData();
            }
        }, 5 * 60 * 1000);
    }
};
