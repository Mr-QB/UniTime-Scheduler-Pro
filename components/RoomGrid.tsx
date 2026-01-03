
import React from 'react';
import { RoomData } from '../types';

interface RoomGridProps {
  data: RoomData[];
}

const RoomGrid: React.FC<RoomGridProps> = ({ data }) => {
  const headers = ['STT', 'Tên phòng', 'Sức chứa (SL)'];

  return (
    <div className="overflow-x-auto w-full max-h-[60vh]">
      <table className="w-full border-collapse text-sm text-left">
        <thead className="sticky top-0 z-10 bg-slate-100 border-b border-slate-200">
          <tr>
            {headers.map((h, i) => (
              <th key={i} className="px-4 py-3 font-semibold text-slate-600 whitespace-nowrap border-r border-slate-200 last:border-0">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {data.map((room, idx) => (
            <tr key={idx} className="transition-colors hover:bg-slate-50">
              <td className="px-4 py-3 border-r border-slate-100 text-slate-500">{room.stt}</td>
              <td className="px-4 py-3 border-r border-slate-100 font-bold text-slate-800">{room.roomName}</td>
              <td className="px-4 py-3 border-r border-slate-100 text-center font-medium text-indigo-600">{room.capacity}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {data.length === 0 && (
        <div className="p-12 text-center text-slate-400 italic">
          Không có dữ liệu phòng học.
        </div>
      )}
    </div>
  );
};

export default RoomGrid;
