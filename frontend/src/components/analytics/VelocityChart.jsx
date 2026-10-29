import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

export default function VelocityChart({ data }) {
  if (!data || data.length === 0) {
    return (
      <div className="h-[400px] flex items-center justify-center text-on-surface-variant/50 font-medium">
        Cần ít nhất 1 Sprint đã hoàn thành để xem Velocity
      </div>
    );
  }

  return (
    <div className="w-full h-[400px]">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={data}
          margin={{ top: 20, right: 30, left: 20, bottom: 20 }}
        >
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e0e0e0" />
          <XAxis dataKey="name" tick={{fontSize: 12, fill: '#666'}} />
          <YAxis tick={{fontSize: 12, fill: '#666'}} label={{ value: 'Story Points', angle: -90, position: 'insideLeft' }} />
          <Tooltip 
            cursor={{fill: '#f1f5f9'}}
            contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }} 
          />
          <Legend verticalAlign="top" height={36}/>
          <Bar dataKey="commitment" name="Commitment" fill="#94a3b8" radius={[4, 4, 0, 0]} barSize={40} />
          <Bar dataKey="completed" name="Completed" fill="#006494" radius={[4, 4, 0, 0]} barSize={40} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
