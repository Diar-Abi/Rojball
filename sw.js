// Rojball Service Worker — Offline-Caching + Push Notifications
const CACHE='rojball-v3';
const PRECACHE=[
  'https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/leaflet.min.js',
  'https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/leaflet.min.css',
  'https://cdn.jsdelivr.net/npm/@tabler/icons-webfont@2.44.0/tabler-icons.min.css',
  'https://cdn.jsdelivr.net/npm/leaflet.markercluster@1.5.3/dist/leaflet.markercluster.js',
];

self.addEventListener('install',e=>{
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE).then(c=>c.addAll(PRECACHE).catch(()=>{})));
});

self.addEventListener('activate',e=>{
  e.waitUntil(
    caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k))))
      .then(()=>self.clients.claim())
  );
});

self.addEventListener('fetch',e=>{
  var url=e.request.url;
  if(e.request.method!=='GET')return;
  if(/overpass|nominatim|open-meteo|osrm/.test(url))return;
  e.respondWith(
    caches.match(e.request).then(cached=>{
      if(cached)return cached;
      return fetch(e.request).then(res=>{
        if(res.ok&&(url.includes('cdn.jsdelivr')||url.includes('fonts.googleapis')||url.includes('cartocdn'))){
          var clone=res.clone();
          caches.open(CACHE).then(c=>c.put(e.request,clone));
        }
        return res;
      }).catch(()=>cached||new Response('Offline',{status:503}));
    })
  );
});

// ─── PUSH NOTIFICATIONS ─────────────────────────────────
self.addEventListener('push',e=>{
  let data={};
  try{ data = e.data ? e.data.json() : {}; }catch(err){ data={ title:'Rojball', body: e.data ? e.data.text() : '' }; }
  const title = data.title || 'Rojball';
  const options = {
    body: data.body || 'Neue Aktivität in deiner Nähe',
    tag: data.tag || 'rojball-notification',
    data: { url: data.url || '/' },
    vibrate: [100,50,100],
  };
  e.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick',e=>{
  e.notification.close();
  const url = (e.notification.data && e.notification.data.url) || '/';
  e.waitUntil(
    self.clients.matchAll({type:'window',includeUncontrolled:true}).then(clientList=>{
      for(const c of clientList){ if('focus' in c) return c.focus(); }
      if(self.clients.openWindow) return self.clients.openWindow(url);
    })
  );
});
