const CACHE='noted-v2';
const SHELL=['./','./index.html','./manifest.json','./icon.svg'];

self.addEventListener('install',e=>{
  e.waitUntil(
    caches.open(CACHE)
      .then(c=>c.addAll(SHELL))
      .then(()=>self.skipWaiting())
      .catch(()=>{})
  );
});

self.addEventListener('activate',e=>{
  e.waitUntil(
    caches.keys()
      .then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k))))
      .then(()=>self.clients.claim())
  );
});

self.addEventListener('fetch',e=>{
  if(e.request.method!=='GET') return;
  const url=new URL(e.request.url);
  // Only same-origin; let Google Fonts and other CDNs pass through normally
  if(url.origin!==location.origin) return;

  e.respondWith(
    caches.match(e.request).then(cached=>{
      if(cached){
        // Revalidate in the background so an updated shell reaches the next load
        fetch(e.request).then(res=>{
          if(res && res.status===200) caches.open(CACHE).then(c=>c.put(e.request,res.clone()));
        }).catch(()=>{});
        return cached;
      }
      return fetch(e.request).then(res=>{
        if(res && res.status===200 && res.type==='basic'){
          const clone=res.clone();
          caches.open(CACHE).then(c=>c.put(e.request,clone));
        }
        return res;
      }).catch(()=>caches.match('./index.html'));
    })
  );
});
