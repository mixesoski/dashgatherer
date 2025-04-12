
/**
 * Utility to convert technical error messages and status codes into user-friendly messages
 */

type ErrorCode = 401 | 403 | 404 | 429 | 500 | number;

/**
 * Map HTTP status codes to user-friendly error messages
 */
export const statusCodeMessages: Record<ErrorCode, string> = {
  401: "Your login credentials have expired or are invalid. Please log in again.",
  403: "You don't have permission to access this resource or feature.",
  404: "The requested resource couldn't be found. Please try again later.",
  429: "Too many requests. Please wait a moment before trying again.",
  500: "There was a problem with our servers. Please try again later.",
};

/**
 * Get a user-friendly error message based on the error status code or message
 */
export const getUserFriendlyErrorMessage = (error: any): string => {
  // Handle HTTP status codes
  if (error?.status || error?.statusCode) {
    const statusCode = error.status || error.statusCode;
    if (statusCodeMessages[statusCode]) {
      return statusCodeMessages[statusCode];
    }
  }

  // Handle specific error messages
  const errorMessage = error?.message || error?.error || String(error);
  
  // Garmin-specific errors
  if (errorMessage.includes("Garmin") && errorMessage.includes("credentials")) {
    return "Your Garmin Connect credentials are incorrect or have expired. Please update them and try again.";
  }
  
  if (errorMessage.includes("Garmin") && errorMessage.includes("rate limit")) {
    return "Garmin Connect is limiting requests. Please wait a few minutes before trying again.";
  }

  if (errorMessage.includes("insufficient_permissions") || 
      errorMessage.includes("Permission denied")) {
    return "You don't have permission to perform this action. Please contact support if you think this is a mistake.";
  }

  if (errorMessage.includes("timeout") || 
      errorMessage.includes("timed out")) {
    return "The request took too long to complete. Please check your network connection and try again.";
  }

  if (errorMessage.includes("Failed to fetch") || 
      errorMessage.includes("Network error")) {
    return "Network connection error. Please check your internet connection and try again.";
  }

  // Default message for other errors
  return "Something went wrong. Please try again later.";
};
