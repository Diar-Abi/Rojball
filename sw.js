// Rojball Service Worker — Caching + Push Notifications
const CACHE='rojball-v4';
const PRECACHE=[
  '/',
  '/index.html',
  'https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/leaflet.min.js',
  'https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/leaflet.min.css',
  'https://cdn.jsdelivr.net/npm/@tabler/icons-webfont@2.44.0/tabler-icons.min.css',
  'https://cdn.jsdelivr.net/npm/leaflet.markercluster@1.5.3/dist/leaflet.markercluster.js',
];

self.addEventListener('install',e=>{
  e.waitUntil(caches.open(CACHE).then(c=>c.addAll(PRECACHE).catch(()=>{})));
  self.skipWaiting();
});

self.addEventListener('activate',e=>e.waitUntil(
  caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k))))
  .then(()=>self.clients.claim())
));

self.addEventListener('fetch',e=>{
  var url=e.request.url;
  if(e.request.method!=='GET')return;
  if(/overpass|nominatim|open-meteo|osrm|supabase/.test(url))return;

  // App Shell: index.html immer aus Cache wenn offline
  if(url.endsWith('/')||url.includes('/index.html')||url===self.registration.scope){
    e.respondWith(
      fetch(e.request).then(res=>{
        var clone=res.clone();
        caches.open(CACHE).then(c=>c.put(e.request,clone));
        return res;
      }).catch(()=>caches.match('/index.html').then(r=>r||caches.match('/')))
    );
    return;
  }

  e.respondWith(
    caches.match(e.request).then(cached=>{
      if(cached)return cached;
      return fetch(e.request).then(res=>{
        if(res.ok&&(url.includes('cdn.jsdelivr')||url.includes('fonts.googleapis')||url.includes('cartocdn'))){
          var clone=res.clone();
          caches.open(CACHE).then(c=>c.put(e.request,clone));
        }
        return res;
      }).catch(()=>cached||caches.match('/index.html'));
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
