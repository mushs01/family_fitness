// Service Worker for 우리가족 운동관리 PWA
const CACHE_NAME = 'family-fitness-v2-' + Date.now();
const urlsToCache = [
  './',
  './index.html',
  './style.css',
  './app.js',
  './manifest.json',
  './family_image.png'
];

// Service Worker 설치
self.addEventListener('install', function(event) {
  console.log('Service Worker 설치 중...');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(function(cache) {
        console.log('새 캐시 생성:', CACHE_NAME);
        return cache.addAll(urlsToCache);
      })
      .then(function() {
        console.log('캐시 완료, 즉시 활성화');
        return self.skipWaiting();
      })
  );
});

// Service Worker 활성화
self.addEventListener('activate', function(event) {
  console.log('Service Worker 활성화 중...');
  event.waitUntil(
    caches.keys().then(function(cacheNames) {
      return Promise.all(
        cacheNames.map(function(cacheName) {
          if (!cacheName.startsWith('family-fitness-v2')) {
            console.log('오래된 캐시 삭제:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(function() {
      console.log('모든 클라이언트 제어');
      return self.clients.claim();
    })
  );
});

// 네트워크 요청 가로채기
self.addEventListener('fetch', function(event) {
  event.respondWith(
    caches.match(event.request)
      .then(function(response) {
        // 캐시에서 찾으면 반환
        if (response) {
          return response;
        }
        // 없으면 네트워크에서 가져오기
        return fetch(event.request);
      }
    )
  );
});
