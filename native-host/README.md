# XMath native host

A WebView window launches the local Rust backend and loads `http://127.0.0.1:8792`. It follows the same host architecture as XSlide.

```sh
npm run native:build
npm run native
npm run native:headless
```

The host executable is `native-host/target/release/xmath-native` (add `.exe` on Windows). Windows packaging uses `npm run dist:win`.
