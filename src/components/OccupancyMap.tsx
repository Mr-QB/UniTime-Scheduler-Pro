
import React, { useState, useMemo } from 'react';
import { CourseData, RoomData } from '../types';
import { Search, AlertCircle, CheckCircle2, AlertTriangle, Info, Map as MapIcon } from 'lucide-react';
import { normalizeDay, getStartPeriod } from '../utils/validator';

interface OccupancyMapProps {
  courses: CourseData[];
  rooms: RoomData[];
}

const OccupancyMap: React.FC<OccupancyMapProps> = ({ courses, rooms }) => {
  const [searchTerm, setSearchTerm] = useState('');
  
  const days = ["2", "3", "4", "5", "6", "7"];
  const periods = ["1", "4", "7", "10"]; // Chỉ dùng tiết bắt đầu làm key
  const periodLabels: Record<string, string> = { "1": "1-3", "4": "4-6", "7": "7-9", "10": "10-12" };

  // Tổng hợp dữ liệu chiếm dụng chính xác dựa trên chuẩn hóa
  const occupancyData = useMemo(() => {
    const map = new Map<string, Map<string, CourseData[]>>();
    
    courses.forEach(c => {
      const rName = (c.suggestedRoom || c.room || "").trim().toLowerCase();
      if (!rName || rName === 'null' || rName === '') return;
      
      if (!map.has(rName)) map.set(rName, new Map());
      
      const day = normalizeDay(c.dayOfWeek);
      const startP = getStartPeriod(c.period);
      const slotKey = `${day}-${startP}`;
      
      if (!map.get(rName)!.has(slotKey)) map.get(rName)!.set(slotKey, []);
      map.get(rName)!.get(slotKey)!.push(c);
    });
    
    return map;
  }, [courses]);

  const filteredRooms = useMemo(() => 
    rooms.filter(r => r.roomName.toLowerCase().includes(searchTerm.toLowerCase())),
    [rooms, searchTerm]
  );

  return (
    <div className="flex flex-col h-full bg-white animate-in fade-in duration-500">
      <div className="px-6 py-4 border-b border-slate-100 flex flex-wrap items-center justify-between gap-4 bg-slate-50/50">
        <div className="flex items-center gap-4">
           <div className="p-2 bg-indigo-100 rounded-lg">
             <MapIcon className="w-4 h-4 text-indigo-600" />
           </div>
           <div>
             <h3 className="text-xs font-black text-slate-800 uppercase tracking-tight">Trạng thái lấp đầy</h3>
             <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest">Tự động cập nhật theo AI</p>
           </div>
        </div>

        <div className="relative w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
          <input 
            type="text" 
            placeholder="Tìm phòng (vd: G3-301)..." 
            className="w-full pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-[11px] font-medium focus:ring-2 focus:ring-indigo-500 outline-none transition-all shadow-sm"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
          />
        </div>
        
        <div className="flex flex-wrap gap-3">
           <LegendItem color="bg-emerald-500" label="Sẵn sàng" />
           <LegendItem color="bg-amber-500" label="Quá tải" />
           <LegendItem color="bg-red-500" label="Xung đột" />
           <LegendItem color="bg-white" border="border-slate-200" label="Trống" />
        </div>
      </div>

      <div className="flex-1 overflow-auto custom-scrollbar relative">
        <table className="w-full border-separate border-spacing-0">
          <thead className="sticky top-0 z-30">
            <tr>
              <th className="p-4 bg-slate-900 border-r border-b border-slate-700 min-w-[160px] text-left text-[10px] font-black text-slate-400 uppercase tracking-widest sticky left-0 z-40">
                Phòng / Thời gian
              </th>
              {days.map(day => (
                <th key={day} colSpan={4} className="border-r border-b border-slate-700 bg-slate-800 p-2 text-[10px] font-black text-slate-200 uppercase tracking-tighter text-center">
                  Thứ {day}
                </th>
              ))}
            </tr>
            <tr className="bg-slate-700">
              <th className="border-r border-b border-slate-600 sticky left-0 z-40 bg-slate-700"></th>
              {days.map(day => 
                periods.map(p => (
                  <th key={`${day}-${p}`} className="border-r border-b border-slate-600 p-1.5 text-[8px] font-black text-slate-400 min-w-[55px] text-center uppercase">
                    {periodLabels[p]}
                  </th>
                ))
              )}
            </tr>
          </thead>
          <tbody>
            {filteredRooms.map(room => {
              const rKey = room.roomName.toLowerCase();
              const roomOccupancy = occupancyData.get(rKey);

              return (
                <tr key={room.stt} className="group transition-colors hover:bg-slate-50">
                  <td className="p-3 border-r border-b border-slate-100 sticky left-0 bg-white z-20 group-hover:bg-slate-50 shadow-[2px_0_10px_rgba(0,0,0,0.03)]">
                    <div className="flex flex-col">
                      <span className="text-[11px] font-black text-slate-800 leading-tight">{room.roomName}</span>
                      <div className="flex items-center gap-1 mt-0.5">
                         <div className="w-1.5 h-1.5 rounded-full bg-indigo-400"></div>
                         <span className="text-[9px] text-slate-400 font-bold uppercase tracking-tighter">Sức chứa: {room.capacity}</span>
                      </div>
                    </div>
                  </td>
                  {days.map(day => 
                    periods.map(p => {
                      const slotKey = `${day}-${p}`;
                      const classesInSlot = roomOccupancy?.get(slotKey) || [];
                      
                      const hasConflict = classesInSlot.length > 1;
                      const hasOverload = classesInSlot.some(c => {
                         if (c.validationStatus === 'violated' && c.validationError?.includes('Quá tải')) return true;
                         return Number(c.registeredCount) > room.capacity;
                      });
                      
                      const verifiedClasses = classesInSlot.filter(c => c.validationStatus === 'verified' || !c.suggestedRoom);
                      const violatedClasses = classesInSlot.filter(c => c.validationStatus === 'violated');

                      let bgColor = "bg-white";
                      if (classesInSlot.length > 0) {
                        if (hasConflict) bgColor = "bg-red-500 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.2)]";
                        else if (hasOverload) bgColor = "bg-amber-500 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.2)]";
                        else bgColor = "bg-emerald-500 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.2)]";
                      }

                      return (
                        <td 
                          key={slotKey} 
                          className={`border-r border-b border-slate-100 p-0.5 group/cell relative h-12 transition-all ${bgColor === 'bg-white' ? 'hover:bg-indigo-50/50' : 'hover:scale-[1.02] hover:z-10'}`}
                        >
                          {classesInSlot.length > 0 && (
                            <div className={`w-full h-full rounded-sm flex items-center justify-center cursor-help transition-all ${bgColor}`}>
                               <span className="text-[10px] font-black text-white drop-shadow-sm">{classesInSlot.length}</span>
                               
                               {/* Tooltip Siêu cấp */}
                               <div className="invisible group-hover/cell:visible absolute bottom-full left-1/2 -translate-x-1/2 mb-3 w-72 p-0 bg-white rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.3)] z-[100] border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95">
                                  <div className="bg-slate-900 px-4 py-2.5 flex items-center justify-between">
                                     <span className="text-[10px] font-black text-indigo-400 uppercase tracking-widest">Thứ {day} | Tiết {periodLabels[p]}</span>
                                     {hasConflict && <AlertCircle className="w-3.5 h-3.5 text-red-400 animate-pulse" />}
                                  </div>
                                  <div className="p-2 space-y-2 max-h-64 overflow-y-auto custom-scrollbar">
                                    {classesInSlot.map((c, i) => (
                                      <div key={i} className={`p-2.5 rounded-xl border ${c.validationStatus === 'violated' ? 'bg-red-50 border-red-100' : 'bg-slate-50 border-slate-100'}`}>
                                        <div className="flex justify-between items-start mb-1">
                                           <p className="font-black text-slate-800 text-[10px] leading-snug flex-1 mr-2">{c.courseName}</p>
                                           <span className={`px-1.5 py-0.5 rounded text-[8px] font-black uppercase ${c.validationStatus === 'violated' ? 'bg-red-500 text-white' : 'bg-emerald-500 text-white'}`}>
                                              {c.validationStatus === 'violated' ? 'Lỗi' : 'OK'}
                                           </span>
                                        </div>
                                        <div className="flex justify-between text-[9px] font-bold text-slate-500 mb-1">
                                          <span>LHP: {c.sectionCode}</span>
                                          <span className={Number(c.registeredCount) > room.capacity ? 'text-red-500' : 'text-indigo-600'}>ĐK: {c.registeredCount}/{room.capacity}</span>
                                        </div>
                                        <p className="text-[8px] text-slate-400 truncate">GV: {c.lecturer}</p>
                                        {c.validationError && (
                                          <p className="mt-1 text-[8px] font-black text-red-600 flex items-center gap-1">
                                            <AlertTriangle className="w-2.5 h-2.5" /> {c.validationError}
                                          </p>
                                        )}
                                      </div>
                                    ))}
                                  </div>
                                  <div className="absolute top-full left-1/2 -translate-x-1/2 border-[8px] border-transparent border-t-white" />
                               </div>
                            </div>
                          )}
                        </td>
                      );
                    })
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

const LegendItem = ({ color, label, border = "" }: { color: string, label: string, border?: string }) => (
  <div className="flex items-center gap-2 px-3 py-1.5 bg-white rounded-lg border border-slate-200 shadow-sm">
    <div className={`w-2.5 h-2.5 rounded-full ${color} ${border}`}></div>
    <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">{label}</span>
  </div>
);

export default OccupancyMap;
