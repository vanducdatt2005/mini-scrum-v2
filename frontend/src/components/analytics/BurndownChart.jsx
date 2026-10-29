import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

export default function BurndownChart({ data }) {
  if (!data || data.length === 0) {
    return (
      <div className="h-[400px] flex items-center justify-center text-on-surface-variant/50 font-medium">
        Không có dữ liệu cho Sprint này
      </div>
    );
  }

  return (
    <div className="w-full h-[400px]">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart
          data={data}
          margin={{ top: 20, right: 30, left: 20, bottom: 20 }}
        >
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e0e0e0" />
          <XAxis 
            dataKey="displayDate" 
            tick={{fontSize: 10, fill: '#666'}}
          />
          <YAxis tick={{fontSize: 12, fill: '#666'}} label={{ value: 'Points', angle: -90, position: 'insideLeft' }} />
          <Tooltip 
            contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
          />
          <Legend verticalAlign="top" height={36}/>
          <Line 
            type="monotone" 
            dataKey="ideal" 
            stroke="#94a3b8" 
            strokeDasharray="5 5" 
            name="Ideal Burndown" 
            dot={false}
            strokeWidth={2}
          />
          <Line 
            type="stepAfter" 
            dataKey="actual" 
            stroke="#006494" 
            strokeWidth={3} 
            name="Actual Remaining" 
            dot={{ r: 4, fill: '#006494' }}
            activeDot={{ r: 6 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
