// Import the core low-level DynamoDB client from the AWS SDK v3
import { DynamoDBClient } from '@aws-sdk/client-dynamodb'; // AWS SDK v3 DynamoDB client

// Import the DynamoDB Document Client wrapper for simplified JavaScript object handling
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb'; // Simplifies marshaling/unmarshaling

// Import the WasteType union type from the shared types module
import { WasteType } from './types'; // Shared domain waste types

// Instantiate the base DynamoDB client targeting the current AWS region
const baseClient = new DynamoDBClient({ // Initialize base DynamoDB connection
  region: process.env.AWS_REGION || 'ap-south-1', // Default to ap-south-1 Mumbai region if unset
}); // End of baseClient initialization

// Create and export the document client with automatic JSON object serialization
export const docClient = DynamoDBDocumentClient.from(baseClient, { // Wrap base client
  marshallOptions: { // Marshalling configuration options
    removeUndefinedValues: true, // Automatically strip undefined object fields before persisting
    convertEmptyValues: false, // Maintain empty strings and values as-is
  }, // End of marshallOptions
}); // End of docClient export

// Export the active DynamoDB table name retrieved from environment variables
export const TABLE_NAME = process.env.TABLE_NAME || 'bingo-data-dev'; // Fallback to dev table name

// Map each waste type to its standard simulated weight in kilograms per household deposit
const ESTIMATED_WEIGHTS_KG: Record<WasteType, number> = { // Dictionary of estimated deposit weights
  wet: 1.5, // Wet/organic kitchen waste average deposit in kg
  sanitary: 0.5, // Sanitary waste average deposit in kg
  dry: 1.0, // Dry recyclable waste average deposit in kg
  furniture: 15.0, // Bulky furniture waste average deposit in kg
  event: 8.0, // Party or event waste average deposit in kg
}; // End of ESTIMATED_WEIGHTS_KG dictionary

// Helper function to return the estimated weight in kg for a given waste type
export function getEstimatedWeightKg(wasteType: WasteType): number { // Accepts waste category
  return ESTIMATED_WEIGHTS_KG[wasteType] ?? 1.0; // Return mapped weight or fallback to 1.0 kg
} // End of getEstimatedWeightKg function
