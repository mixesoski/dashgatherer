import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
} from 'chart.js';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

interface GarminData {
  date: string;
  trimp: number;
  activity: string;
  atl: number;
  ctl: number;
  tsb: number;
}

interface Props {
  data: GarminData[];
  email: string;
}

export const GarminChart = ({ data, email }: Props) => {
  const sortedData = [...data].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  
  const latestData = sortedData[sortedData.length - 1];
  const status = latestData.tsb < 0 ? 'Zmęczenie' : 'Wypoczęty';
  
  const chartData = {
    labels: sortedData.map(d => new Date(d.date).toLocaleDateString()),
    datasets: [
      {
        label: 'Acute Load (ATL)',
        data: sortedData.map(d => d.atl),
        borderColor: 'rgb(59, 130, 246)', // Blue
        backgroundColor: 'rgba(59, 130, 246, 0.1)',
        fill: true,
        tension: 0.4,
      },
      {
        label: 'Stress Balance (TSB)',
        data: sortedData.map(d => d.tsb),
        borderColor: 'rgb(239, 68, 68)', // Red
        backgroundColor: 'rgba(239, 68, 68, 0.1)',
        fill: true,
        tension: 0.4,
      },
      {
        label: 'Chronic Load (CTL)',
        data: sortedData.map(d => d.ctl),
        borderColor: 'rgb(234, 179, 8)', // Yellow
        backgroundColor: 'rgba(234, 179, 8, 0.1)',
        fill: true,
        tension: 0.4,
      }
    ]
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'bottom' as const,
        labels: {
          usePointStyle: true,
          padding: 20,
          font: {
            family: 'Inter'
          }
        },
      },
      title: {
        display: true,
        text: 'Performance Metrics',
        align: 'start' as const,
        padding: {
          bottom: 30
        },
        font: {
          size: 24,
          weight: 'bold' as const,
          family: 'Inter'
        }
      },
    },
    scales: {
      x: {
        grid: {
          display: true,
          color: 'rgba(0, 0, 0, 0.05)'
        },
        ticks: {
          maxRotation: 45,
          minRotation: 45,
          font: {
            family: 'Inter'
          }
        }
      },
      y: {
        grid: {
          display: true,
          color: 'rgba(0, 0, 0, 0.05)'
        },
        ticks: {
          callback: (value: number) => Math.round(value * 10) / 10,
          font: {
            family: 'Inter'
          }
        }
      }
    },
    elements: {
      point: {
        radius: 0
      },
      line: {
        borderWidth: 2
      }
    },
    interaction: {
      intersect: false,
      mode: 'index'
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col space-y-2">
        <h2 className="text-2xl font-bold">{email}</h2>
        <p className="text-gray-600">Training load balance over time</p>
      </div>
      
      <div className="bg-orange-50 rounded-lg p-4 border border-orange-100">
        <div className="flex items-center space-x-2">
          <svg className="w-5 h-5 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
          <span className="font-medium text-orange-800">{status}</span>
        </div>
        <div className="mt-2 text-sm text-orange-700">
          TSB: {latestData.tsb.toFixed(1)} | CTL: {latestData.ctl.toFixed(1)}
          <br />
          Data: {new Date(latestData.date).toLocaleDateString()}
        </div>
      </div>

      <div className="w-full h-[600px] bg-white rounded-lg p-6 shadow-sm">
        <Line data={chartData} options={options} />
      </div>
    </div>
  );
};