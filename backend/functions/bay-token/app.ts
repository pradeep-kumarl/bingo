// Import standard types for AWS Lambda HTTP API Gateway v2 event and result
import { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda'; // Lambda event and response types

// Import cryptographic helper functions from the shared module
import { generateNonce, toBase64Url, signData } from '../../shared/crypto'; // Nonce generator and HMAC signer

// Import domain types from the shared types module
import { BayTokenPayload, WasteType } from '../../shared/types'; // Types for token payload and waste categories

// Read the shared secret key from environment variables or use a safe development default
const BAY_SECRET = process.env.BAY_SECRET || 'bingo-dev-super-secret-key-32ch'; // Secret for signing QR tokens

// Map known bay identifiers to their designated waste stream type and municipal zone
const BAY_REGISTRY: Record<string, { wasteType: WasteType; zoneId: string }> = { // In-memory registry for bays
  'bay-wet-01': { wasteType: 'wet', zoneId: 'zone-koramangala-4' }, // Bay 1 is assigned to wet organic waste
  'bay-sanitary-01': { wasteType: 'sanitary', zoneId: 'zone-koramangala-4' }, // Bay 2 is assigned to sanitary waste
  'bay-dry-01': { wasteType: 'dry', zoneId: 'zone-koramangala-4' }, // Bay 3 is assigned to dry recyclable waste
  'bay-furniture-01': { wasteType: 'furniture', zoneId: 'zone-koramangala-4' }, // Bay 4 is assigned to bulky furniture
  'bay-event-01': { wasteType: 'event', zoneId: 'zone-koramangala-4' }, // Bay 5 is assigned to event/party waste
}; // End of BAY_REGISTRY dictionary

// Standard helper function to construct HTTP API responses with proper JSON and CORS headers
function buildJsonResponse(statusCode: number, body: object): APIGatewayProxyResultV2 { // Returns formatted response
  return { // Return response object conforming to APIGatewayProxyResultV2
    statusCode, // HTTP status code (e.g. 200, 400, 500)
    headers: { // Response headers map
      'Content-Type': 'application/json', // Specify JSON content format
      'Access-Control-Allow-Origin': '*', // Enable cross-origin resource sharing from all domains
      'Access-Control-Allow-Methods': 'GET, OPTIONS', // Allow GET and preflight OPTIONS methods
      'Access-Control-Allow-Headers': 'Content-Type, Authorization', // Allow standard application headers
    }, // End of headers
    body: JSON.stringify(body), // Serialize response payload object to JSON string
  }; // End of response object
} // End of buildJsonResponse helper

// Export the main AWS Lambda handler function for generating rotating bay QR tokens
export const handler = async (event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResultV2> => { // Async handler
  try { // Wrap handler logic in a try-catch block for comprehensive error handling
    // Extract the bayId path parameter from the incoming HTTP API Gateway request
    const bayId = event.pathParameters?.bayId; // Read bayId from path URL

    // Validate that bayId was provided in the request path
    if (!bayId) { // Check if bayId parameter is null or undefined
      return buildJsonResponse(400, { // Return HTTP 400 Bad Request
        error: 'MissingBayId', // Machine-readable error code
        message: 'Path parameter bayId is required (e.g. /bays/bay-wet-01/token)', // Explanatory message
      }); // End of bad request return
    } // End of bayId presence check

    // Look up the bay details in the registry or parse from query parameters as fallback
    const registeredBay = BAY_REGISTRY[bayId]; // Attempt to resolve bay configuration
    const queryParams = event.queryStringParameters || {}; // Access optional query string parameters
    const wasteType = (queryParams.wasteType as WasteType) || registeredBay?.wasteType || 'wet'; // Resolve waste category
    const zoneId = queryParams.zoneId || registeredBay?.zoneId || 'zone-koramangala-4'; // Resolve municipal zone

    // Capture the current Unix epoch time in seconds
    const nowSeconds = Math.floor(Date.now() / 1000); // Current timestamp in seconds

    // Set token expiration window to 60 seconds into the future
    const tokenTtlSeconds = 60; // Tokens expire in 60 seconds to prevent replay
    const expSeconds = nowSeconds + tokenTtlSeconds; // Calculate expiration epoch timestamp

    // Generate an 8-byte cryptographic random nonce to guarantee token uniqueness
    const nonce = generateNonce(8); // Random hex nonce string

    // Construct the structured bay token payload object
    const payload: BayTokenPayload = { // Create payload conforming to BayTokenPayload interface
      bayId, // Unique bay identifier
      zoneId, // Designated municipal zone
      wasteType, // Designated waste category for this vehicle bay
      iat: nowSeconds, // Token issuance timestamp
      exp: expSeconds, // Token expiration timestamp
      nonce, // Unique random nonce
    }; // End of payload construction

    // Encode the JSON payload into a URL-safe Base64 string for QR rendering
    const qrData = toBase64Url(payload); // Base64URL string of payload

    // Generate an HMAC-SHA256 digital signature of the encoded payload using the secret key
    const signature = signData(qrData, BAY_SECRET); // Digital signature for authenticity verification

    // Construct the deep link URL compatible with mobile app custom scheme
    const deepLink = `bingo://scan?data=${qrData}&sig=${signature}`; // Mobile deep link URI

    // Return HTTP 200 with the complete token and display metadata for the bay tablet screen
    return buildJsonResponse(200, { // Success response
      success: true, // Operational status flag
      bayId, // Return echoing bayId
      zoneId, // Assigned collection zone
      wasteType, // Assigned waste stream
      qrData, // Base64URL payload for QR generator
      signature, // HMAC signature
      deepLink, // Deep link URL for NFC or direct linking
      iat: nowSeconds, // Issuance timestamp
      exp: expSeconds, // Expiration timestamp
      expiresInSeconds: tokenTtlSeconds, // Remaining seconds before tablet should refresh QR
    }); // End of success response object
  } catch (error: any) { // Catch any unexpected runtime errors
    // Log the error details to AWS CloudWatch for troubleshooting
    console.error('Error generating bay token:', error); // CloudWatch error log

    // Return HTTP 500 Internal Server Error with error message
    return buildJsonResponse(500, { // Server error response
      error: 'InternalServerError', // Error classification
      message: error?.message || 'An unexpected error occurred while generating bay token', // Error description
    }); // End of 500 return
  } // End of catch block
}; // End of handler export
