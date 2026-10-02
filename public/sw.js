const CACHE='rutard-v2';

self.addEventListener('install',event=>event.waitUntil(self.skipWaiting()));

self.addEventListener('activate',event=>event.waitUntil((async()=>{
  const names=await caches.keys();
  await Promise.all(names.filter(name=>name.startsWith('rutard-')&&name!==CACHE).map(name=>caches.delete(name)));
  await self.clients.claim();
})()));

self.addEventListener('fetch',event=>{
  const request=event.request;
  if(request.method!=='GET'||new URL(request.url).origin!==self.location.origin)return;
  if(request.mode==='navigate'){
    event.respondWith((async()=>{
      try{
        const response=await fetch(request,{cache:'no-store'});
        if(response.ok){const cache=await caches.open(CACHE);await cache.put(request,response.clone())}
        return response;
      }catch{
        return await caches.match(request)||await caches.match('/')||Response.error();
      }
    })());
    return;
  }
  event.respondWith(caches.match(request).then(response=>response||fetch(request)));
});
