import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { setupPwaManifest } from "./lib/pwaManifest";

setupPwaManifest();

createRoot(document.getElementById("root")!).render(<App />);
