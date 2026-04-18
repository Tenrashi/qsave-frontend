import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "../index.css";
import "../i18n";
import { Terms } from "./Terms";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Terms />
  </StrictMode>,
);
