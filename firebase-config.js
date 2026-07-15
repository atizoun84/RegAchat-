// firebase-config.js
// Centralisation de Firebase pour l'application AgriAchat
// Version 1.0

(function() {
    'use strict';

    // ============================================================
    // 1. CONFIGURATION FIREBASE
    // ============================================================

    const firebaseConfig = {
        apiKey: "AIzaSyAsmRMJCtxsOkf3rCylpuTCcm4pnObvRK0",
        authDomain: "regachat-ad0e9.firebaseapp.com",
        projectId: "regachat-ad0e9",
        storageBucket: "regachat-ad0e9.firebasestorage.app",
        messagingSenderId: "809503223361",
        appId: "1:809503223361:web:bbcf81fea1a6afdd86e0c0"
    };

    const DB_URL = "https://regachat-ad0e9-default-rtdb.europe-west1.firebasedatabase.app/";

    // ============================================================
    // 2. CHARGEMENT DYNAMIQUE DE FIREBASE (via CDN)
    // ============================================================

    // Charger Firebase App et Database si non déjà chargés
    function loadFirebaseSDK() {
        return new Promise((resolve, reject) => {
            // Vérifier si Firebase est déjà chargé
            if (typeof firebase !== 'undefined' && firebase.initializeApp) {
                resolve(firebase);
                return;
            }

            // Vérifier si le script est déjà présent
            const existingScript = document.querySelector('script[src*="firebase-app.js"]');
            if (existingScript) {
                // Attendre que Firebase soit disponible
                const checkReady = setInterval(() => {
                    if (typeof firebase !== 'undefined' && firebase.initializeApp) {
                        clearInterval(checkReady);
                        resolve(firebase);
                    }
                }, 100);
                return;
            }

            // Charger les scripts Firebase
            const scripts = [
                'https://www.gstatic.com/firebasejs/12.16.0/firebase-app.js',
                'https://www.gstatic.com/firebasejs/12.16.0/firebase-database.js'
            ];

            let loaded = 0;
            const onLoad = () => {
                loaded++;
                if (loaded === scripts.length) {
                    if (typeof firebase !== 'undefined' && firebase.initializeApp) {
                        resolve(firebase);
                    } else {
                        reject(new Error('Firebase SDK chargé mais non disponible'));
                    }
                }
            };

            scripts.forEach(src => {
                const script = document.createElement('script');
                script.src = src;
                script.type = 'module';
                script.onload = onLoad;
                script.onerror = () => reject(new Error(`Impossible de charger ${src}`));
                document.head.appendChild(script);
            });
        });
    }

    // ============================================================
    // 3. INITIALISATION
    // ============================================================

    let app = null;
    let database = null;
    let dbRef = null;
    let connectedRef = null;
    let _initialized = false;
    let _initPromise = null;
    let _onError = null;

    // Nom des collections (à adapter selon la structure de données)
    const COLLECTIONS = {
        USERS: 'users',
        COMMANDITAIRES: 'commanditaires',
        PRODUITS: 'produits',
        MESURES: 'mesures',
        COMMISSIONS: 'commissions',
        ACHATS: 'achats',
        APPROVISIONNEMENTS: 'approvisionnements',
        LIVRAISONS: 'livraisons',
        STOCKS: 'stocks'
    };

    function initializeFirebase() {
        if (_initPromise) return _initPromise;

        _initPromise = new Promise((resolve, reject) => {
            loadFirebaseSDK()
                .then((firebase) => {
                    // Initialiser l'app
                    app = firebase.initializeApp(firebaseConfig);
                    
                    // Initialiser la base de données
                    database = firebase.database(app);
                    
                    // Référence racine
                    dbRef = database.ref('/');
                    
                    // Référence de connexion
                    connectedRef = database.ref('.info/connected');

                    // Activer la persistance
                    return database.goOnline().then(() => {
                        return database.ref('/').transaction(() => {});
                    }).catch(() => {});
                })
                .then(() => {
                    // Activer la persistance hors-ligne
                    if (database) {
                        return database.enablePersistence({ 
                            synchronizeTabs: true 
                        }).catch((err) => {
                            if (err.code === 'failed-precondition') {
                                // Multi-tabs ou autre condition
                                console.warn('Firebase: Persistence non activée (multi-onglets ?)', err);
                            } else if (err.code === 'unimplemented') {
                                console.warn('Firebase: Persistence non supportée par le navigateur');
                            } else {
                                console.warn('Firebase: Erreur persistence', err);
                            }
                            // Continuer même sans persistance
                        });
                    }
                })
                .then(() => {
                    _initialized = true;
                    console.log('✅ Firebase initialisé avec succès');
                    resolve({ app, database, dbRef, connectedRef });
                })
                .catch((err) => {
                    console.error('❌ Erreur d\'initialisation Firebase:', err);
                    reject(err);
                });
        });

        return _initPromise;
    }

    // Fonction d'attente de l'initialisation
    function waitForFirebase() {
        if (_initialized && app && database) {
            return Promise.resolve({ app, database, dbRef, connectedRef });
        }
        return initializeFirebase();
    }

    // ============================================================
    // 4. RÉFÉRENCES DES COLLECTIONS
    // ============================================================

    function getDbRef() {
        if (!dbRef) throw new Error('Firebase non initialisé');
        return dbRef;
    }

    function getRef(path) {
        if (!dbRef) throw new Error('Firebase non initialisé');
        return dbRef.child(path);
    }

    function getCollectionRef(collectionName) {
        return getRef(collectionName);
    }

    // ============================================================
    // 5. FONCTIONS CRUD GÉNÉRIQUES
    // ============================================================

    /**
     * Crée une nouvelle entrée dans la base
     * @param {string} path - Chemin dans la base (ex: 'users')
     * @param {object} data - Données à enregistrer
     * @returns {Promise<string>} - ID de l'entrée créée
     */
    function createData(path, data) {
        return waitForFirebase()
            .then(() => {
                const ref = getRef(path);
                const newRef = ref.push();
                return newRef.set(data)
                    .then(() => newRef.key);
            })
            .catch((err) => {
                console.error(`❌ Erreur createData (${path}):`, err);
                if (_onError) _onError(err, 'create', path);
                throw err;
            });
    }

    /**
     * Lit les données d'un chemin
     * @param {string} path - Chemin dans la base
     * @returns {Promise<object>} - Données lues
     */
    function readData(path) {
        return waitForFirebase()
            .then(() => {
                const ref = getRef(path);
                return ref.once('value')
                    .then(snapshot => snapshot.val());
            })
            .catch((err) => {
                console.error(`❌ Erreur readData (${path}):`, err);
                if (_onError) _onError(err, 'read', path);
                throw err;
            });
    }

    /**
     * Lit les données une fois (alias de readData)
     */
    function readDataOnce(path) {
        return readData(path);
    }

    /**
     * Met à jour des données existantes
     * @param {string} path - Chemin dans la base
     * @param {object} data - Données à mettre à jour
     * @returns {Promise<void>}
     */
    function updateData(path, data) {
        return waitForFirebase()
            .then(() => {
                const ref = getRef(path);
                return ref.update(data);
            })
            .catch((err) => {
                console.error(`❌ Erreur updateData (${path}):`, err);
                if (_onError) _onError(err, 'update', path);
                throw err;
            });
    }

    /**
     * Supprime des données
     * @param {string} path - Chemin dans la base
     * @returns {Promise<void>}
     */
    function deleteData(path) {
        return waitForFirebase()
            .then(() => {
                const ref = getRef(path);
                return ref.remove();
            })
            .catch((err) => {
                console.error(`❌ Erreur deleteData (${path}):`, err);
                if (_onError) _onError(err, 'delete', path);
                throw err;
            });
    }

    /**
     * Écoute en temps réel un chemin
     * @param {string} path - Chemin dans la base
     * @param {function} callback - Fonction appelée à chaque changement
     * @returns {function} - Fonction pour se désabonner
     */
    function watchData(path, callback) {
        waitForFirebase()
            .then(() => {
                const ref = getRef(path);
                ref.on('value', (snapshot) => {
                    try {
                        callback(snapshot.val(), snapshot);
                    } catch (err) {
                        console.error(`❌ Erreur dans watchData (${path}):`, err);
                        if (_onError) _onError(err, 'watch', path);
                    }
                }, (err) => {
                    console.error(`❌ Erreur watchData (${path}):`, err);
                    if (_onError) _onError(err, 'watch', path);
                });
            })
            .catch((err) => {
                console.error(`❌ Erreur watchData (${path}):`, err);
                if (_onError) _onError(err, 'watch', path);
            });

        // Retourner la fonction d'unsubscribe
        return () => {
            try {
                const ref = getRef(path);
                ref.off();
            } catch (e) {
                console.warn('Unsubscribe: Firebase non initialisé');
            }
        };
    }

    /**
     * Exécute une transaction sur un chemin
     * @param {string} path - Chemin dans la base
     * @param {function} callback - Fonction de transaction
     * @returns {Promise<object>} - Résultat de la transaction
     */
    function transactionData(path, callback) {
        return waitForFirebase()
            .then(() => {
                const ref = getRef(path);
                return ref.transaction(callback);
            })
            .catch((err) => {
                console.error(`❌ Erreur transactionData (${path}):`, err);
                if (_onError) _onError(err, 'transaction', path);
                throw err;
            });
    }

    /**
     * Fonction utilitaire pour récupérer les données d'une collection
     * @param {string} collection - Nom de la collection
     * @returns {Promise<object>} - Objet avec les IDs comme clés
     */
    function getCollection(collection) {
        return readData(collection);
    }

    /**
     * Fonction utilitaire pour récupérer les données d'une collection sous forme de tableau
     * @param {string} collection - Nom de la collection
     * @returns {Promise<array>} - Tableau des données avec leurs IDs
     */
    function getCollectionAsArray(collection) {
        return readData(collection)
            .then(data => {
                if (!data) return [];
                return Object.keys(data).map(key => ({
                    id: key,
                    ...data[key]
                }));
            });
    }

    // ============================================================
    // 6. TOAST DE CONNEXION PERMANENT
    // ============================================================

    let connectionToastElement = null;
    let connectionStatus = 'online';
    let pendingOperations = 0;

    function createConnectionToast(containerSelector = '.navbar-nav') {
        // Vérifier si le toast existe déjà
        if (document.getElementById('toast-connection')) {
            return document.getElementById('toast-connection');
        }

        // Styles CSS
        const style = document.createElement('style');
        style.textContent = `
            .toast-connection {
                display: flex;
                align-items: center;
                gap: 8px;
                padding: 6px 14px;
                border-radius: 20px;
                font-size: 0.8rem;
                font-weight: 600;
                transition: all 0.4s cubic-bezier(0.25, 0.46, 0.45, 0.94);
                cursor: default;
                user-select: none;
                margin: 0 4px;
                position: relative;
            }
            .toast-connection .status-icon {
                font-size: 1rem;
                transition: transform 0.3s ease;
            }
            .toast-connection .status-text {
                white-space: nowrap;
            }
            .toast-connection .badge-pending {
                background: rgba(255,255,255,0.3);
                color: inherit;
                border-radius: 12px;
                padding: 0 8px;
                font-size: 0.7rem;
                font-weight: 700;
                margin-left: 4px;
            }
            .toast-online {
                background: #d4edda;
                color: #155724;
                border: 1px solid #c3e6cb;
            }
            .toast-offline {
                background: #f8d7da;
                color: #721c24;
                border: 1px solid #f5c6cb;
            }
            .toast-reconnecting {
                animation: pulse-reconnect 1.2s infinite;
            }
            .toast-connection .status-icon {
                display: inline-block;
            }
            .toast-connection .status-icon.online { color: #28a745; }
            .toast-connection .status-icon.offline { color: #dc3545; }
            
            @keyframes pulse-reconnect {
                0%, 100% { transform: scale(1); opacity: 1; }
                50% { transform: scale(1.04); opacity: 0.7; }
            }
            @keyframes slideInDown {
                from { opacity: 0; transform: translateY(-10px) scale(0.95); }
                to { opacity: 1; transform: translateY(0) scale(1); }
            }
            .toast-connection {
                animation: slideInDown 0.3s ease forwards;
            }
        `;
        document.head.appendChild(style);

        // Trouver le conteneur
        const container = document.querySelector(containerSelector);
        if (!container) {
            console.warn(`⚠️ Conteneur "${containerSelector}" non trouvé pour le toast`);
            // Fallback: le mettre dans la navbar
            const navbar = document.querySelector('.navbar-collapse .ms-auto');
            if (navbar) {
                return createToastElement(navbar);
            }
            return createToastElement(document.body);
        }

        return createToastElement(container);
    }

    function createToastElement(container) {
        const toast = document.createElement('div');
        toast.id = 'toast-connection';
        toast.className = 'toast-connection toast-online';
        toast.setAttribute('role', 'status');
        toast.setAttribute('aria-live', 'polite');
        
        toast.innerHTML = `
            <span class="status-icon online" aria-hidden="true">
                <i class="bi bi-wifi"></i>
            </span>
            <span class="status-text">En ligne</span>
            <span class="badge-pending" id="pendingCount" style="display:none;">0</span>
        `;

        container.prepend(toast);
        connectionToastElement = toast;
        
        // Mettre à jour via Firebase
        updateConnectionStatus();

        return toast;
    }

    function updateConnectionStatus() {
        if (!connectedRef) {
            waitForFirebase().then(() => {
                setupConnectionListener();
            }).catch(() => {
                // Fallback: utiliser les événements browser
                setupBrowserConnectionListener();
            });
        } else {
            setupConnectionListener();
        }
    }

    function setupConnectionListener() {
        connectedRef.on('value', (snap) => {
            const isConnected = snap.val();
            updateToastStatus(isConnected);
        });
    }

    function setupBrowserConnectionListener() {
        const update = () => {
            updateToastStatus(navigator.onLine);
        };
        window.addEventListener('online', update);
        window.addEventListener('offline', update);
        update();
    }

    function updateToastStatus(isConnected) {
        const toast = connectionToastElement || document.getElementById('toast-connection');
        if (!toast) return;

        const icon = toast.querySelector('.status-icon');
        const text = toast.querySelector('.status-text');
        
        // Supprimer les classes existantes
        toast.classList.remove('toast-online', 'toast-offline', 'toast-reconnecting');
        if (icon) {
            icon.classList.remove('online', 'offline');
        }

        if (isConnected) {
            connectionStatus = 'online';
            toast.classList.add('toast-online');
            toast.setAttribute('data-status', 'online');
            if (icon) {
                icon.classList.add('online');
                icon.innerHTML = '<i class="bi bi-wifi"></i>';
            }
            if (text) text.textContent = 'En ligne';
            
            // Vider le compteur si reconnecté
            const pendingCount = toast.querySelector('#pendingCount');
            if (pendingCount) {
                pendingCount.style.display = 'none';
                pendingCount.textContent = '0';
            }
            
            // Essayer de vider la queue
            if (typeof processQueue === 'function') {
                processQueue();
            }
        } else {
            connectionStatus = 'offline';
            toast.classList.add('toast-offline', 'toast-reconnecting');
            toast.setAttribute('data-status', 'offline');
            if (icon) {
                icon.classList.add('offline');
                icon.innerHTML = '<i class="bi bi-wifi-off"></i>';
            }
            if (text) text.textContent = 'Hors ligne';
            
            // Afficher le compteur
            const pendingCount = toast.querySelector('#pendingCount');
            if (pendingCount) {
                const count = getPendingCount();
                if (count > 0) {
                    pendingCount.style.display = 'inline';
                    pendingCount.textContent = count;
                } else {
                    pendingCount.style.display = 'none';
                }
            }
        }
    }

    function updatePendingCount() {
        const count = getPendingCount();
        const toast = connectionToastElement || document.getElementById('toast-connection');
        if (toast) {
            const pendingCount = toast.querySelector('#pendingCount');
            if (pendingCount) {
                if (count > 0) {
                    pendingCount.style.display = 'inline';
                    pendingCount.textContent = count;
                } else {
                    pendingCount.style.display = 'none';
                }
            }
        }
    }

    function getPendingCount() {
        try {
            const queue = JSON.parse(localStorage.getItem('firebase_sync_queue') || '[]');
            return queue.length;
        } catch (e) {
            return 0;
        }
    }

    // ============================================================
    // 7. FILE D'ATTENTE HORS-LIGNE (SyncQueue)
    // ============================================================

    class SyncQueue {
        constructor() {
            this.queueKey = 'firebase_sync_queue';
            this.processing = false;
            this.maxRetries = 5;
            this.backoffDelay = 1000;
            this.listeners = [];
            this._loaded = false;
            
            // Écouter les événements de connexion
            this.setupListeners();
            
            // Charger et traiter au démarrage
            this.load().then(() => {
                if (navigator.onLine) {
                    this.process();
                }
            });
        }

        setupListeners() {
            const onOnline = () => {
                console.log('📶 Connexion rétablie, traitement de la queue...');
                this.process();
            };
            
            const onOffline = () => {
                console.log('📶 Déconnexion détectée');
            };
            
            window.addEventListener('online', onOnline);
            window.addEventListener('offline', onOffline);
            
            // Si Firebase est initialisé, écouter connectedRef
            waitForFirebase().then(() => {
                if (connectedRef) {
                    connectedRef.on('value', (snap) => {
                        if (snap.val() === true) {
                            console.log('📶 Firebase reconnecté, traitement de la queue...');
                            this.process();
                        }
                    });
                }
            }).catch(() => {});
        }

        /**
         * Ajoute une opération à la queue
         * @param {string} path - Chemin Firebase
         * @param {string} operation - 'set', 'update', 'push', 'delete'
         * @param {object} data - Données (pour set, update, push)
         * @param {object} options - Options supplémentaires
         * @returns {Promise<string>} - ID de l'opération
         */
        add(path, operation, data = null, options = {}) {
            const id = Date.now().toString() + '_' + Math.random().toString(36).substr(2, 6);
            
            const queue = this.getQueue();
            queue.push({
                id,
                path,
                operation,
                data,
                options,
                retries: 0,
                timestamp: Date.now(),
                created: new Date().toISOString()
            });
            
            this.saveQueue(queue);
            this.notifyListeners(queue.length);
            updatePendingCount();
            
            // Si en ligne, traiter immédiatement
            if (navigator.onLine) {
                setTimeout(() => this.process(), 100);
            }
            
            return Promise.resolve(id);
        }

        /**
         * Traite toutes les opérations en attente
         * @returns {Promise<void>}
         */
        async process() {
            if (this.processing) return;
            if (!navigator.onLine) {
                console.log('📶 Hors ligne, traitement différé');
                return;
            }
            
            // Vérifier que Firebase est prêt
            try {
                await waitForFirebase();
            } catch (e) {
                console.warn('Firebase non prêt, réessayer plus tard');
                return;
            }

            this.processing = true;
            const queue = this.getQueue();
            
            if (queue.length === 0) {
                this.processing = false;
                return;
            }

            console.log(`🔄 Traitement de la queue (${queue.length} opérations)...`);
            
            let processed = 0;
            const remaining = [];
            
            for (const item of queue) {
                try {
                    const success = await this.processItem(item);
                    if (success) {
                        processed++;
                        console.log(`✅ Opération ${item.id} traitée`);
                    } else {
                        item.retries = (item.retries || 0) + 1;
                        if (item.retries < this.maxRetries) {
                            remaining.push(item);
                        } else {
                            console.warn(`⚠️ Opération ${item.id} abandonnée après ${item.retries} tentatives`);
                        }
                    }
                } catch (err) {
                    console.error(`❌ Erreur sur ${item.id}:`, err);
                    item.retries = (item.retries || 0) + 1;
                    if (item.retries < this.maxRetries) {
                        remaining.push(item);
                    } else {
                        console.warn(`⚠️ Opération ${item.id} abandonnée après ${item.retries} tentatives`);
                    }
                }
            }
            
            // Sauvegarder les opérations restantes
            this.saveQueue(remaining);
            this.notifyListeners(remaining.length);
            updatePendingCount();
            
            this.processing = false;
            
            if (remaining.length > 0 && navigator.onLine) {
                // Tentative avec backoff
                const delay = Math.min(this.backoffDelay * Math.pow(1.5, 1), 10000);
                console.log(`🔄 Nouvelle tentative dans ${delay}ms (${remaining.length} opérations)`);
                setTimeout(() => {
                    if (navigator.onLine) {
                        this.process();
                    }
                }, delay);
            } else if (remaining.length === 0) {
                console.log('✅ Queue vidée');
            }
            
            return;
        }

        /**
         * Traite un élément individuel
         */
        async processItem(item) {
            try {
                const { path, operation, data } = item;
                const ref = getRef(path);
                
                switch (operation) {
                    case 'set':
                        await ref.set(data);
                        return true;
                    case 'update':
                        await ref.update(data);
                        return true;
                    case 'push':
                        await ref.push(data);
                        return true;
                    case 'delete':
                        await ref.remove();
                        return true;
                    default:
                        console.warn(`Opération inconnue: ${operation}`);
                        return false;
                }
            } catch (err) {
                // Si erreur due à la connexion, ne pas compter comme échec définitif
                if (err.code === 'PERMISSION_DENIED' || err.code === 'UNAUTHORIZED') {
                    throw err;
                }
                // Si erreur réseau, on réessaye plus tard
                if (err.message && (err.message.includes('network') || err.message.includes('offline'))) {
                    return false;
                }
                throw err;
            }
        }

        /**
         * Récupère la queue depuis localStorage
         */
        getQueue() {
            try {
                const data = localStorage.getItem(this.queueKey);
                return data ? JSON.parse(data) : [];
            } catch (e) {
                return [];
            }
        }

        /**
         * Sauvegarde la queue dans localStorage
         */
        saveQueue(queue) {
            try {
                localStorage.setItem(this.queueKey, JSON.stringify(queue));
            } catch (e) {
                console.warn('Impossible de sauvegarder la queue:', e);
            }
        }

        /**
         * Charge la queue (alias)
         */
        load() {
            return Promise.resolve(this.getQueue());
        }

        /**
         * Vide la queue
         */
        clear() {
            this.saveQueue([]);
            this.notifyListeners(0);
            updatePendingCount();
        }

        /**
         * Ajoute un écouteur sur la queue
         */
        onUpdate(callback) {
            this.listeners.push(callback);
            // Appeler immédiatement avec l'état actuel
            callback(this.getQueue().length);
        }

        /**
         * Notifie les écouteurs
         */
        notifyListeners(count) {
            this.listeners.forEach(cb => {
                try {
                    cb(count);
                } catch (e) {
                    console.warn('Erreur dans listener:', e);
                }
            });
        }

        /**
         * Retourne le nombre d'opérations en attente
         */
        getPendingCount() {
            return this.getQueue().length;
        }
    }

    // Instance unique de la queue
    let syncQueueInstance = null;

    function getSyncQueue() {
        if (!syncQueueInstance) {
            syncQueueInstance = new SyncQueue();
        }
        return syncQueueInstance;
    }

    // ============================================================
    // 8. GESTION DES ERREURS
    // ============================================================

    function setErrorHandler(callback) {
        _onError = callback;
    }

    // ============================================================
    // 9. EXPORTS
    // ============================================================

    // Créer l'objet d'export
    const FirebaseService = {
        // Initialisation
        initialize: initializeFirebase,
        waitForFirebase: waitForFirebase,
        isReady: () => _initialized,
        getApp: () => app,
        getDatabase: () => database,
        
        // Références
        dbRef: () => dbRef,
        connectedRef: () => connectedRef,
        getRef: getRef,
        getCollectionRef: getCollectionRef,
        COLLECTIONS: COLLECTIONS,
        
        // CRUD
        createData,
        readData,
        readDataOnce,
        updateData,
        deleteData,
        watchData,
        transactionData,
        getCollection,
        getCollectionAsArray,
        
        // Sync Queue
        SyncQueue,
        getSyncQueue,
        enqueue: (path, operation, data, options) => {
            const queue = getSyncQueue();
            return queue.add(path, operation, data, options);
        },
        processQueue: () => {
            const queue = getSyncQueue();
            return queue.process();
        },
        clearQueue: () => {
            const queue = getSyncQueue();
            queue.clear();
        },
        getQueueSize: () => {
            const queue = getSyncQueue();
            return queue.getPendingCount();
        },
        onQueueUpdate: (callback) => {
            const queue = getSyncQueue();
            queue.onUpdate(callback);
        },
        
        // Toast de connexion
        createConnectionToast,
        updateConnectionStatus,
        getConnectionStatus: () => connectionStatus,
        
        // Erreurs
        setErrorHandler,
        
        // Utilitaires
        COLLECTIONS,
        DB_URL
    };

    // ============================================================
    // 10. EXPOSER LE SERVICE (compatible ES module et script classique)
    // ============================================================

    // Exporter pour les modules ES
    if (typeof exports === 'object' && exports !== null) {
        // Node.js / CommonJS
        module.exports = FirebaseService;
    }

    // Exposer globalement
    if (typeof window !== 'undefined') {
        window.FirebaseService = FirebaseService;
        
        // Auto-initialisation au chargement de la page
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => {
                // Ne pas initialiser automatiquement, laisser chaque page le faire
                // mais préparer le terrain
                console.log('🔥 Firebase Service chargé');
            });
        } else {
            console.log('🔥 Firebase Service chargé');
        }
    }

    // Exporter pour les modules ES
    if (typeof define === 'function' && define.amd) {
        define(() => FirebaseService);
    }

    return FirebaseService;

})();