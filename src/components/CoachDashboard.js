import React from 'react';

const CoachDashboard = () => {
  return (
    <div className="mt-8 space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="p-6 bg-white rounded-lg shadow">
          <h3 className="text-lg font-semibold mb-2">Total Athletes</h3>
          <p className="text-3xl font-bold text-purple-600">0</p>
        </div>
        <div className="p-6 bg-white rounded-lg shadow">
          <h3 className="text-lg font-semibold mb-2">Active Today</h3>
          <p className="text-3xl font-bold text-green-600">0</p>
        </div>
        <div className="p-6 bg-white rounded-lg shadow">
          <h3 className="text-lg font-semibold mb-2">Pending Invites</h3>
          <p className="text-3xl font-bold text-orange-600">0</p>
        </div>
      </div>
      
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-xl font-semibold mb-4">Recent Activity</h3>
        <div className="space-y-4">
          <p className="text-gray-500 text-center py-4">No recent activity</p>
        </div>
      </div>
    </div>
  );
};

export default CoachDashboard;