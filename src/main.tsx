import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { registerSW } from "virtual:pwa-register";

// Register service worker with auto-update
const updateSW = registerSW({
  immediate: true,
  onNeedRefresh() {
    // Dispatch custom event for PWAUpdatePrompt component
    window.dispatchEvent(new CustomEvent('pwa-update-available', { detail: { updateSW } }));
  },
  onOfflineReady() {
    console.log('App ready to work offline');
  },
  onRegisteredSW(swUrl, registration) {
    console.log('Service worker registered:', swUrl);
    // Check for updates every hour
    if (registration) {
      setInterval(() => {
        registration.update();
      }, 60 * 60 * 1000);
    }
  },
  onRegisterError(error) {
    console.error('Service worker registration error:', error);
  },
});

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
