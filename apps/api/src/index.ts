import "dotenv/config";
import { createServer } from "./server";

const port = Number(process.env.API_PORT || 4000);
const app = createServer();

if (process.env.NODE_ENV !== "production") {
  const missingSmtp = ["SMTP_HOST", "SMTP_PORT", "SMTP_USER", "SMTP_PASS", "SMTP_FROM", "APP_BASE_URL"].some(
    (key) => !process.env[key] || `${process.env[key]}`.trim() === "",
  );
  if (missingSmtp) {
    // eslint-disable-next-line no-console
    console.warn("SMTP not configured; password reset emails will not send.");
  }
}

app.listen(port, () => {
  // eslint-disable-next-line no-console
  console.log(`API listening on http://localhost:${port}`);
});


