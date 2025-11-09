// sync-manager.js - Gestionnaire de synchronisation corrigé
import { db } from './firebase-config.js';

const SyncManager = {
    deviceId: localStorage.getItem('lunagestio_device_id') || this.generateDeviceId(),
    lastSync: localStorage.getItem('lunagestio_last_sync') || 0,
    isSyncing: false,

    // Générer un ID d'appareil unique
    generateDeviceId: function() {
        const id = 'device_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
        localStorage.setItem('lunagestio_device_id', id);
        return id;
    },

    // Synchroniser les données
    syncData: async function() {
        if (this.isSyncing) {
            console.log('⚠️ Synchronisation déjà en cours...');
            return false;
        }

        if (!this.isOnline()) {
            console.log('⚠️ Pas de connexion internet');
            return false;
        }

        this.isSyncing = true;
        
        try {
            console.log('🔄 Début de la synchronisation...');
            
            // 1. Récupérer les données locales modifiées
            const localChanges = this.getLocalChanges();
            
            // 2. Envoyer les changements locaux au serveur
            if (localChanges.hasChanges) {
                await this.pushChangesToServer(localChanges);
            }
            
            // 3. Récupérer les données du serveur
            const serverData = await this.pullChangesFromServer();
            
            // 4. Fusionner les données
            this.mergeData(serverData);
            
            // 5. Mettre à jour le timestamp de synchronisation
            this.lastSync = Date.now();
            localStorage.setItem('lunagestio_last_sync', this.lastSync.toString());
            
            console.log('✅ Synchronisation terminée avec succès');
            return true;
            
        } catch (error) {
            console.error('❌ Erreur de synchronisation:', error);
            this.showSyncStatus('Erreur de synchronisation: ' + error.message, 'error');
            return false;
        } finally {
            this.isSyncing = false;
        }
    },

    // Récupérer les changements locaux
    getLocalChanges: function() {
        const users = JSON.parse(localStorage.getItem('lunagestio_users') || '[]');
        const appointments = JSON.parse(localStorage.getItem('lunagestio_appointments') || '[]');
        
        // Filtrer seulement les données modifiées depuis la dernière sync
        const changedUsers = users.filter(user => 
            !user.synced || user.updatedAt > this.lastSync
        );
        
        const changedAppointments = appointments.filter(apt => 
            !apt.synced || apt.updatedAt > this.lastSync
        );

        return {
            hasChanges: changedUsers.length > 0 || changedAppointments.length > 0,
            users: changedUsers,
            appointments: changedAppointments,
            deviceId: this.deviceId,
            lastSync: this.lastSync
        };
    },

    // Envoyer les changements au serveur
    pushChangesToServer: async function(changes) {
        try {
            console.log('📤 Envoi des changements au serveur...', changes);
            
            // Envoyer les utilisateurs
            for (const user of changes.users) {
                if (user.id) {
                    await db.collection('users').doc(user.id).set({
                        ...user,
                        deviceId: this.deviceId,
                        updatedAt: new Date(),
                        synced: true
                    }, { merge: true });
                }
            }
            
            // Envoyer les rendez-vous
            for (const appointment of changes.appointments) {
                if (appointment.id) {
                    await db.collection('appointments').doc(appointment.id).set({
                        ...appointment,
                        deviceId: this.deviceId,
                        updatedAt: new Date(),
                        synced: true
                    }, { merge: true });
                } else {
                    // Nouveau rendez-vous
                    const docRef = await db.collection('appointments').add({
                        ...appointment,
                        deviceId: this.deviceId,
                        createdAt: new Date(),
                        updatedAt: new Date(),
                        synced: true
                    });
                    
                    // Mettre à jour l'ID local
                    appointment.id = docRef.id;
                    this.updateLocalAppointmentId(appointment.localId, docRef.id);
                }
            }
            
            console.log('✅ Changements envoyés avec succès');
            
        } catch (error) {
            console.error('❌ Erreur envoi des changements:', error);
            throw error;
        }
    },

    // Récupérer les changements du serveur
    pullChangesFromServer: async function() {
        try {
            console.log('📥 Récupération des données du serveur...');
            
            // Récupérer les utilisateurs
            const usersSnapshot = await db.collection('users')
                .where('updatedAt', '>', new Date(this.lastSync))
                .get();
            
            const serverUsers = [];
            usersSnapshot.forEach(doc => {
                serverUsers.push({ id: doc.id, ...doc.data() });
            });
            
            // Récupérer les rendez-vous
            const appointmentsSnapshot = await db.collection('appointments')
                .where('updatedAt', '>', new Date(this.lastSync))
                .get();
            
            const serverAppointments = [];
            appointmentsSnapshot.forEach(doc => {
                serverAppointments.push({ id: doc.id, ...doc.data() });
            });
            
            console.log(`✅ Données récupérées: ${serverUsers.length} users, ${serverAppointments.length} rdv`);
            
            return {
                users: serverUsers,
                appointments: serverAppointments
            };
            
        } catch (error) {
            console.error('❌ Erreur récupération des données:', error);
            throw error;
        }
    },

    // Fusionner les données
    mergeData: function(serverData) {
        // Fusionner les utilisateurs
        const localUsers = JSON.parse(localStorage.getItem('lunagestio_users') || '[]');
        const mergedUsers = this.mergeArrays(localUsers, serverData.users, 'id');
        localStorage.setItem('lunagestio_users', JSON.stringify(mergedUsers));
        
        // Fusionner les rendez-vous
        const localAppointments = JSON.parse(localStorage.getItem('lunagestio_appointments') || '[]');
        const mergedAppointments = this.mergeArrays(localAppointments, serverData.appointments, 'id');
        localStorage.setItem('lunagestio_appointments', JSON.stringify(mergedAppointments));
        
        console.log('✅ Données fusionnées avec succès');
    },

    // Fusionner deux tableaux en gardant les versions les plus récentes
    mergeArrays: function(localArray, serverArray, idKey) {
        const merged = [...localArray];
        
        serverArray.forEach(serverItem => {
            const existingIndex = merged.findIndex(item => item[idKey] === serverItem[idKey]);
            
            if (existingIndex === -1) {
                // Nouvel élément du serveur
                merged.push(serverItem);
            } else {
                // Conflit: garder la version la plus récente
                const localItem = merged[existingIndex];
                const serverUpdated = new Date(serverItem.updatedAt || 0);
                const localUpdated = new Date(localItem.updatedAt || 0);
                
                if (serverUpdated > localUpdated) {
                    merged[existingIndex] = serverItem;
                }
            }
        });
        
        return merged;
    },

    // Mettre à jour l'ID local d'un rendez-vous
    updateLocalAppointmentId: function(localId, serverId) {
        const appointments = JSON.parse(localStorage.getItem('lunagestio_appointments') || '[]');
        const appointmentIndex = appointments.findIndex(apt => apt.localId === localId);
        
        if (appointmentIndex !== -1) {
            appointments[appointmentIndex].id = serverId;
            localStorage.setItem('lunagestio_appointments', JSON.stringify(appointments));
        }
    },

    // Vérifier la connexion internet
    isOnline: function() {
        return navigator.onLine;
    },

    // Afficher le statut de synchronisation
    showSyncStatus: function(message, type = 'info') {
        // Créer une notification
        const notification = document.createElement('div');
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 1rem;
            border-radius: 8px;
            color: white;
            z-index: 10000;
            max-width: 300px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.3);
            ${type === 'success' ? 'background: #27ae60;' : 
              type === 'error' ? 'background: #e74c3c;' : 
              'background: #3498db;'}
        `;
        notification.textContent = message;
        
        document.body.appendChild(notification);
        
        setTimeout(() => {
            if (notification.parentNode) {
                notification.remove();
            }
        }, 5000);
    },

    // Synchronisation manuelle
    manualSync: async function() {
        this.showSyncStatus('Synchronisation manuelle en cours...', 'info');
        const success = await this.syncData();
        
        if (success) {
            this.showSyncStatus('Synchronisation terminée avec succès!', 'success');
        } else {
            this.showSyncStatus('Échec de la synchronisation', 'error');
        }
    },

    // Initialiser la synchronisation automatique
    initAutoSync: function() {
        // Synchroniser au chargement si en ligne
        window.addEventListener('load', () => {
            if (this.isOnline()) {
                setTimeout(() => this.syncData(), 2000);
            }
        });
        
        // Synchroniser quand la connexion revient
        window.addEventListener('online', () => {
            this.showSyncStatus('Connexion rétablie - Synchronisation...', 'info');
            setTimeout(() => this.syncData(), 1000);
        });
        
        // Synchroniser toutes les 2 minutes
        setInterval(() => {
            if (this.isOnline() && !this.isSyncing) {
                this.syncData();
            }
        }, 2 * 60 * 1000);
        
        // Synchroniser avant de quitter la page
        window.addEventListener('beforeunload', () => {
            if (this.isOnline() && !this.isSyncing) {
                // Sync rapide avant fermeture
                navigator.sendBeacon && this.quickSync();
            }
        });
    },

    // Synchronisation rapide
    quickSync: async function() {
        try {
            const changes = this.getLocalChanges();
            if (changes.hasChanges) {
                await this.pushChangesToServer(changes);
            }
        } catch (error) {
            console.error('Quick sync error:', error);
        }
    }
};

export default SyncManager;
