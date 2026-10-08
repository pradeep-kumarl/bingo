// Import the native Node.js crypto module for cryptographic operations
import crypto from 'node:crypto'; // Built-in cryptography package, zero third-party dependencies

// Import the BayTokenPayload type definition from shared types
import { BayTokenPayload } from './types'; // Shared interface representing QR token contents

// Generate a cryptographically secure random hexadecimal nonce string
export function generateNonce(byteLength: number = 8): string { // Accepts optional byte length defaulting to 8
  return crypto.randomBytes(byteLength).toString('hex'); // Generate random bytes and format as hexadecimal string
} // End of generateNonce function

// Encode an object or string into a URL-safe Base64 string
export function toBase64Url(data: string | object): string { // Accepts string or JSON object
  const jsonString = typeof data === 'string' ? data : JSON.stringify(data); // Serialize object to JSON string if needed
  return Buffer.from(jsonString, 'utf-8') // Convert JSON string into a UTF-8 Buffer
    .toString('base64url'); // Convert Buffer to URL-safe Base64 string
} // End of toBase64Url function

// Decode a URL-safe Base64 string back into a parsed object or string
export function fromBase64Url<T = any>(base64UrlStr: string): T { // Generic function returning parsed type T
  const jsonString = Buffer.from(base64UrlStr, 'base64url').toString('utf-8'); // Decode URL-safe Base64 to UTF-8 string
  return JSON.parse(jsonString) as T; // Parse UTF-8 string into JSON object and cast to type T
} // End of fromBase64Url function

// Generate an HMAC-SHA256 signature for a given payload string using the secret key
export function signData(data: string, secretKey: string): string { // Takes data string and signing secret
  return crypto // Access native crypto module
    .createHmac('sha256', secretKey) // Create HMAC instance with SHA-256 algorithm and secret key
    .update(data, 'utf-8') // Feed the data string encoded in UTF-8 into HMAC hasher
    .digest('base64url'); // Output the resulting digest as a URL-safe Base64 string
} // End of signData function

// Verify that a given signature matches the payload using constant-time comparison
export function verifySignature(data: string, signature: string, secretKey: string): boolean { // Verifies signature
  const expectedSignature = signData(data, secretKey); // Compute the expected HMAC signature for the payload
  const sigBuffer = Buffer.from(signature, 'utf-8'); // Convert received signature to Buffer for comparison
  const expectedBuffer = Buffer.from(expectedSignature, 'utf-8'); // Convert expected signature to Buffer
  if (sigBuffer.length !== expectedBuffer.length) { // Check if signature lengths differ to avoid buffer mismatch errors
    return false; // Return false immediately if lengths do not match
  } // End of length check
  return crypto.timingSafeEqual(sigBuffer, expectedBuffer); // Perform constant-time comparison to prevent timing attacks
} // End of verifySignature function

// Validate that the token has not expired, allowing a configurable clock skew tolerance
export function isTokenValidTimestamp(expSeconds: number, toleranceSeconds: number = 10): boolean { // Checks expiration
  const currentEpochSeconds = Math.floor(Date.now() / 1000); // Compute current time in Unix epoch seconds
  return currentEpochSeconds <= expSeconds + toleranceSeconds; // Return true if current time is within expiration + tolerance
} // End of isTokenValidTimestamp function
