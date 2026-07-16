// _shared/crypto.ts — SHA-256 hashing and API key generation

const encoder = new TextEncoder();

/** SHA-256 hash — returns hex string */
export async function sha256(input: string): Promise<string> {
  const data = encoder.encode(input);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** Generate a cryptographically random API key string */
export function generateKey(): string {
  const chars =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
  const bytes = new Uint8Array(48);
  crypto.getRandomValues(bytes);
  let key = "sk-sp-"; // SpotPack prefix
  for (let i = 0; i < 48; i++) {
    key += chars[bytes[i] % chars.length];
  }
  return key;
}
