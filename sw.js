// sw.js – Service Worker pour AgriAchat

const CACHE_NAME = 'agri-achat-v1';

// Liste des ressources à mettre en cache lors de l'installation
const urlsToCache = [
  // Pages principales
  '/',
  '/index.html',
  '/login.html',
  '/achat.html',
  '/approv.html',
  '/comptabilite.html',
  '/point.html',
  '/parametres.html',
  
  // Fichiers PWA
  '/manifest.json',
  '/achat.png',
  
  // Ressources externes (CDN)
  'https://cdn.jsdelivr.net/npm/bootstrap@5.3.2/dist/css/bootstrap.min.css',
  'https://cdn.jsdelivr.net/npm/bootstrap@5.3.2/dist/js/bootstrap.bundle.min.js',
  'https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.1/font/bootstrap-icons.css',
  'https://fonts.googleapis.com/css2?family=Open+Sans:wght@400;600&family=Roboto:wght@400;500;700&display=swap'
];

// Installation : mise en cache des ressources statiques
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
    .then((cache) => {
      console.log('[Service Worker] Mise en cache des ressources');
      return cache.addAll(urlsToCache);
    })
    .catch((error) => {
      console.error('[Service Worker] Erreur lors du cache :', error);
    })
  );
  // Force l'activation immédiate du nouveau service worker
  self.skipWaiting();
});

// Activation : suppression des anciens caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
    .then((cacheNames) => {
      return Promise.all(
        cacheNames.map((name) => {
          if (name !== CACHE_NAME) {
            console.log('[Service Worker] Suppression de l\'ancien cache :', name);
            return caches.delete(name);
          }
        })
      );
    })
    .then(() => {
      // Prend le contrôle des clients ouverts
      return self.clients.claim();
    })
  );
});

// Interception des requêtes : stratégie Cache First avec fallback réseau
self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request)
    .then((response) => {
      // Si la ressource est dans le cache, on la renvoie
      if (response) {
        return response;
      }
      // Sinon, on tente de la charger depuis le réseau
      return fetch(event.request)
        .then((networkResponse) => {
          // Optionnel : mettre en cache la nouvelle ressource pour la prochaine fois
          // (on peut ajouter une logique pour ne cacher que certains types)
          return networkResponse;
        })
        .catch(() => {
          // Si le réseau échoue, on peut renvoyer une page d'erreur personnalisée
          // (par exemple une page offline.html)
          // Pour l'instant, on renvoie une réponse vide ou une erreur
          return new Response('Hors ligne - Ressource non disponible', {
            status: 503,
            statusText: 'Service Unavailable'
          });
        });
    })
  );
});