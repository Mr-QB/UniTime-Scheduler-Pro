
import React from 'react';
import { RoomData } from '../types';
import { Coffee, CheckCircle2, PieChart, Layout } from 'lucide-react';

interface RoomGridProps {
  data: RoomData[];
  roomUsageMap: Map<string, Set<string>>;
}

const RoomGrid: React.FC<RoomGridProps> = ({ data, roomUsageMap }) => {
  const headers = ['STT', 'Tên phòng', 'Sức chứa (SL)', 'Mức độ lấp đầy', 'Khả năng sử dụng'];
  const TOTAL_SLOTS = 24; // 6 ngày * 4 ca

  return (
    <div className="overflow-x-auto w-full max-h-[60vh] relative border-t border-slate-200">
      <table className="w-full border-collapse text-[12px] text-left">
        <thead className="sticky top-0 z-10 bg-slate-50 border-b border-slate-200">
          <tr>
            {headers.map((h, i) => (
              <th key={i} className="px-5 py-4 font-black text-slate-400 uppercase tracking-tighter whitespace-nowrap border-r border-slate-100 last:border-0 shadow-[0_1px_0_rgba(0,0,0,0.05)]">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 bg-white">
          {data.map((room, idx) => {
            const usedSlots = roomUsageMap.get(room.roomName.trim().toLowerCase())?.size || 0;
            const remainingSlots = TOTAL_SLOTS - usedSlots;
            const percentage = Math.round((usedSlots / TOTAL_SLOTS) * 100);
            const isFull = usedSlots >= TOTAL_SLOTS;
            const isUnused = usedSlots === 0;
            
            return (
              <tr 
                key={idx} 
                className={`transition-all hover:bg-slate-50 group ${isFull ? 'bg-red-50/20 opacity-80' : ''}`}
              >
                <td className="px-5 py-3.5 border-r border-slate-50 text-slate-400">{room.stt}</td>
                <td className={`px-5 py-3.5 border-r border-slate-50 font-black flex items-center gap-3 ${isFull ? 'text-red-600' : 'text-slate-800'}`}>
                   {room.roomName}
                </td>
                <td className="px-5 py-3.5 border-r border-slate-50 text-center font-black text-indigo-600">
                  {room.capacity}
                </td>
                <td className="px-5 py-3.5 border-r border-slate-50 min-w-[180px]">
                   <div className="flex items-center gap-3">
                      <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                         <div 
                           className={`h-full transition-all duration-500 ${percentage > 80 ? 'bg-red-500' : percentage > 50 ? 'bg-amber-500' : 'bg-emerald-500'}`}
                           style={{ width: `${percentage}%` }}
                         />
                      </div>
                      <span className="text-[10px] font-black text-slate-600 w-8">{percentage}%</span>
                   </div>
                </td>
                <td className="px-5 py-3.5">
                   {isFull ? (
                     <div className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-red-100 text-red-700 rounded-lg text-[9px] font-black uppercase tracking-tighter border border-red-200 shadow-sm">
                        <CheckCircle2 className="w-3 h-3" /> Hết chỗ (24/24)
                     </div>
                   ) : isUnused ? (
                     <div className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-emerald-50 text-emerald-600 rounded-lg text-[9px] font-black uppercase tracking-tighter border border-emerald-100 shadow-sm">
                        <Coffee className="w-3 h-3" /> Trống tuyệt đối
                     </div>
                   ) : (
                     <div className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-indigo-50 text-indigo-600 rounded-lg text-[9px] font-black uppercase tracking-tighter border border-indigo-100 shadow-sm">
                        <Layout className="w-3 h-3" /> Còn trống {remainingSlots} tiết
                     </div>
                   )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {data.length === 0 && (
        <div className="p-20 text-center">
           <div className="w-16 h-16 bg-slate-100 rounded-3xl flex items-center justify-center mx-auto mb-4 text-slate-300">
              <Coffee className="w-8 h-8" />
           </div>
           <p className="text-slate-400 font-bold tracking-tight">Không có dữ liệu phòng học.</p>
        </div>
      )}
    </div>
  );
};

export default RoomGrid;
