// Rojball Service Worker — Caching + Push Notifications
const CACHE='rojball-v7';
const TILE_CACHE='rojball-tiles-v2';
const PRECACHE=[
  '/',
  '/index.html',
  '/spots-data.js',
  '/vendor/leaflet/leaflet.js',
  '/vendor/leaflet/leaflet.css',
  '/vendor/leaflet/leaflet.markercluster.js',
  '/vendor/leaflet/MarkerCluster.css',
  '/vendor/leaflet/MarkerCluster.Default.css',
  '/vendor/tabler/tabler-icons.min.css',
  '/vendor/tabler/fonts/tabler-icons.woff2',
  '/vendor/tabler/fonts/tabler-icons.woff',
];

self.addEventListener('install',e=>{
  e.waitUntil(caches.open(CACHE).then(c=>c.addAll(PRECACHE).catch(()=>{})));
  self.skipWaiting();
});

self.addEventListener('activate',e=>e.waitUntil(
  caches.keys().then(keys=>Promise.all(
    keys.filter(k=>k!==CACHE&&k!==TILE_CACHE).map(k=>caches.delete(k))
  )).then(()=>self.clients.claim())
));

function isTile(url){
  return /cartocdn|arcgisonline|tile\.openstreetmap|basemaps/.test(url);
}

self.addEventListener('fetch',e=>{
  var url=e.request.url;
  if(e.request.method!=='GET')return;
  if(/overpass|nominatim|open-meteo|osrm|supabase/.test(url))return;

  // Kartenkacheln: Cache-first, dann Netz, immer cachen
  if(isTile(url)){
    e.respondWith(
      caches.open(TILE_CACHE).then(tc=>
        fetch(e.request).then(res=>{
          if(res&&res.ok){tc.put(e.request,res.clone());}
          return res;
        }).catch(()=>tc.match(e.request))
      )
    );
    return;
  }

  // App Shell: index.html — immer frisch aus dem Netz, Cache als Fallback
  if(url.endsWith('/')||url.includes('/index.html')||url===self.registration.scope){
    e.respondWith(
      fetch(e.request).then(res=>{
        caches.open(CACHE).then(c=>c.put(e.request,res.clone()));
        return res;
      }).catch(()=>caches.match('/index.html').then(r=>r||caches.match('/')))
    );
    return;
  }

  // Lokale vendor-Dateien + spots-data: Cache-first, sonst Netz und cachen
  if(url.includes('/vendor/')||url.includes('/spots-data.js')){
    e.respondWith(
      caches.match(e.request).then(cached=>{
        if(cached)return cached;
        return fetch(e.request).then(res=>{
          if(res.ok){caches.open(CACHE).then(c=>c.put(e.request,res.clone()));}
          return res;
        }).catch(()=>cached);
      })
    );
    return;
  }

  // Sonstige Assets (Google Fonts etc.)
  e.respondWith(
    caches.match(e.request).then(cached=>{
      if(cached)return cached;
      return fetch(e.request).then(res=>{
        if(res.ok&&url.includes('fonts.googleapis')){
          caches.open(CACHE).then(c=>c.put(e.request,res.clone()));
        }
        return res;
      }).catch(()=>cached);
    })
  );
});

// ─── PUSH NOTIFICATIONS ───────────────────────────────────
self.addEventListener('push',function(e){
  var data={title:'Rojball',body:'Neue Benachrichtigung',icon:'/icons/icon-192.png',badge:'/icons/icon-192.png',tag:'rojball'};
  try{if(e.data)Object.assign(data,e.data.json());}catch(err){}
  e.waitUntil(self.registration.showNotification(data.title,{
    body:data.body,icon:data.icon,badge:data.badge,
    tag:data.tag,data:data.url||'/',vibrate:[200,100,200]
  }));
});

self.addEventListener('notificationclick',function(e){
  e.notification.close();
  var url=e.notification.data||'/';
  e.waitUntil(clients.matchAll({type:'window'}).then(function(cls){
    for(var c of cls){if(c.url===url&&'focus' in c)return c.focus();}
    if(clients.openWindow)return clients.openWindow(url);
  }));
});
