
import React, { useState, useCallback, useMemo, useEffect } from 'react';
import * as XLSX from 'xlsx';
import {
  LayoutDashboard as IconDashboard,
  ShieldCheck as IconShield,
  ShieldAlert as IconShieldAlert,
  Sparkles as IconSparkles,
  PieChart as IconAnalyze,
  HelpCircle,
  FileSpreadsheet,
  Home,
  Settings2,
  Loader2,
  Zap,
  Wrench,
  Trash2,
  AlertCircle,
  Code,
  Coffee,
  Grid3X3,
  BarChart3,
  Clock,
  AlertOctagon,
  Key,
  Download
} from 'lucide-react';
import { CourseData, RoomData } from './types';
import TimetableGrid from './components/TimetableGrid';
import RoomGrid from './components/RoomGrid';
import OccupancyMap from './components/OccupancyMap';
import FileUploader from './components/FileUploader';
import { scheduleWithHardcodedLogic } from './services/hardcodedScheduler';
import { validateAISuggestions, normalizeDay, getStartPeriod } from './utils/validator';

const App: React.FC = () => {
  const [courses, setCourses] = useState<CourseData[]>([]);
  const [rooms, setRooms] = useState<RoomData[]>([]);
  const [courseFileName, setCourseFileName] = useState<string | null>(null);
  const [roomFileName, setRoomFileName] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [aiAnalysis, setAiAnalysis] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'schedule' | 'rooms' | 'occupancy'>('schedule');
  const [currentMode, setCurrentMode] = useState<'FILLING' | 'IDLE'>('IDLE');
  
  const [iteration, setIteration] = useState(0);

  const isDataReady = courses.length > 0 && rooms.length > 0;
  const TOTAL_SLOTS_PER_ROOM = 24;

  useEffect(() => {
    // Cleanup if needed
  }, []);

  const validatedCourses = useMemo(() => {
    if (!isDataReady) return courses;
    return validateAISuggestions(courses, rooms);
  }, [courses, rooms, isDataReady]);

  const roomUsageMap = useMemo(() => {
    const usage = new Map<string, Set<string>>();
    validatedCourses.forEach(c => {
      const r = (c.suggestedRoom || c.room || "").trim().toLowerCase();
      if (r && r !== "null" && r !== "" && (c.validationStatus === 'verified' || !c.suggestedRoom)) {
        if (!usage.has(r)) usage.set(r, new Set());
        const day = normalizeDay(c.dayOfWeek);
        const startP = getStartPeriod(c.period);
        usage.get(r)!.add(`${day}-${startP}`);
      }
    });
    return usage;
  }, [validatedCourses]);

  const roomsWithSpace = useMemo(() => {
    if (!isDataReady) return 0;
    return rooms.filter(r => {
      const used = roomUsageMap.get(r.roomName.trim().toLowerCase())?.size || 0;
      return used < TOTAL_SLOTS_PER_ROOM;
    }).length;
  }, [rooms, roomUsageMap, isDataReady]);

  const handleFileUpload = (data: any[], name: string, type: 'course' | 'room') => {
    if (type === 'course') {
      setCourses(data.map(item => ({ ...item, validationStatus: 'unchecked' })));
      setCourseFileName(name);
    } else {
      setRooms(data);
      setRoomFileName(name);
    }
  };

  const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

  const exportToExcel = () => {
    if (!validatedCourses.length) return;

    const exportData = validatedCourses.map(c => ({
      'STT': c.stt,
      'Mã học phần': c.courseCode,
      'Tên học phần': c.courseName,
      'Số tín chỉ': c.credits,
      'Mã lớp học phần': c.sectionCode,
      'Giảng viên': c.lecturer,
      'Số sinh viên': c.studentCount,
      'Số đăng ký': c.registeredCount,
      'Thứ': c.dayOfWeek,
      'Tiết': c.period,
      'Giảng đường': c.validationStatus === 'verified' ? (c.suggestedRoom || c.room) : '',
      'Thời lượng': c.duration
    }));

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Lịch giảng dạy");
    
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    XLSX.writeFile(workbook, `ThoiKhoaBieu_UniTime_${timestamp}.xlsx`);
  };

  const runTurboProcess = async () => {
    if (!isDataReady) return;

    setIsAnalyzing(true);
    let currentCourses = [...courses];
    let fullLog = `� KHỞI ĐỘNG HARDCODED LOGIC ENGINE...\n`;
    setAiAnalysis(fullLog);

    const applySuggestions = (suggestions: {stt: any, room: string}[]) => {
      const sugMap = new Map(suggestions.map(s => [String(s.stt), s.room]));
      let changeCount = 0;
      const updated = currentCourses.map(c => {
        const res = sugMap.get(String(c.stt));
        if (res) {
          if (c.suggestedRoom !== res) {
            changeCount++;
            return { ...c, suggestedRoom: res };
          }
        }
        return c;
      });
      return { updated, changeCount };
    };

    try {
      setCurrentMode('FILLING');
      setIteration(1);
      
      const validState = validateAISuggestions(currentCourses, rooms);
      setCourses([...validState]);

      // Run hardcoded scheduler
      const result = scheduleWithHardcodedLogic(validState, rooms);

      if (result.suggestions.length > 0) {
        const { updated, changeCount } = applySuggestions(result.suggestions);
        currentCourses = updated;
        fullLog = `⚡ [Scheduling] ${result.report}\n` + fullLog;
        setAiAnalysis(fullLog);
        await new Promise(resolve => setTimeout(resolve, 1000));
      } else {
        fullLog = `⚠️ ${result.report}\n` + fullLog;
        setAiAnalysis(fullLog);
      }

      setAiAnalysis("✅ HOÀN TẤT XẾP LỊCH.\n" + fullLog);
    } catch (error) {
      setAiAnalysis("❌ Lỗi hệ thống: " + (error as Error).message);
    } finally {
      setIsAnalyzing(false);
      setCurrentMode('IDLE');
      setCourses(validateAISuggestions(currentCourses, rooms));
    }
  };

  const verifiedCount = validatedCourses.filter(c => c.validationStatus === 'verified').length;
  const errorCount = validatedCourses.filter(c => c.suggestedRoom && c.validationStatus === 'violated').length;
  const unassignedCount = validatedCourses.filter(c => (!c.room || c.room.toLowerCase() === 'null' || c.room.trim() === '') && !c.suggestedRoom).length;

  return (
    <div className="min-h-screen flex flex-col bg-[#F8FAFC]">
      <header className="bg-slate-900 text-white shadow-2xl sticky top-0 z-50 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="bg-indigo-500 p-2.5 rounded-2xl shadow-lg shadow-indigo-500/20 rotate-3">
              <Zap className="w-6 h-6 fill-white" />
            </div>
            <div>
              <h1 className="text-xl font-black tracking-tighter italic leading-none">UNITIME <span className="text-indigo-400">SCHEDULER</span></h1>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1 opacity-70">Hardcoded Logic v1.0</p>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            <div className={`flex items-center gap-3 px-4 py-2 rounded-2xl border backdrop-blur-md transition-all ${isAnalyzing ? 'bg-indigo-500/20 border-indigo-500/40 ring-4 ring-indigo-500/10' : 'bg-white/5 border-white/10'}`}>
              {isAnalyzing ? <Loader2 className="w-4 h-4 text-indigo-400 animate-spin" /> : <Zap className="w-4 h-4 text-indigo-400" />}
              <span className={`text-[11px] font-black uppercase tracking-widest ${isAnalyzing ? 'text-indigo-100' : 'text-indigo-100'}`}>
                {isAnalyzing ? `XẾP LỊCH: ${iteration}` : 'SẴN SÀNG'}
              </span>
            </div>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-7xl mx-auto w-full p-6 space-y-6">
        {!isDataReady ? (
          <div className="py-12 flex flex-col items-center gap-12">
             <div className="bg-white p-16 rounded-[64px] shadow-2xl shadow-indigo-100/50 border border-slate-100 max-w-3xl w-full text-center relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-indigo-500 via-purple-500 to-blue-500" />
                
                <div className="w-28 h-28 bg-gradient-to-br from-indigo-600 to-blue-500 rounded-[36px] mx-auto flex items-center justify-center mb-10 shadow-2xl shadow-indigo-200 rotate-3 hover:rotate-0 transition-transform duration-500">
                   <FileSpreadsheet className="w-14 h-14 text-white" />
                </div>
                
                <h2 className="text-6xl font-black text-slate-900 mb-6 tracking-tighter">
                  UniTime <span className="text-indigo-600">Scheduler</span>
                </h2>
                <p className="text-slate-500 text-xl mb-12 font-medium max-w-lg mx-auto leading-relaxed">
                  Giải pháp tự động tối ưu hóa phòng học và lịch giảng dạy chuyên nghiệp.
                </p>
                
                <div className="flex flex-col items-center gap-6">
                   <div className="flex items-center gap-4 text-slate-400 font-bold uppercase tracking-[0.2em] text-[10px]">
                      <div className="h-px w-12 bg-slate-200" />
                      Bắt đầu bằng cách tải dữ liệu
                      <div className="h-px w-12 bg-slate-200" />
                   </div>
                   
                   <div className="grid md:grid-cols-2 gap-6 w-full">
                      <FileUploader type="course" label="Lịch giảng dạy" fileName={courseFileName} count={courses.length} onUpload={handleFileUpload} onRemove={() => {setCourses([]); setCourseFileName(null);}} />
                      <FileUploader type="room" label="Danh sách phòng" fileName={roomFileName} count={rooms.length} onUpload={handleFileUpload} onRemove={() => {setRooms([]); setRoomFileName(null);}} />
                   </div>
                </div>
             </div>

             <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-4xl w-full">
                <div className="bg-white/50 p-8 rounded-[40px] border border-white shadow-sm flex flex-col items-center text-center gap-4">
                   <div className="w-12 h-12 rounded-2xl bg-emerald-100 flex items-center justify-center">
                      <IconShield className="w-6 h-6 text-emerald-600" />
                   </div>
                   <h3 className="font-black text-slate-800 uppercase tracking-widest text-xs">Chính xác</h3>
                   <p className="text-slate-500 text-sm">Đảm bảo không trùng lịch, đúng sức chứa phòng.</p>
                </div>
                <div className="bg-white/50 p-8 rounded-[40px] border border-white shadow-sm flex flex-col items-center text-center gap-4">
                   <div className="w-12 h-12 rounded-2xl bg-indigo-100 flex items-center justify-center">
                      <Zap className="w-6 h-6 text-indigo-600" />
                   </div>
                   <h3 className="font-black text-slate-800 uppercase tracking-widest text-xs">Tốc độ</h3>
                   <p className="text-slate-500 text-sm">Xử lý hàng ngàn lớp học chỉ trong vài giây.</p>
                </div>
                <div className="bg-white/50 p-8 rounded-[40px] border border-white shadow-sm flex flex-col items-center text-center gap-4">
                   <div className="w-12 h-12 rounded-2xl bg-amber-100 flex items-center justify-center">
                      <Wrench className="w-6 h-6 text-amber-600" />
                   </div>
                   <h3 className="font-black text-slate-800 uppercase tracking-widest text-xs">Tùy biến</h3>
                   <p className="text-slate-500 text-sm">Dễ dàng điều chỉnh và xuất dữ liệu Excel.</p>
                </div>
             </div>
          </div>
        ) : (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-8 duration-700">
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
               <StatCard icon={<IconShield className="text-emerald-500" />} label="Xác minh" value={verifiedCount} color="emerald" />
               <StatCard icon={<HelpCircle className="text-amber-500" />} label="Chưa có phòng" value={unassignedCount} color="amber" />
               <StatCard icon={<IconShieldAlert className="text-red-500" />} label="Xung đột AI" value={errorCount} color="red" />
               <StatCard icon={<Home className="text-indigo-500" />} label="Phòng còn chỗ" value={roomsWithSpace} color="indigo" />
               <button onClick={runTurboProcess} disabled={isAnalyzing} className={`group relative overflow-hidden p-6 rounded-[36px] shadow-2xl transition-all duration-300 flex items-center gap-5 text-left disabled:opacity-50 ${isAnalyzing ? 'bg-slate-800' : 'bg-indigo-600 hover:bg-indigo-700 hover:-translate-y-1 hover:shadow-indigo-300'}`}>
                  <div className="w-12 h-12 rounded-2xl bg-white/20 flex items-center justify-center z-10 shrink-0">
                    {isAnalyzing ? <Loader2 className="w-6 h-6 text-white animate-spin" /> : <Zap className="w-6 h-6 text-white" />}
                  </div>
                  <div className="z-10">
                     <p className="text-[10px] text-white/60 uppercase font-black tracking-widest leading-tight">Trạng thái</p>
                     <p className="text-lg font-black text-white leading-tight">
                        {isAnalyzing ? 'ĐANG CHẠY' : 'CHẠY LỊCH'}
                     </p>
                  </div>
               </button>
            </div>

            <div className="bg-white rounded-[48px] shadow-xl border border-slate-100 overflow-hidden min-h-[600px] flex flex-col">
               <div className="flex border-b border-slate-50 bg-slate-50/30 p-3 overflow-x-auto no-scrollbar">
                  <TabButton active={activeTab === 'schedule'} onClick={() => setActiveTab('schedule')} icon={<FileSpreadsheet className="w-4 h-4" />} label="BẢNG LỊCH TRÌNH" />
                  <TabButton active={activeTab === 'rooms'} onClick={() => setActiveTab('rooms')} icon={<Home className="w-4 h-4" />} label={`DS PHÒNG (${roomsWithSpace} PHÒNG CÒN CHỖ)`} />
                  <TabButton active={activeTab === 'occupancy'} onClick={() => setActiveTab('occupancy')} icon={<Grid3X3 className="w-4 h-4" />} label="BẢN ĐỒ CHIẾM DỤNG" />
                  <div className="flex-1" />
                  <div className="flex items-center gap-2 px-4">
                    <button 
                      onClick={exportToExcel}
                      disabled={!validatedCourses.length || isAnalyzing}
                      className="px-6 flex items-center gap-2 text-[11px] font-black text-emerald-600 hover:text-emerald-700 disabled:opacity-30 disabled:hover:text-emerald-600 transition-colors uppercase tracking-widest border border-emerald-100 rounded-full py-2 bg-emerald-50/50"
                    >
                      <Download className="w-4 h-4"/> Xuất Excel
                    </button>
                    <button 
                      onClick={() => {setCourses([]); setRooms([]); setAiAnalysis(null); setCourseFileName(null); setRoomFileName(null);}} 
                      className="px-6 flex items-center gap-2 text-[11px] font-black text-slate-400 hover:text-red-500 transition-colors uppercase tracking-widest"
                    >
                      <Trash2 className="w-4 h-4"/> Xóa hết
                    </button>
                  </div>
               </div>
               <div className="flex-1 overflow-hidden">
                  {activeTab === 'schedule' && <TimetableGrid data={validatedCourses} />}
                  {activeTab === 'rooms' && <RoomGrid data={rooms} roomUsageMap={roomUsageMap} />}
                  {activeTab === 'occupancy' && <OccupancyMap courses={validatedCourses} rooms={rooms} />}
               </div>
            </div>

            {aiAnalysis && (
              <div className="bg-slate-900 border border-slate-800 rounded-[48px] shadow-2xl p-10 animate-in slide-in-from-top-6">
                <div className="flex items-center gap-4 mb-6">
                   <div className="p-3 rounded-[20px] ring-1 transition-colors bg-indigo-500/20 ring-indigo-500/30">
                      <Code className="w-6 h-6 text-indigo-400" />
                   </div>
                   <div>
                      <h3 className="text-lg font-black uppercase tracking-tighter text-white">DEBUG & ENGINE LOG</h3>
                      <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">
                        Hardcoded Logic: Xếp lịch theo luật cứng định sẵn
                      </p>
                   </div>
                   <div className="flex-1" />
                   <a href="https://ai.google.dev/gemini-api/docs/billing" target="_blank" className="text-[9px] text-slate-500 hover:text-indigo-400 transition-colors font-bold uppercase tracking-widest border border-slate-800 px-3 py-1 rounded-full">Tài liệu Billing</a>
                </div>
                <div className="text-[12px] text-slate-300 font-mono whitespace-pre-wrap max-h-56 overflow-y-auto custom-scrollbar leading-relaxed bg-black/40 p-6 rounded-[32px] border border-white/5">
                  {aiAnalysis}
                </div>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
};

const StatCard = ({ icon, label, value, color }: { icon: any, label: string, value: number, color: string }) => (
  <div className="bg-white p-6 rounded-[40px] shadow-sm border border-slate-100 flex items-center gap-5 group hover:shadow-lg transition-all duration-300">
    <div className={`w-12 h-12 rounded-2xl bg-${color}-50 flex items-center justify-center group-hover:scale-110 transition-transform shrink-0`}>
      {React.cloneElement(icon as React.ReactElement<any>, { className: `w-6 h-6 text-${color}-500` })}
    </div>
    <div className="min-w-0">
      <p className="text-[10px] text-slate-400 uppercase font-black tracking-widest truncate">{label}</p>
      <p className="text-2xl font-black text-slate-800 tracking-tighter truncate">{value}</p>
    </div>
  </div>
);

const TabButton = ({ active, onClick, icon, label }: { active: boolean, onClick: () => void, icon: any, label: string }) => (
  <button onClick={onClick} className={`px-8 py-4 text-[11px] font-black rounded-[28px] transition-all flex items-center gap-3 whitespace-nowrap ${active ? 'bg-white text-indigo-600 shadow-xl shadow-indigo-100/50 border border-slate-100 scale-105' : 'text-slate-400 hover:text-indigo-600'}`}>
    {icon} {label}
  </button>
);

export default App;
