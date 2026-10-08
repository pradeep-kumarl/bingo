// Define the union of the 5 designated waste stream types accepted at BinGo zones
export type WasteType = 'wet' | 'sanitary' | 'dry' | 'furniture' | 'event'; // Five distinct waste categories

// Interface representing the decoded payload of a rotating bay QR token
export interface BayTokenPayload { // Shape of QR token data
  bayId: string; // Unique identifier of the vehicle bay (e.g. bay-wet-01)
  zoneId: string; // Identifier of the designated municipal zone (e.g. zone-koramangala-4)
  wasteType: WasteType; // The specific waste category assigned to this bay
  iat: number; // Issued-at timestamp in Unix epoch seconds
  exp: number; // Expiration timestamp in Unix epoch seconds (short-lived, 60s)
  nonce: string; // Cryptographic random nonce preventing replay attacks
} // End of BayTokenPayload interface

// Interface for the resident's scan submission request payload
export interface ScanRequestBody { // Payload sent by resident mobile app
  qrData: string; // Base64URL-encoded JSON string containing BayTokenPayload
  signature: string; // HMAC-SHA256 signature validating the authenticity of qrData
  householdId: string; // Unique identifier of the resident's household
} // End of ScanRequestBody interface

// Interface for tracking the 5 squares on the resident's daily/weekly BinGo card
export interface BinGoCardProgress { // State of the five squares on the BinGo card
  wet: boolean; // Indicates if wet waste was deposited and validated
  sanitary: boolean; // Indicates if sanitary waste was deposited and validated
  dry: boolean; // Indicates if dry recyclable waste was deposited and validated
  furniture: boolean; // Indicates if bulky furniture waste was deposited and validated
  event: boolean; // Indicates if party/event waste was deposited and validated
} // End of BinGoCardProgress interface

// Interface for the resident scan API response payload
export interface ScanResponse { // Response returned to the resident app upon scan
  success: boolean; // Flag indicating if the scan was successfully processed
  scanId: string; // Unique identifier for the persisted scan record
  timestamp: string; // ISO 8601 timestamp of when the scan was recorded
  wasteType: WasteType; // Waste type successfully logged for this scan
  householdId: string; // The household ID credited for the scan
  cardProgress: BinGoCardProgress; // Updated status of all 5 squares on the BinGo card
  bingoWon: boolean; // True if all required squares are completed in this cycle
  vehicleFillPercentage: number; // Simulated percentage fill of the vehicle after this deposit
  swapAlertTriggered: boolean; // True if vehicle reached 75% capacity and alert was dispatched
  message: string; // Human-friendly status message displayed on the green-tick screen
} // End of ScanResponse interface

// Interface for the household record in DynamoDB
export interface HouseholdRecord { // Household profile stored in DynamoDB
  PK: string; // Primary partition key: HOUSEHOLD#<householdId>
  SK: string; // Primary sort key: PROFILE
  GSI1PK: string; // GSI1 partition key: ZONE#<zoneId>
  GSI1SK: string; // GSI1 sort key: HOUSEHOLD#<householdId>
  householdId: string; // Unique household identifier
  residentName: string; // Primary resident full name
  zoneId: string; // Assigned municipal collection zone
  address: string; // Street address or flat number
  isOutOfStation: boolean; // Resident flag indicating temporary absence to suppress alerts
  wellnessOptIn: boolean; // Resident opt-in flag for non-intrusive wellness check-ins
  emergencyContact?: { // Optional emergency contact details
    name: string; // Contact person's name
    phone: string; // Contact person's phone number
  }; // End of emergencyContact object
  lastActiveDate: string; // Date of last recorded scan in YYYY-MM-DD format
  streakDays: number; // Count of consecutive active waste disposal days
  cardProgress: BinGoCardProgress; // Current card progress
} // End of HouseholdRecord interface

// Interface for the vehicle record in DynamoDB
export interface VehicleRecord { // Waste collection vehicle state in DynamoDB
  PK: string; // Primary partition key: ZONE#<zoneId>
  SK: string; // Primary sort key: VEHICLE#<wasteType>
  GSI1PK: string; // GSI1 partition key: VEHICLE#<vehicleId>
  GSI1SK: string; // GSI1 sort key: METADATA
  vehicleId: string; // Unique registration/fleet ID of the vehicle
  bayId: string; // Assigned bay identifier
  zoneId: string; // Assigned collection zone
  wasteType: WasteType; // Waste type handled by this vehicle
  capacityKg: number; // Total weight capacity in kilograms (e.g. 1000 kg)
  currentLoadKg: number; // Current accumulated load in kilograms (simulated)
  fillPercentage: number; // Derived load percentage (currentLoadKg / capacityKg * 100)
  status: 'active' | 'swapping' | 'full'; // Operational status of the vehicle
  lastSwapTimestamp: string; // ISO 8601 timestamp of last vehicle replacement
} // End of VehicleRecord interface
