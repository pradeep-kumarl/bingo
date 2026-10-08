// Import the DynamoDB Document Client PutCommand for writing seed items
import { PutCommand } from '@aws-sdk/lib-dynamodb'; // AWS SDK v3 PutCommand

// Import the preconfigured document client and target table name from shared DB module
import { docClient, TABLE_NAME } from '../shared/db'; // Shared database connection instance and table name

// Define the structured interface for seed data items to ensure proper typing
interface SeedItem { // Interface defining generic DynamoDB item with string index signature
  [key: string]: any; // Allow arbitrary attributes matching DynamoDB item structure
} // End of SeedItem interface

// List of all mock entities to populate the BinGo DynamoDB table for demonstration
const SEED_DATA: SeedItem[] = [ // Array of comprehensive seed records
  // --- ZONES ---
  { // Seed Zone 1: Koramangala 4th Block
    PK: 'ZONE#zone-koramangala-4', // Primary partition key for zone
    SK: 'METADATA', // Sort key indicating metadata
    GSI1PK: 'CITY#bengaluru', // GSI1 partition key for querying all zones in city
    GSI1SK: 'ZONE#zone-koramangala-4', // GSI1 sort key
    zoneId: 'zone-koramangala-4', // Unique zone identifier
    name: 'Koramangala 4th Block Hub', // Display name of the designated waste zone
    ward: 'Ward 151', // Municipal ward number
    location: { lat: 12.9352, lng: 77.6245 }, // Geographic coordinates of the physical collection zone
    totalHouseholds: 180, // Total residential units registered in this block
    activeVehicles: 5, // All 5 specialized vehicles actively stationed
  }, // End of Zone 1
  { // Seed Zone 2: Indiranagar 100ft Road
    PK: 'ZONE#zone-indiranagar-1', // Primary partition key for second zone
    SK: 'METADATA', // Sort key indicating metadata
    GSI1PK: 'CITY#bengaluru', // GSI1 partition key
    GSI1SK: 'ZONE#zone-indiranagar-1', // GSI1 sort key
    zoneId: 'zone-indiranagar-1', // Unique zone identifier
    name: 'Indiranagar 100ft Rd Hub', // Display name of second zone
    ward: 'Ward 82', // Municipal ward number
    location: { lat: 12.9716, lng: 77.6412 }, // Geographic coordinates
    totalHouseholds: 220, // Registered households
    activeVehicles: 5, // Active vehicles count
  }, // End of Zone 2

  // --- VEHICLES (Koramangala Zone - 5 Waste Streams) ---
  { // Vehicle 1: Wet Waste (73.5% load - 1 scan away from triggering the 75% swap alert)
    PK: 'ZONE#zone-koramangala-4', // Zone partition key
    SK: 'VEHICLE#wet', // Sort key by waste stream
    GSI1PK: 'VEHICLE#VH-WET-01', // GSI1 partition key for fleet lookup
    GSI1SK: 'METADATA', // GSI1 sort key
    vehicleId: 'VH-WET-01', // Vehicle registration identifier
    bayId: 'bay-wet-01', // Assigned vehicle bay identifier
    zoneId: 'zone-koramangala-4', // Stationed zone
    wasteType: 'wet', // Designated waste category
    capacityKg: 1000, // Maximum rated weight capacity in kg
    currentLoadKg: 735, // Current simulated weight in kg (73.5%)
    fillPercentage: 73.5, // Current percentage fill
    status: 'active', // Vehicle status active and receiving waste
    lastSwapTimestamp: new Date(Date.now() - 36000000).toISOString(), // Swapped 10 hours ago
  }, // End of Wet Vehicle
  { // Vehicle 2: Sanitary Waste
    PK: 'ZONE#zone-koramangala-4', // Zone partition key
    SK: 'VEHICLE#sanitary', // Sort key by waste stream
    GSI1PK: 'VEHICLE#VH-SAN-01', // GSI1 partition key
    GSI1SK: 'METADATA', // GSI1 sort key
    vehicleId: 'VH-SAN-01', // Vehicle registration identifier
    bayId: 'bay-sanitary-01', // Assigned vehicle bay identifier
    zoneId: 'zone-koramangala-4', // Stationed zone
    wasteType: 'sanitary', // Designated waste category
    capacityKg: 500, // Maximum capacity in kg
    currentLoadKg: 190, // Current load in kg
    fillPercentage: 38.0, // Current fill percentage
    status: 'active', // Operational status
    lastSwapTimestamp: new Date(Date.now() - 86400000).toISOString(), // Swapped 24 hours ago
  }, // End of Sanitary Vehicle
  { // Vehicle 3: Dry Waste
    PK: 'ZONE#zone-koramangala-4', // Zone partition key
    SK: 'VEHICLE#dry', // Sort key by waste stream
    GSI1PK: 'VEHICLE#VH-DRY-01', // GSI1 partition key
    GSI1SK: 'METADATA', // GSI1 sort key
    vehicleId: 'VH-DRY-01', // Vehicle registration identifier
    bayId: 'bay-dry-01', // Assigned vehicle bay identifier
    zoneId: 'zone-koramangala-4', // Stationed zone
    wasteType: 'dry', // Designated waste category
    capacityKg: 1200, // Maximum capacity in kg
    currentLoadKg: 620, // Current load in kg
    fillPercentage: 51.7, // Current fill percentage
    status: 'active', // Operational status
    lastSwapTimestamp: new Date(Date.now() - 43200000).toISOString(), // Swapped 12 hours ago
  }, // End of Dry Vehicle
  { // Vehicle 4: Furniture Waste (Bulky)
    PK: 'ZONE#zone-koramangala-4', // Zone partition key
    SK: 'VEHICLE#furniture', // Sort key by waste stream
    GSI1PK: 'VEHICLE#VH-FURN-01', // GSI1 partition key
    GSI1SK: 'METADATA', // GSI1 sort key
    vehicleId: 'VH-FURN-01', // Vehicle registration identifier
    bayId: 'bay-furniture-01', // Assigned vehicle bay identifier
    zoneId: 'zone-koramangala-4', // Stationed zone
    wasteType: 'furniture', // Designated waste category
    capacityKg: 2000, // Maximum capacity in kg
    currentLoadKg: 450, // Current load in kg
    fillPercentage: 22.5, // Current fill percentage
    status: 'active', // Operational status
    lastSwapTimestamp: new Date(Date.now() - 172800000).toISOString(), // Swapped 2 days ago
  }, // End of Furniture Vehicle
  { // Vehicle 5: Event & Party Waste
    PK: 'ZONE#zone-koramangala-4', // Zone partition key
    SK: 'VEHICLE#event', // Sort key by waste stream
    GSI1PK: 'VEHICLE#VH-EVNT-01', // GSI1 partition key
    GSI1SK: 'METADATA', // GSI1 sort key
    vehicleId: 'VH-EVNT-01', // Vehicle registration identifier
    bayId: 'bay-event-01', // Assigned vehicle bay identifier
    zoneId: 'zone-koramangala-4', // Stationed zone
    wasteType: 'event', // Designated waste category
    capacityKg: 1500, // Maximum capacity in kg
    currentLoadKg: 320, // Current load in kg
    fillPercentage: 21.3, // Current fill percentage
    status: 'active', // Operational status
    lastSwapTimestamp: new Date(Date.now() - 129600000).toISOString(), // Swapped 1.5 days ago
  }, // End of Event Vehicle

  // --- HOUSEHOLDS ---
  { // Household 1: Priya Sharma (4 of 5 squares done; 1 scan away from completing BinGo!)
    PK: 'HOUSEHOLD#HH-101', // Partition key
    SK: 'PROFILE', // Sort key
    GSI1PK: 'ZONE#zone-koramangala-4', // Zone lookup
    GSI1SK: 'HOUSEHOLD#HH-101', // Sort key in zone index
    householdId: 'HH-101', // Household identifier used for login & demo
    residentName: 'Priya Sharma', // Resident full name
    zoneId: 'zone-koramangala-4', // Assigned zone
    address: 'Flat 302, Palm Heights, Koramangala 4th Block', // Residential address
    isOutOfStation: false, // In town and active
    wellnessOptIn: true, // Opted in to wellness checks
    emergencyContact: { name: 'Vikram Sharma', phone: '+91-9876543210' }, // Emergency contact details
    lastActiveDate: new Date().toISOString().split('T')[0], // Active today
    streakDays: 6, // 6-day streak
    cardProgress: { wet: false, sanitary: true, dry: true, furniture: true, event: true }, // Needs wet for BinGo!
  }, // End of Household 1
  { // Household 2: Devika Menon (New resident, normal participation)
    PK: 'HOUSEHOLD#HH-102', // Partition key
    SK: 'PROFILE', // Sort key
    GSI1PK: 'ZONE#zone-koramangala-4', // Zone lookup
    GSI1SK: 'HOUSEHOLD#HH-102', // Sort key in zone index
    householdId: 'HH-102', // Household identifier
    residentName: 'Devika Menon', // Resident name
    zoneId: 'zone-koramangala-4', // Assigned zone
    address: 'House #45, 7th Cross, Koramangala 4th Block', // Address
    isOutOfStation: false, // In town
    wellnessOptIn: false, // Not opted into wellness
    lastActiveDate: new Date().toISOString().split('T')[0], // Active today
    streakDays: 3, // 3-day streak
    cardProgress: { wet: true, sanitary: false, dry: true, furniture: false, event: false }, // 2 squares done
  }, // End of Household 2
  { // Household 3: Kabir Mehta (Out of station - demonstrates absence toggle)
    PK: 'HOUSEHOLD#HH-103', // Partition key
    SK: 'PROFILE', // Sort key
    GSI1PK: 'ZONE#zone-koramangala-4', // Zone lookup
    GSI1SK: 'HOUSEHOLD#HH-103', // Sort key in zone index
    householdId: 'HH-103', // Household identifier
    residentName: 'Kabir Mehta', // Resident name
    zoneId: 'zone-koramangala-4', // Assigned zone
    address: 'Villa 12, Green Acres, Koramangala 4th Block', // Address
    isOutOfStation: true, // Marked out of station; suppresses wellness check-in triggers
    wellnessOptIn: true, // Opted in to wellness
    emergencyContact: { name: 'Anita Mehta', phone: '+91-9811223344' }, // Contact info
    lastActiveDate: new Date(Date.now() - 432000000).toISOString().split('T')[0], // Last active 5 days ago
    streakDays: 0, // Streak paused
    cardProgress: { wet: false, sanitary: false, dry: false, furniture: false, event: false }, // Reset card
  }, // End of Household 3
  { // Household 4: Lakshmi Narayanan (Elderly resident, silent 3 days - demonstrates opt-in wellness check-in)
    PK: 'HOUSEHOLD#HH-104', // Partition key
    SK: 'PROFILE', // Sort key
    GSI1PK: 'ZONE#zone-koramangala-4', // Zone lookup
    GSI1SK: 'HOUSEHOLD#HH-104', // Sort key in zone index
    householdId: 'HH-104', // Household identifier
    residentName: 'Lakshmi Narayanan', // Resident name
    zoneId: 'zone-koramangala-4', // Assigned zone
    address: 'Apt 101, Shanti Niketan, Koramangala 4th Block', // Address
    isOutOfStation: false, // Not marked out of station
    wellnessOptIn: true, // Consent-first opt-in confirmed
    emergencyContact: { name: 'Rohan Narayanan (Son)', phone: '+91-9988776655' }, // Contact info
    lastActiveDate: new Date(Date.now() - 259200000).toISOString().split('T')[0], // Silent for 3 days
    streakDays: 0, // Streak reset
    cardProgress: { wet: false, sanitary: false, dry: false, furniture: false, event: false }, // Inactive card
  }, // End of Household 4

  // --- DEMO SWAP ALERT (Simulated - Indiranagar Zone) ---
  { // Alert demonstrating vehicle swap notifications on the dashboard
    PK: 'ZONE#zone-indiranagar-1', // Zone partition key
    SK: `ALERT#${new Date(Date.now() - 1800000).toISOString()}#dry`, // Sort key timestamped 30 mins ago
    GSI1PK: 'ALERT#STATUS', // GSI1 partition key for querying pending alerts
    GSI1SK: `ACTIVE#${new Date(Date.now() - 1800000).toISOString()}`, // Active alert index
    zoneId: 'zone-indiranagar-1', // Zone affected
    wasteType: 'dry', // Waste category requiring swap
    vehicleId: 'VH-DRY-02', // Vehicle identifier
    fillPercentage: 78.4, // Reached 78.4% capacity
    status: 'PENDING', // Pending dispatch of replacement vehicle
    simulated: true, // Transparently labelled as simulated per competition requirements
    createdAt: new Date(Date.now() - 1800000).toISOString(), // Alert creation timestamp
  }, // End of Demo Alert
]; // End of SEED_DATA array

