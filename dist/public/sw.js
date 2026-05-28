/**
 * Copyright 2018 Google Inc. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *     http://www.apache.org/licenses/LICENSE-2.0
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

// If the loader is already loaded, just stop.
if (!self.define) {
  let registry = {};

  // Used for `eval` and `importScripts` where we can't get script URL by other means.
  // In both cases, it's safe to use a global var because those functions are synchronous.
  let nextDefineUri;

  const singleRequire = (uri, parentUri) => {
    uri = new URL(uri + ".js", parentUri).href;
    return registry[uri] || (
      
        new Promise(resolve => {
          if ("document" in self) {
            const script = document.createElement("script");
            script.src = uri;
            script.onload = resolve;
            document.head.appendChild(script);
          } else {
            nextDefineUri = uri;
            importScripts(uri);
            resolve();
          }
        })
      
      .then(() => {
        let promise = registry[uri];
        if (!promise) {
          throw new Error(`Module ${uri} didn’t register its module`);
        }
        return promise;
      })
    );
  };

  self.define = (depsNames, factory) => {
    const uri = nextDefineUri || ("document" in self ? document.currentScript.src : "") || location.href;
    if (registry[uri]) {
      // Module is already loading or loaded.
      return;
    }
    let exports = {};
    const require = depUri => singleRequire(depUri, uri);
    const specialDeps = {
      module: { uri },
      exports,
      require
    };
    registry[uri] = Promise.all(depsNames.map(
      depName => specialDeps[depName] || require(depName)
    )).then(deps => {
      factory(...deps);
      return exports;
    });
  };
}
define(['./workbox-52f2a342'], (function (workbox) { 'use strict';

  self.skipWaiting();
  workbox.clientsClaim();

  /**
   * The precacheAndRoute() method efficiently caches and responds to
   * requests for URLs in the manifest.
   * See https://goo.gl/S9QRab
   */
  workbox.precacheAndRoute([{
    "url": "registerSW.js",
    "revision": "1872c500de691dce40960bb85481de07"
  }, {
    "url": "offline.html",
    "revision": "8d9ac9c94ab21fc00ce657a9fe7f3917"
  }, {
    "url": "index.html",
    "revision": "1fc55af3a6a11ed3de5ea8f98497074c"
  }, {
    "url": "favicon.png",
    "revision": "ed6740d90cd839744d48523d4991a6f7"
  }, {
    "url": "assets/web-BWrO7el3.js",
    "revision": null
  }, {
    "url": "assets/web-BTaWJvUo.js",
    "revision": null
  }, {
    "url": "assets/vendor-DXmEqIKf.js",
    "revision": null
  }, {
    "url": "assets/ui-CBfzU35f.js",
    "revision": null
  }, {
    "url": "assets/maps-B_vnjFqF.js",
    "revision": null
  }, {
    "url": "assets/index-Dr7YTHnu.js",
    "revision": null
  }, {
    "url": "assets/index-bi0xPTK9.css",
    "revision": null
  }], {});
  workbox.cleanupOutdatedCaches();
  workbox.registerRoute(new workbox.NavigationRoute(workbox.createHandlerBoundToURL("/offline.html"), {
    denylist: [/^\/api\//, /^\/ws\//, /^\/@vite\/client/]
  }));
  workbox.registerRoute(/^https:\/\/senior-full-stack\.onrender\.com\/api\/.*/i, new workbox.NetworkFirst({
    "cacheName": "api-cache",
    "networkTimeoutSeconds": 10,
    plugins: [new workbox.ExpirationPlugin({
      maxEntries: 50,
      maxAgeSeconds: 86400
    })]
  }), 'GET');
  workbox.registerRoute(/^https:\/\/(.*\.)?tile\.openstreetmap\.org\/.*/i, new workbox.CacheFirst({
    "cacheName": "map-tiles-cache",
    plugins: [new workbox.ExpirationPlugin({
      maxEntries: 200,
      maxAgeSeconds: 2592000
    })]
  }), 'GET');
  workbox.registerRoute(/^https:\/\/fonts\.(googleapis|gstatic)\.com\/.*/i, new workbox.CacheFirst({
    "cacheName": "google-fonts-cache",
    plugins: [new workbox.ExpirationPlugin({
      maxEntries: 30,
      maxAgeSeconds: 2592000
    })]
  }), 'GET');

}));
//# sourceMappingURL=sw.js.map
