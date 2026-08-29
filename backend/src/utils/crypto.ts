import crypto from "crypto";

// Security Key ကို အတိအကျ 32 bytes ဖြစ်အောင် SHA-256 နဲ့ Hash လုပ်ယူမည်
const RAW_KEY = process.env.ENCRYPTION_KEY || "my_super_secret_32_byte_key_123456";
const SECRET_KEY = crypto.createHash("sha256").update(RAW_KEY).digest(); 
const ALGORITHM = "aes-256-cbc";

export function encryptText(text: string): string {
  try {
    if (!text) return text;
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(ALGORITHM, SECRET_KEY, iv);
    let encrypted = cipher.update(text, "utf8", "hex");
    encrypted += cipher.final("hex");
    return `${iv.toString("hex")}:${encrypted}`;
  } catch (error) {
    console.error("Encryption Error direct log:", error);
    return text;
  }
}

export function decryptText(encryptedText: string): string {
  try {
    if (!encryptedText || !encryptedText.includes(":")) return encryptedText;
    const [ivHex, encrypted] = encryptedText.split(":");
    const iv = Buffer.from(ivHex, "hex");
    const decipher = crypto.createDecipheriv(ALGORITHM, SECRET_KEY, iv);
    let decrypted = decipher.update(encrypted, "hex", "utf8");
    decrypted += decipher.final("utf8");
    return decrypted;
  } catch (error) {
    return encryptedText;
  }
}