// Map subscription plan IDs to human-readable names
const PLAN_NAMES: Record<string, string> = {
  // Athlete plans
  'athlete_monthly': 'Athlete Monthly',
  'athlete_yearly': 'Athlete Yearly',
  'Price_1QyVpuRWXngc5iLEahZAAups': 'Athlete Plan',
  
  // Coach plans
  'coach': 'Coach Plan',
  
  // Organization plans
  'organization': 'Organization Plan'
};

/**
 * Converts a technical plan ID to a human-readable name
 * @param planId The technical plan ID from Stripe or the database
 * @returns A user-friendly plan name
 */
export const getPlanName = (planId: string | null): string => {
  if (!planId) return 'No Plan';
  
  // First, check our mapping
  const name = PLAN_NAMES[planId];
  if (name) return name;
  
  // If not found, apply some basic formatting
  // For example, convert "athlete_monthly" to "Athlete Monthly"
  return planId
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}; 