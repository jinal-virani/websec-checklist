import "./globals.css";
import Header from "../components/Header";

export const metadata = {
  title: "WebSec Checklist",
  description: "Web application security assessment checklist tool",
};

// Explicit viewport so mobile browsers use the device width (no zoomed-out page).
export const viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#0b4f6c",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <Header />
        <main className="container">{children}</main>
      </body>
    </html>
  );
}
