import "./lib/fetch-override";  // <-- DOIT être le premier import
import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

createRoot(document.getElementById("root")!).render(<App />);