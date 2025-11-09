// sync-manager.js - Gestionnaire de synchronisation corrigé
class SyncManager {
    constructor() {
        this.deviceId = localStorage.getItem('lunagestio_device_id') || this.generateDeviceId();
        this.lastSync = parseInt(localStorage.getItem('lunagestio_last_sync') || '0');
        this.isSyncing = false;
        this.init();
    }

    // Générer un ID d'appareil unique
    generateDeviceId() {
        const id = 'device_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
        localStorage.setItem('lunagestio_device_id', id);
        return id;
    }

    async init() {
        // Charger Firebase dynamiquement
        await this.loadFirebase();
        this.initAutoSync();
    }

    async loadFirebase() {
        if (typeof firebase === 'undefined') {
            await import('./firebase-config.js');
        }
    }

    // Synchroniser les données
    async syncData() {
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
            
            // 1. Récupérer les données locales
            const localData = this.getLocalData();
            
            // 2. Envoyer les données au serveur
            await this.pushToServer(localData);
            
            // 3. Récupérer les données du serveur
            const serverData = await this.pullFromServer();
            
            // 4. Fusionner les données
            this.mergeData(serverData);
            
            // 5. Mettre à jour le timestamp
            this.lastSync = Date.now();
            localStorage.setItem('lunagestio_last_sync', this.lastSync.toString());
            
            console.log('✅ Synchronisation terminée avec succès');
            this.showSyncStatus('Synchronisation réussie!', 'success');
            return true;
            
        } catch (error) {
            console.error('❌ Erreur de synchronisation:', error);
            this.showSyncStatus('Erreur de synchronisation', 'error');
            return false;
        } finally {
            this.isSyncing = false;
        }
    }

    // Récupérer toutes les données locales
    getLocalData() {
        return {
            deviceId: this.deviceId,
            users: JSON.parse(localStorage.getItem('lunagestio_users') || '[]'),
            appointments: JSON.parse(localStorage.getItem('lunagestio_appointments') || '[]'),
            lastSync: this.lastSync
        };
    }

    // Envoyer les données au serveur
    async pushToServer(localData) {
        try {
            const { doc, setDoc, collection, addDoc, serverTimestamp } = await import('https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js');
            
            console.log('📤 Envoi des données au serveur...');

            // Synchroniser les utilisateurs
            for (const user of localData.users) {
                if (user.id && user.id.startsWith('local_')) {
                    // Nouvel utilisateur local - créer sur le serveur
                    const userData = { ...user };
                    delete userData.id;
                    
                    const docRef = await addDoc(collection(window.db, "users"), {
                        ...userData,
                        deviceId: this.deviceId,
                        createdAt: serverTimestamp(),
                        updatedAt: serverTimestamp()
                    });
                    
                    // Mettre à jour l'ID local
                    user.id = docRef.id;
                } else if (user.id) {
                    // Utilisateur existant - mettre à jour
                    await setDoc(doc(window.db, "users", user.id), {
                        ...user,
                        deviceId: this.deviceId,
                        updatedAt: serverTimestamp()
                    }, { merge: true });
                }
            }

            // Synchroniser les rendez-vous
            for (const appointment of localData.appointments) {
                if (appointment.id && appointment.id.startsWith('local_')) {
                    // Nouveau rendez-vous local
                    const aptData = { ...appointment };
                    delete aptData.id;
                    
                    const docRef = await addDoc(collection(window.db, "appointments"), {
                        ...aptData,
                        deviceId: this.deviceId,
                        createdAt: serverTimestamp(),
                        updatedAt: serverTimestamp()
                    });
                    
                    appointment.id = docRef.id;
                } else if (appointment.id) {
                    // Rendez-vous existant
                    await setDoc(doc(window.db, "appointments", appointment.id), {
                        ...appointment,
                        deviceId: this.deviceId,
                        updatedAt: serverTimestamp()
                    }, { merge: true });
                }
            }

            console.log('✅ Données envoyées avec succès');
            
        } catch (error) {
            console.error('❌ Erreur envoi des données:', error);
            throw error;
        }
    }

    // Récupérer les données du serveur
    async pullFromServer() {
        try {
            const { collection, getDocs, query, where, orderBy } = await import('https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js');
            
            console.log('📥 Récupération des données du serveur...');

            // Récupérer les utilisateurs
            const usersQuery = query(collection(window.db, "users"));
            const usersSnapshot = await getDocs(usersQuery);
            const serverUsers = [];
            usersSnapshot.forEach(doc => {
                serverUsers.push({ id: doc.id, ...doc.data() });
            });

            // Récupérer les rendez-vous
            const appointmentsQuery = query(
                collection(window.db, "appointments"),
                orderBy("updatedAt", "desc")
            );
            const appointmentsSnapshot = await getDocs(appointmentsQuery);
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
    }

    // Fusionner les données
    mergeData(serverData) {
        // Fusionner les utilisateurs
        const localUsers = JSON.parse(localStorage.getItem('lunagestio_users') || '[]');
        const mergedUsers = this.mergeArrays(localUsers, serverData.users, 'id');
        localStorage.setItem('lunagestio_users', JSON.stringify(mergedUsers));
        
        // Fusionner les rendez-vous
        const localAppointments = JSON.parse(localStorage.getItem('lunagestio_appointments') || '[]');
        const mergedAppointments = this.mergeArrays(localAppointments, serverData.appointments, 'id');
        localStorage.setItem('lunagestio_appointments', JSON.stringify(mergedAppointments));
        
        console.log('✅ Données fusionnées avec succès');
    }

    // Fusionner deux tableaux
    mergeArrays(localArray, serverArray, idKey) {
        const merged = [...localArray];
        const serverMap = new Map();
        
        // Créer une map des éléments serveur
        serverArray.forEach(item => {
            serverMap.set(item[idKey], item);
        });
        
        // Mettre à jour ou ajouter les éléments serveur
        serverArray.forEach(serverItem => {
            const existingIndex = merged.findIndex(item => item[idKey] === serverItem[idKey]);
            
            if (existingIndex === -1) {
                // Nouvel élément du serveur
                merged.push(serverItem);
            } else {
                // Remplacer par la version serveur (plus récente)
                merged[existingIndex] = serverItem;
            }
        });
        
        // Garder les éléments locaux qui n'existent pas sur le serveur
        localArray.forEach(localItem => {
            if (!serverMap.has(localItem[idKey]) && localItem.id && localItem.id.startsWith('local_')) {
                // C'est un nouvel élément local pas encore synchronisé
                const exists = merged.find(item => item[idKey] === localItem[idKey]);
                if (!exists) {
                    merged.push(localItem);
                }
            }
        });
        
        return merged;
    }

    // Vérifier la connexion internet
    isOnline() {
        return navigator.onLine;
    }

    // Afficher le statut de synchronisation
    showSyncStatus(message, type = 'info') {
        // Créer une notification
        const notification = document.createElement('div');
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 1rem 1.5rem;
            border-radius: 8px;
            color: white;
            z-index: 10000;
            max-width: 300px;
            font-weight: bold;
            box-shadow: 0 4px 12px rgba(0,0,0,0.3);
            ${type === 'success' ? 'background: #27ae60;' : 
              type === 'error' ? 'background: #e74c3c;' : 
              'background: #3498db;'}
        `;
        notification.innerHTML = `
            <i class="fas fa-${type === 'success' ? 'check' : type === 'error' ? 'exclamation-triangle' : 'info-circle'}"></i>
            ${message}
        `;
        
        document.body.appendChild(notification);
        
        setTimeout(() => {
            if (notification.parentNode) {
                notification.remove();
            }
        }, 4000);
    }

    // Synchronisation manuelle
    async manualSync() {
        this.showSyncStatus('Synchronisation en cours...', 'info');
        const success = await this.syncData();
        return success;
    }

    // Initialiser la synchronisation automatique
    initAutoSync() {
        // Synchroniser au chargement si en ligne
        window.addEventListener('load', () => {
            if (this.isOnline()) {
                setTimeout(() => this.syncData(), 3000);
            }
        });
        
        // Synchroniser quand la connexion revient
        window.addEventListener('online', () => {
            this.showSyncStatus('Connexion rétablie - Synchronisation...', 'info');
            setTimeout(() => this.syncData(), 1000);
        });
        
        // Afficher le statut hors ligne
        window.addEventListener('offline', () => {
            this.showSyncStatus('Hors ligne - Mode local activé', 'error');
        });
        
        // Synchroniser toutes les 2 minutes
        setInterval(() => {
            if (this.isOnline() && !this.isSyncing) {
                this.syncData();
            }
        }, 2 * 60 * 1000);
    }

    // Synchronisation rapide avant déconnexion
    async quickSync() {
        if (!this.isOnline() || this.isSyncing) return false;
        
        try {
            const localData = this.getLocalData();
            await this.pushToServer(localData);
            return true;
        } catch (error) {
            console.error('Quick sync error:', error);
            return false;
        }
    }
}

// Créer une instance globale
const syncManager = new SyncManager();
window.SyncManager = syncManager;
export default syncManager;
