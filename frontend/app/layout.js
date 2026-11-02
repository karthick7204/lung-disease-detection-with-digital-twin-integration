import "./globals.css";
import { AuthProvider } from "../context/AuthContext";

export const metadata = {
  title: "LungTwin AI — Pulmonary Digital Twin & Chest X-Ray AI Diagnostics",
  description:
    "AI-powered chest X-ray disease detection and patient pulmonary Digital Twin tracking platform.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      </head>
      <body>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
