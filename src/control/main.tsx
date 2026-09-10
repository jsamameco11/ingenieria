import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { AuthProvider } from "../ui/AuthProvider";
import { ControlApp } from "./ControlApp";
import "../styles.css";
import "./control.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <AuthProvider>
      <ControlApp />
    </AuthProvider>
  </StrictMode>,
);
