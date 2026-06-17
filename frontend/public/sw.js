const CACHE_NAME = "edukids-shell-v2";
const APP_SHELL = [
  "./",
  "./index.html",
  "./manifest.json",
  "./js/config.js",
  "./css/style.css",
  "./js/firebase-init.js",
  "./js/services/profileService.js",
  "./js/services/assignmentService.js",
  "./assets/edukids-icon-192.png",
  "./assets/edukids-icon-512.png",
  "./assets/edukids-icon-admin.png",
  "./assets/AICoach.png",
  "./assets/robot.png",
  "./assets/userAvatar/boy.png",
  "./assets/userAvatar/girl.png",
  "./assets/userAvatar/maleteacher.png",
  "./assets/userAvatar/femaleteacher.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)),
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key !== CACHE_NAME)
            .map((key) => caches.delete(key)),
        ),
      ),
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const { request } = event;

  if (request.method !== "GET") {
    return;
  }

  const url = new URL(request.url);

  if (request.mode === "navigate") {
    event.respondWith(fetch(request).catch(() => caches.match("./index.html")));
    return;
  }

  if (url.origin === self.location.origin) {
    event.respondWith(
      caches.match(request).then((cachedResponse) => {
        if (cachedResponse) {
          return cachedResponse;
        }

        return fetch(request).then((response) => {
          if (
            !response ||
            response.status !== 200 ||
            response.type === "opaque"
          ) {
            return response;
          }

          const responseClone = response.clone();

          caches.open(CACHE_NAME).then((cache) => {
            cache.put(request, responseClone);
          });

          return response;
        });
      }),
    );
  }
});
