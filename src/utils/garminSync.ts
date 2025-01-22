export const syncGarmin = async (userId: string, startDate?: string) => {
  const response = await fetch('/api/sync-garmin', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      userId,
      startDate,
    }),
  });

  if (!response.ok) {
    throw new Error('Failed to sync Garmin data');
  }

  return response.json();
};

export const updateChart = async (userId: string, startDate?: string) => {
  const response = await fetch('/api/update-chart', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      userId,
      startDate,
    }),
  });

  if (!response.ok) {
    throw new Error('Failed to update chart');
  }

  return response.json();
}; 