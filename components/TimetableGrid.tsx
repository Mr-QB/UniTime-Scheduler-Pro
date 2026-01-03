
import React from 'react';
import { CourseData } from '../types';
import { AlertCircle, Sparkles, ArrowRight, ShieldCheck, ShieldAlert, Info, AlertOctagon, HelpCircle } from 'lucide-react';

interface TimetableGridProps {
  data: CourseData[];
}

const TimetableGrid: React.FC<TimetableGridProps> = ({ data }) => {
  const headers = [
    'STT', 'Mã HP', 'Tên học phần', 'Số TC', 'Mã LHP', 
    'Giảng viên', 'SV', 'ĐK', 'Thứ', 'Tiết', 
    'Giảng đường', 'Xác minh bởi Code'
  ];

  return (
    <div className="overflow-x-auto w-full max-h-[60vh] relative border-t border-slate-200">
      <table className="w-full border-collapse text-[11px] text-left">
        <thead className="sticky top-0 z-20 bg-slate-50 border-b border-slate-200">
          <tr>
            {headers.map((h, i) => (
              <th key={i} className="px-3 py-4 font-black text-slate-400 uppercase tracking-tighter whitespace-nowrap border-r border-slate-100 last:border-0 shadow-[0_1px_0_rgba(0,0,0,0.05)]">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 bg-white">
          {data.map((course, idx) => {
            const isMissingRoom = !course.room || course.room.trim() === "" || course.room.toLowerCase() === "null";
            const suggestion = course.suggestedRoom;
            const status = course.validationStatus;
            const validationError = course.validationError;
            const isRoomUnknown = validationError?.includes("không nằm trong danh sách quản lý");
            const isCapacityError = validationError?.includes("Quá tải");
            const hasOriginalError = status === 'original_violated';
            const hasAiError = status === 'violated';
            // Vẫn trống sau khi AI chạy
            const stillEmpty = isMissingRoom && !suggestion;
            
            return (
              <tr 
                key={idx} 
                className={`transition-all group
                  ${status === 'violated' ? 'bg-red-50/70 hover:bg-red-100/70' : 
                    status === 'original_violated' ? 'bg-amber-50/70 hover:bg-amber-100/70' :
                    status === 'verified' ? 'bg-emerald-50/30 hover:bg-emerald-100/30' : 
                    stillEmpty ? 'bg-slate-50' : 'hover:bg-slate-50'}
                `}
              >
                <td className={`px-3 py-3 border-r border-slate-50 flex items-center gap-1.5 ${hasOriginalError ? 'text-amber-600 font-bold' : 'text-slate-400'}`}>
                  {hasOriginalError && <AlertOctagon className="w-3.5 h-3.5 animate-pulse" />}
                  {course.stt}
                </td>
                <td className="px-3 py-3 border-r border-slate-50 font-mono text-slate-400">{course.courseCode}</td>
                <td className={`px-3 py-3 border-r border-slate-50 font-bold ${hasOriginalError ? 'text-amber-700' : 'text-slate-800'}`}>
                  {course.courseName}
                </td>
                <td className="px-3 py-3 border-r border-slate-50 text-center">{course.credits}</td>
                <td className="px-3 py-3 border-r border-slate-50 font-mono text-indigo-500 font-medium">{course.sectionCode}</td>
                <td className="px-3 py-3 border-r border-slate-50 text-slate-600 truncate max-w-[120px]">{course.lecturer}</td>
                <td className="px-3 py-3 border-r border-slate-50 text-center text-slate-400">
                  {course.studentCount}
                </td>
                <td className={`px-3 py-3 border-r border-slate-50 text-center font-black ${isCapacityError || hasOriginalError || hasAiError ? 'text-red-600' : 'text-indigo-600'}`}>
                  {course.registeredCount}
                </td>
                <td className="px-3 py-3 border-r border-slate-50 font-black text-center text-slate-600">{course.dayOfWeek}</td>
                <td className="px-3 py-3 border-r border-slate-50 text-center text-slate-600 font-medium">{course.period}</td>
                <td className={`px-3 py-3 border-r border-slate-50 font-black relative min-w-[130px]
                  ${hasOriginalError ? 'text-amber-600' : stillEmpty ? 'text-amber-400 bg-amber-50/30' : 'text-slate-700'}
                `}>
                  <div className="flex flex-col">
                    <div className="flex items-center gap-1">
                      {hasOriginalError && <AlertOctagon className="w-3 h-3 flex-shrink-0" />}
                      {stillEmpty && <HelpCircle className="w-3 h-3 text-amber-400 flex-shrink-0" />}
                      <span className={`${suggestion ? 'line-through opacity-30 text-[9px]' : ''} ${stillEmpty ? 'italic font-medium' : ''}`}>
                        {isMissingRoom ? 'Chưa xếp' : course.room}
                      </span>
                    </div>
                    {suggestion && (
                      <div className="flex items-center gap-1 font-black text-blue-600 animate-in slide-in-from-left-2">
                        <ArrowRight className="w-2 h-2" />
                        <Sparkles className="w-2 h-2" />
                        <span>{suggestion}</span>
                      </div>
                    )}
                  </div>
                </td>
                <td className="px-3 py-3 text-center">
                  {status === 'verified' && (
                    <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-100 text-emerald-700 rounded-full text-[9px] font-black uppercase shadow-sm">
                      <ShieldCheck className="w-3 h-3" /> Hợp lệ
                    </div>
                  )}
                  {status === 'violated' && (
                    <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-red-100 text-red-700 rounded-full text-[9px] font-black uppercase group/tooltip relative cursor-help shadow-sm">
                      <ShieldAlert className="w-3 h-3" /> AI Sai
                      <div className="invisible group-hover/tooltip:visible absolute bottom-full mb-3 left-1/2 -translate-x-1/2 w-56 p-3 bg-slate-900 text-white text-[10px] rounded-xl shadow-2xl z-50 normal-case font-medium leading-relaxed ring-1 ring-white/10 animate-in fade-in zoom-in-95">
                        <p className="font-black text-red-400 mb-1 uppercase tracking-tighter">Lỗi đề xuất AI:</p>
                        {validationError}
                        <div className="absolute top-full left-1/2 -translate-x-1/2 border-[6px] border-transparent border-t-slate-900" />
                      </div>
                    </div>
                  )}
                  {status === 'original_violated' && (
                    <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-amber-100 text-amber-700 rounded-full text-[9px] font-black uppercase group/tooltip relative cursor-help shadow-sm">
                      <AlertOctagon className="w-3 h-3" /> Sai Gốc
                      <div className="invisible group-hover/tooltip:visible absolute bottom-full mb-3 left-1/2 -translate-x-1/2 w-56 p-3 bg-slate-900 text-white text-[10px] rounded-xl shadow-2xl z-50 normal-case font-medium leading-relaxed ring-1 ring-white/10 animate-in fade-in zoom-in-95">
                        <p className="font-black text-amber-400 mb-1 uppercase tracking-tighter">Lỗi từ Excel gốc:</p>
                        {validationError}
                        <div className="absolute top-full left-1/2 -translate-x-1/2 border-[6px] border-transparent border-t-slate-900" />
                      </div>
                    </div>
                  )}
                  {stillEmpty && (
                     <div className="inline-flex items-center gap-1 px-2 py-1 bg-amber-50 text-amber-600 rounded-lg text-[9px] font-bold">
                        <HelpCircle className="w-3 h-3" /> AI Bỏ qua
                     </div>
                  )}
                  {isRoomUnknown && !stillEmpty && (
                    <div className="inline-flex items-center gap-1 px-2 py-1 bg-slate-100 text-slate-500 rounded-lg text-[9px] font-bold group/tooltip relative cursor-help">
                      <Info className="w-3 h-3" /> Phòng lạ
                      <div className="invisible group-hover/tooltip:visible absolute bottom-full mb-2 left-1/2 -translate-x-1/2 w-48 p-2 bg-slate-700 text-white text-[9px] rounded shadow-lg z-50 normal-case font-medium">
                        Phòng này không có trong danh sách Master. Hệ thống không thể check sức chứa dựa trên ĐK.
                      </div>
                    </div>
                  )}
                  {status === 'unchecked' && !suggestion && !isRoomUnknown && !stillEmpty && (
                    <div className="text-slate-300 italic flex items-center justify-center gap-1">
                      <Info className="w-3 h-3 opacity-50" /> Đã có sẵn
                    </div>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

export default TimetableGrid;
