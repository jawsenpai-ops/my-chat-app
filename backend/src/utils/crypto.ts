import crypto from "crypto";
import dotenv from "dotenv";
import path from "path";

const envPaths = [
  path.resolve(process.cwd(), ".env"),
  path.resolve(process.cwd(), "backend", ".env"),
  path.resolve(__dirname, "..", "..", ".env"),
  path.resolve(__dirname, "..", ".env"),
];

for (const envPath of envPaths) {
  dotenv.config({ path: envPath });
}

const RAW_KEY = process.env.ENCRYPTION_KEY?.trim();

if (!RAW_KEY || RAW_KEY.length < 32) {
  throw new Error(
    "ENCRYPTION_KEY is missing or too short. Set it in the environment or .env file."
  );
}

const SECRET_KEY = crypto.createHash("sha256").update(String(RAW_KEY)).digest();
const ALGORITHM = "aes-256-cbc";

export function encryptText(text: string): string {
  if (!text) return "";

  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(ALGORITHM, SECRET_KEY, iv);

  let encrypted = cipher.update(text, "utf8", "hex");
  encrypted += cipher.final("hex");

  return `${iv.toString("hex")}:${encrypted}`;
}

export function decryptText(encryptedText: string): string {
  if (!encryptedText) return "";

  if (!encryptedText.includes(":")) {
    return encryptedText;
  }

  const [ivHex, encrypted] = encryptedText.split(":");

  if (!ivHex || !encrypted) {
    return encryptedText;
  }

  try {
    const iv = Buffer.from(ivHex, "hex");
    const decipher = crypto.createDecipheriv(ALGORITHM, SECRET_KEY, iv);
    let decrypted = decipher.update(encrypted, "hex", "utf8");
    decrypted += decipher.final("utf8");
    return decrypted;
  } catch (error) {
    console.error("Decrypt Error:", error);
    return encryptedText;
  }
}