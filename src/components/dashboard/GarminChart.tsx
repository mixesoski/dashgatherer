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
  Filler,
  InteractionMode
} from 'chart.js';
import { Button } from "@/components/ui/button";
import { RefreshCw } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { format } from "date-fns";
import { useState } from "react";

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
  atl: number | null;
  ctl: number | null;
  tsb: number | null;
}

interface Props {
  data: GarminData[];
  email: string;
  onUpdate: () => Promise<void>;
  isUpdating?: boolean;
}

export const GarminChart = ({ data, email, onUpdate, isUpdating }: Props) => {
  const [visibleActivities, setVisibleActivities] = useState(10);

  console.log('GarminChart data:', data);
  
  // Sort data from oldest to newest for the chart
  const sortedData = [...data].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  console.log('Sorted data:', sortedData);
  
  // For the table and stats, we want the newest data first
  const reverseSortedData = [...sortedData].reverse();
  const latestData = reverseSortedData[0];
  console.log('Latest data:', latestData);
  
  // Get visible activities
  const visibleDays = reverseSortedData.slice(0, visibleActivities);
  
  // Check if there are more activities to load
  const hasMoreActivities = visibleActivities < reverseSortedData.length;

  const handleLoadMore = () => {
    setVisibleActivities(prev => prev + 10);
  };
  
  // Get TSB value safely using optional chaining
  const tsb = latestData?.tsb;
  const status = (tsb !== undefined && tsb !== null)
    ? (tsb < 0 ? 'Zmęczenie' : 'Wypoczęty')
    : 'No data';

  // Helper function to determine TSB status and color
  const getTsbStatus = (tsb: number | null | undefined) => {
    if (tsb === undefined || tsb === null) return { text: 'No data', color: 'text-gray-500' };
    
    if (tsb < -70) return { text: 'Bardzo duże zmęczenie', color: 'text-red-700' };
    if (tsb < 0) return { text: 'Zmęczenie', color: 'text-red-500' };
    if (tsb >= 0 && tsb <= 30) return { text: 'Optymalna forma', color: 'text-green-600' };
    return { text: 'Wypoczęty', color: 'text-blue-600' };
  };

  const chartData = {
    labels: sortedData.map(d => format(new Date(d.date), 'dd/MM/yyyy')),
    datasets: [
      {
        label: 'Acute Load (ATL)',
        data: sortedData.map(d => d.atl ?? 0),
        borderColor: 'rgb(59, 130, 246)', // Blue
        backgroundColor: 'rgba(59, 130, 246, 0.1)',
        fill: true,
        tension: 0.4,
      },
      {
        label: 'Stress Balance (TSB)',
        data: sortedData.map(d => d.tsb ?? 0),
        borderColor: 'rgb(239, 68, 68)', // Red
        backgroundColor: 'rgba(239, 68, 68, 0.1)',
        fill: true,
        tension: 0.4,
      },
      {
        label: 'Chronic Load (CTL)',
        data: sortedData.map(d => d.ctl ?? 0),
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
      mode: 'index' as InteractionMode
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div className="flex flex-col">
          <h2 className="text-2xl font-bold">{email}</h2>
          <p className="text-gray-600">Training load balance over time</p>
        </div>
        <Button 
          variant="outline" 
          size="sm" 
          onClick={onUpdate}
          disabled={isUpdating}
          className="gap-2"
        >
          <RefreshCw className={`h-4 w-4 ${isUpdating ? 'animate-spin' : ''}`} />
          Update Chart
        </Button>
      </div>
      
      {/* Stats Card - Now above the chart */}
      <div className="bg-white/90 backdrop-blur-sm rounded-lg p-3 border shadow-sm w-72 ml-auto">
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="font-medium">Status:</span>
            <span className={`${getTsbStatus(latestData?.tsb).color} font-semibold`}>
              {getTsbStatus(latestData?.tsb).text}
            </span>
          </div>
          
          <div className="grid grid-cols-3 gap-2 text-xs">
            <div className="flex flex-col items-center">
              <span className="text-blue-600 font-medium whitespace-nowrap">ATL</span>
              <span className="text-sm">{latestData?.atl?.toFixed(1) ?? 'N/A'}</span>
              <span className="text-[10px] text-gray-500">Zmęczenie</span>
            </div>
            <div className="flex flex-col items-center">
              <span className="text-yellow-600 font-medium whitespace-nowrap">CTL</span>
              <span className="text-sm">{latestData?.ctl?.toFixed(1) ?? 'N/A'}</span>
              <span className="text-[10px] text-gray-500">Wydolność</span>
            </div>
            <div className="flex flex-col items-center">
              <span className="text-red-600 font-medium whitespace-nowrap">TSB</span>
              <span className="text-sm">{latestData?.tsb?.toFixed(1) ?? 'N/A'}</span>
              <span className="text-[10px] text-gray-500">Forma</span>
            </div>
          </div>
          
          <div className="text-center text-[10px] text-gray-500 pt-1 border-t">
            {new Date(latestData?.date ?? '').toLocaleDateString()}
          </div>
        </div>
      </div>

      {/* Chart */}
      <div className="w-full h-[600px] bg-white rounded-lg p-6 shadow-sm">
        <Line data={chartData} options={options} />
      </div>

      {/* Recent Activities Table */}
      <div className="bg-white rounded-lg shadow-sm p-6">
        <h3 className="text-lg font-semibold mb-4">Recent Activities</h3>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Activity</TableHead>
              <TableHead className="text-right">TRIMP</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {visibleDays.map((day) => (
              <TableRow key={day.date}>
                <TableCell>{format(new Date(day.date), 'dd/MM/yyyy')}</TableCell>
                <TableCell>{day.activity}</TableCell>
                <TableCell className="text-right">{day.trimp.toFixed(1)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        
        {hasMoreActivities && (
          <div className="mt-4 flex justify-center">
            <Button 
              variant="outline"
              onClick={handleLoadMore}
              className="w-full sm:w-auto"
            >
              Load More Activities
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};
