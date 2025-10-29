[1] [MAIN] Failed to initialize records database: Error: The module '\\?\C:\Users\user\Desktop\ìì°°íë¡ê·¸ë¨_ì¼ë í¸ë¡ \company-search-electron\node_modules\better-sqlite3\build\Release\better_sqlite3.node'
[1] was compiled against a different Node.js version using
[1] NODE_MODULE_VERSION 115. This version of Node.js requires
[1] NODE_MODULE_VERSION 125. Please try re-compiling or re-installing
[1] the module (for instance, using `npm rebuild` or `npm install`).
[1]     at process.func [as dlopen] (node:electron/js2c/node_init:2:2559)
[1]     at Module._extensions..node (node:internal/modules/cjs/loader:1602:18)
[1]     at Object.func [as .node] (node:electron/js2c/node_init:2:2559)
[1]     at Module.load (node:internal/modules/cjs/loader:1295:32)
[1]     at Module._load (node:internal/modules/cjs/loader:1111:12)
[1]     at c._load (node:electron/js2c/node_init:2:16955)
[1]     at Module.require (node:internal/modules/cjs/loader:1318:19)
[1]     at require (node:internal/modules/helpers:179:18)
[1]     at bindings (C:\Users\user\Desktop\입찰프로그램_일렉트론\company-search-electron\node_modules\bindings\bindings.js:112:48)
[1]     at new Database (C:\Users\user\Desktop\입찰프로그램_일렉트론\company-search-electron\node_modules\better-sqlite3\lib\database.js:48:64)
[1]     at ensureRecordsDatabase (C:\Users\user\Desktop\입찰프로그램_일렉트론\company-search-electron\src\main\features\records\recordsDatabase.js:159:14)
[1]     at C:\Users\user\Desktop\입찰프로그램_일렉트론\company-search-electron\main.js:452:25 {
[1]   code: 'ERR_DLOPEN_FAILED'
[1] }



## 터미널 에러

[1] Error occurred in handler for 'records:list-projects': Error: No handler registered for 'records:list-projects'
[1]     at WebContents.<anonymous> (node:electron/js2c/browser_init:2:83837)
[1]     at WebContents.emit (node:events:519:28)