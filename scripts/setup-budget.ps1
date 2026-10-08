# PowerShell script to create an AWS Budgets spending alarm to protect $100 hackathon credits
[CmdletBinding()] # Enable standard advanced PowerShell cmdlet features
param( # Define script parameters
  [Parameter(Mandatory = $true, HelpMessage = "Enter your notification email address")] # Make email mandatory
  [string]$AlertEmail # User email address where budget alert notifications will be delivered
) # End of parameter block

# Set PowerShell to terminate immediately on encountering any unhandled error
$ErrorActionPreference = "Stop" # Halt execution on error

# Output status message indicating start of budget setup
Write-Host ">>> Checking AWS authentication and account ID..." -ForegroundColor Cyan # Cyan status message

# Retrieve the AWS 12-digit account ID for the currently authenticated profile
$AccountId = aws sts get-caller-identity --query "Account" --output text # Call AWS STS to get account ID

# Validate that a valid 12-digit account ID was retrieved
if (-not $AccountId -or $AccountId -match "None") { # Check if account ID is empty or invalid
  # Display fatal error message if AWS credentials are not configured
  Write-Error "Failed to retrieve AWS Account ID. Please run 'aws configure' first." # Error message
  # Exit script with non-zero error status code
  exit 1 # Exit with error
} # End of account ID check

# Display confirmation of resolved AWS Account ID
Write-Host "Target AWS Account ID: $AccountId" -ForegroundColor Green # Display account ID in green

# Display notification email being configured
Write-Host "Alert Notification Email: $AlertEmail" -ForegroundColor Green # Display alert email in green

# Define the temporary file path for storing the budget JSON configuration
$BudgetConfigPath = "$PSScriptRoot\temp-budget-config.json" # Path to temporary budget configuration JSON

# Define the temporary file path for storing the notifications JSON configuration
$NotificationsConfigPath = "$PSScriptRoot\temp-notifications-config.json" # Path to temporary notifications JSON

# Define the budget configuration payload setting a $100 monthly limit
$BudgetConfig = @{ # PowerShell hashtable for budget definition
  BudgetName = "BinGo-Credits-Guard-100USD" # Unique name for the budget
  BudgetLimit = @{ # Budget limit specification
    Amount = "100" # Budget cap amount in US Dollars
    Unit = "USD" # Currency unit
  } # End of BudgetLimit
  TimeUnit = "MONTHLY" # Budget evaluation window repeats monthly
  BudgetType = "COST" # Track monetary cost rather than usage units
} # End of BudgetConfig hashtable

# Convert budget hashtable to clean JSON string without BOM
$BudgetJson = $BudgetConfig | ConvertTo-Json -Depth 5 # Generate JSON string
# Write JSON to file with ASCII encoding to prevent UTF-8 BOM characters that break AWS CLI
[System.IO.File]::WriteAllText($BudgetConfigPath, $BudgetJson) # Write BOM-free file

# Define the notification configuration triggering when actual spend crosses 80% ($80)
$NotificationsConfig = @( # Array of notification definitions
  @{ # First notification rule: Actual spend exceeds 80% ($80)
    Notification = @{ # Notification trigger criteria
      NotificationType = "ACTUAL" # Trigger based on actual recorded billing spend
      ComparisonOperator = "GREATER_THAN" # Fire when spend is greater than threshold
      Threshold = 80 # 80 percent threshold
      ThresholdType = "PERCENTAGE" # Threshold specified as percentage
    } # End of Notification
    Subscribers = @( # List of notification recipients
      @{ # Subscriber configuration
        SubscriptionType = "EMAIL" # Deliver notification via email
        Address = $AlertEmail # Destination email address
      } # End of Subscriber
    ) # End of Subscribers array
  }, # End of first notification rule
  @{ # Second notification rule: Forecasted spend projected to exceed 100% ($100)
    Notification = @{ # Notification trigger criteria
      NotificationType = "FORECASTED" # Trigger early if projected to breach budget
      ComparisonOperator = "GREATER_THAN" # Fire when projection is greater than threshold
      Threshold = 100 # 100 percent threshold
      ThresholdType = "PERCENTAGE" # Percentage threshold
    } # End of Notification
    Subscribers = @( # List of notification recipients
      @{ # Subscriber configuration
        SubscriptionType = "EMAIL" # Deliver notification via email
        Address = $AlertEmail # Destination email address
      } # End of Subscriber
    ) # End of Subscribers array
  } # End of second notification rule
) # End of NotificationsConfig array

# Convert notifications array to clean JSON string without BOM
$NotificationsJson = $NotificationsConfig | ConvertTo-Json -Depth 5 # Generate JSON string
# Write notifications JSON to file without BOM
[System.IO.File]::WriteAllText($NotificationsConfigPath, $NotificationsJson) # Write BOM-free file

# Display status message before executing AWS CLI command
Write-Host ">>> Registering budget with AWS Budgets API..." -ForegroundColor Cyan # Cyan status message

# Execute AWS CLI command to create the budget with notification rules attached
aws budgets create-budget `
  --account-id $AccountId `
  --budget "file://$BudgetConfigPath" `
  --notifications-with-subscribers "file://$NotificationsConfigPath" # Execute create-budget

# Check exit code of AWS CLI command to verify success
if ($LASTEXITCODE -eq 0) { # If command succeeded
  # Display completion message with verification instructions
  Write-Host ">>> Budget alarm successfully created!" -ForegroundColor Green # Green success message
  # Instruct user to confirm the email subscription in their inbox
  Write-Host "AWS sent a confirmation email to $AlertEmail. Please click confirm subscription in your inbox." -ForegroundColor Yellow # Alert user
} else { # If command failed
  # Display error message indicating failure
  Write-Host ">>> AWS Budgets API returned an error code: $LASTEXITCODE" -ForegroundColor Red # Red error message
} # End of exit code check

# Remove temporary configuration JSON files from disk
Remove-Item -Path $BudgetConfigPath -Force -ErrorAction SilentlyContinue # Delete temporary budget file
# Remove temporary notifications configuration file from disk
Remove-Item -Path $NotificationsConfigPath -Force -ErrorAction SilentlyContinue # Delete temporary notifications file
