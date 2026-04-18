import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "../index.css";
import "../i18n";
import { Privacy } from "./Privacy";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Privacy />
  </StrictMode>,
);