// Main execution function to write all seed records into DynamoDB
export async function runSeed(): Promise<void> { // Asynchronous seeder runner
  console.log(`Starting BinGo database seed into table: ${TABLE_NAME}`); // Log starting status
  let insertedCount = 0; // Initialize counter for successful writes
  for (const item of SEED_DATA) { // Iterate through each seed item sequentially
    try { // Wrap each write in a try-catch to report individual item outcomes
      await docClient.send(new PutCommand({ // Execute DynamoDB PutCommand
        TableName: TABLE_NAME, // Target table name
        Item: item, // Put complete item attributes
      })); // End of PutCommand send
      insertedCount++; // Increment successful write counter
      console.log(`[SEED OK] Inserted ${item.PK} / ${item.SK}`); // Log successful insertion
    } catch (err) { // Catch write error
      console.error(`[SEED ERROR] Failed to insert ${item.PK} / ${item.SK}:`, err); // Log error
    } // End of catch
  } // End of for loop
  console.log(`Seeding complete! Successfully loaded ${insertedCount}/${SEED_DATA.length} records.`); // Final log
} // End of runSeed function

// Automatically invoke runSeed if this file is executed directly via command line
if (require.main === module) { // Check if executed as main entry script
  runSeed().catch((err) => { // Run seeder and catch unhandled rejection
    console.error('Fatal error during seed execution:', err); // Log fatal error
    process.exit(1); // Exit process with non-zero failure code
  }); // End of catch handler
} // End of execution check
