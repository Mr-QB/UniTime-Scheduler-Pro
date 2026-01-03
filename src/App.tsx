
import React, { useState, useCallback, useMemo, useEffect } from 'react';
import * as XLSX from 'xlsx';
import ApiKeyModal from './components/ApiKeyModal';
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
import { analyzeSchedule, AISolveMode } from './services/geminiService';
import { validateAISuggestions, normalizeDay, getStartPeriod } from './utils/validator';

const App: React.FC = () => {
  const [courses, setCourses] = useState<CourseData[]>([]);
  const [rooms, setRooms] = useState<RoomData[]>([]);
  const [courseFileName, setCourseFileName] = useState<string | null>(null);
  const [roomFileName, setRoomFileName] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [aiAnalysis, setAiAnalysis] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'schedule' | 'rooms' | 'occupancy'>('schedule');
  const [currentMode, setCurrentMode] = useState<AISolveMode | 'IDLE'>('IDLE');
  
  const [maxFillIters, setMaxFillIters] = useState(15);
  const [maxRepairIters, setMaxRepairIters] = useState(8);
  const [quotaWaitTime, setQuotaWaitTime] = useState(30); 
  const [iteration, setIteration] = useState(0);
  const [quotaCountdown, setQuotaCountdown] = useState(0);
  const [hasApiKey, setHasApiKey] = useState<boolean>(false);
  const [apiKey, setApiKey] = useState<string>('');
  const [isApiKeyModalOpen, setIsApiKeyModalOpen] = useState(false);

  const isDataReady = courses.length > 0 && rooms.length > 0;
  const TOTAL_SLOTS_PER_ROOM = 24;

  useEffect(() => {
    const checkKey = async () => {
      // Kiểm tra localStorage trước
      const savedApiKey = localStorage.getItem('gemini_api_key');
      if (savedApiKey) {
        setApiKey(savedApiKey);
        setHasApiKey(true);
      } else if (window.aistudio) {
        const hasKey = await window.aistudio.hasSelectedApiKey();
        setHasApiKey(hasKey);
      }
    };
    checkKey();
  }, []);

  const handleOpenKeySelector = async () => {
    if (window.aistudio) {
      await window.aistudio.openSelectKey();
      setHasApiKey(true);
    }
  };

  const handleApiKeySubmit = (key: string) => {
    localStorage.setItem('gemini_api_key', key);
    setApiKey(key);
    setHasApiKey(true);
    setIsApiKeyModalOpen(false);
  };

  useEffect(() => {
    let timer: any;
    if (quotaCountdown > 0) {
      timer = setInterval(() => setQuotaCountdown(prev => prev - 1), 1000);
    }
    return () => clearInterval(timer);
  }, [quotaCountdown]);

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
    if (!hasApiKey) {
      await handleOpenKeySelector();
    }

    setIsAnalyzing(true);
    setQuotaCountdown(0);
    let currentCourses = [...courses];
    let fullLog = `🚀 KHỞI ĐỘNG TURBO ENGINE...\n`;
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

    const processPhase = async (mode: AISolveMode, maxIters: number) => {
      setCurrentMode(mode);
      let consecutiveNoSuggestions = 0;
      
      for (let i = 1; i <= maxIters; i++) {
        setIteration(i);
        const validState = validateAISuggestions(currentCourses, rooms);
        setCourses([...validState]);

        let hasTargets = false;
        if (mode === 'FILLING') {
          hasTargets = validState.some(c => (!c.room || c.room.toLowerCase() === 'null' || c.room.trim() === '') && !c.suggestedRoom);
        } else {
          // REPAIRING: tìm cả lỗi (violated) VÀ cơ hội tối ưu (có thể di chuyển sang phòng tốt hơn)
          // Tính toán utilization để tìm phòng quá tải
          const roomUsage = new Map<string, number>();
          validState.forEach(c => {
            const r = (c.suggestedRoom || c.room || "").trim().toLowerCase();
            if (r && r !== "null" && r !== "") {
              roomUsage.set(r, (roomUsage.get(r) || 0) + 1);
            }
          });
          
          // Có target nếu: có lỗi HOẶC có phòng quá tải (>6 slot chiếm)
          hasTargets = validState.some(c => c.suggestedRoom && c.validationStatus === 'violated') ||
                       Array.from(roomUsage.values()).some(usage => usage > 6);
        }
        
        if (!hasTargets) {
          fullLog = `⚠️ Hoàn tất ${mode}. Không có target còn lại.\n` + fullLog;
          setAiAnalysis(fullLog);
          break;
        }

        const result = await analyzeSchedule(validState, rooms, mode, i, apiKey);
        
        if (result.errorType === 'QUOTA') {
          const waitTime = quotaWaitTime; 
          setQuotaCountdown(waitTime);
          fullLog = `⏳ [QUOTA 429] Đang tạm nghỉ ${waitTime}s để hồi hạn mức API...\n` + fullLog;
          setAiAnalysis(fullLog);
          await sleep(waitTime * 1000);
          setQuotaCountdown(0);
          i--; 
          continue;
        }

        if (result.report.includes("not found")) {
          fullLog = `⚠️ Lỗi xác thực Key. Vui lòng chọn lại Key...\n` + fullLog;
          setAiAnalysis(fullLog);
          setHasApiKey(false);
          await handleOpenKeySelector();
          i--;
          continue;
        }

        if (result.suggestions.length === 0) {
           consecutiveNoSuggestions++;
           // Chỉ stop khi FILLING kết thúc (no more unassigned) hoặc REPAIRING failed 3 times
           if (mode === 'REPAIRING' && consecutiveNoSuggestions >= 3) {
             fullLog = `⚠️ REPAIRING: Không tìm thấy đề xuất ${consecutiveNoSuggestions} vòng. Hoàn tất.\n` + fullLog;
             setAiAnalysis(fullLog);
             break;
           }
           fullLog = `⚠️ Không tìm thấy đề xuất ở vòng ${i}, thử lại...\n` + fullLog;
           setAiAnalysis(fullLog);
           await sleep(2000);
           continue;
        }

        consecutiveNoSuggestions = 0; // Reset counter khi có suggestion
        const { updated, changeCount } = applySuggestions(result.suggestions);
        currentCourses = updated;
        fullLog = `⚡ [${mode === 'FILLING' ? 'Lấp' : 'Sửa'} ${i}] ${result.report}\n` + fullLog;
        setAiAnalysis(fullLog);
        
        await sleep(2000);
        
        if (changeCount === 0 && mode === 'REPAIRING') {
          consecutiveNoSuggestions++;
          if (consecutiveNoSuggestions >= 2) break;
        }
      }
    };

    try {
      await processPhase('FILLING', maxFillIters);
      await processPhase('REPAIRING', maxRepairIters);
      setAiAnalysis("✅ TIẾN TRÌNH HOÀN TẤT.\n" + fullLog);
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
              <h1 className="text-xl font-black tracking-tighter italic leading-none">UNITIME <span className="text-indigo-400">TURBO</span></h1>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1 opacity-70">Extreme Optimization Active</p>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            <button 
              onClick={() => setIsApiKeyModalOpen(true)}
              className={`flex items-center gap-2 px-4 py-2 rounded-2xl border transition-all ${hasApiKey ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' : 'bg-red-500/10 border-red-500/30 text-red-400 animate-pulse'}`}
            >
              <Key className="w-4 h-4" />
              <span className="text-[11px] font-black uppercase tracking-widest">
                {hasApiKey ? 'API KEY: OK' : 'CẤU HÌNH API KEY'}
              </span>
            </button>

            {isAnalyzing && (
              <div className={`flex items-center gap-3 px-4 py-2 rounded-2xl border backdrop-blur-md transition-all ${quotaCountdown > 0 ? 'bg-red-500/20 border-red-500/40 ring-4 ring-red-500/10' : 'bg-white/5 border-white/10'}`}>
                {quotaCountdown > 0 ? <Clock className="w-4 h-4 text-red-400 animate-pulse" /> : <Loader2 className="w-4 h-4 text-indigo-400 animate-spin" />}
                <span className={`text-[11px] font-black uppercase tracking-widest ${quotaCountdown > 0 ? `text-red-200` : 'text-indigo-100'}`}>
                  {quotaCountdown > 0 ? `Đang hồi Quota: ${quotaCountdown}s` : `${currentMode === 'FILLING' ? 'Lấp đầy' : 'Sửa lỗi'}: ${iteration}`}
                </span>
              </div>
            )}
            
            <div className="flex items-center gap-4 bg-white/5 px-4 py-2 rounded-2xl border border-white/10">
               <Settings2 className="w-4 h-4 text-slate-500" />
               <div className="flex items-center gap-6">
                  <div className="flex flex-col">
                    <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest text-center">Vòng lặp (F/R)</span>
                    <div className="flex gap-1 mt-1">
                       <select value={maxFillIters} onChange={e => setMaxFillIters(Number(e.target.value))} disabled={isAnalyzing} className="bg-slate-800 text-[10px] font-bold p-1 rounded outline-none border-none cursor-pointer">
                         {[5,10,15,20,30].map(v => <option key={v} value={v}>{v}</option>)}
                       </select>
                       <select value={maxRepairIters} onChange={e => setMaxRepairIters(Number(e.target.value))} disabled={isAnalyzing} className="bg-slate-800 text-[10px] font-bold p-1 rounded outline-none border-none cursor-pointer">
                         {[3,5,8,12,15].map(v => <option key={v} value={v}>{v}</option>)}
                       </select>
                    </div>
                  </div>
                  
                  <div className="flex flex-col">
                    <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest text-center">Hồi Quota</span>
                    <div className="flex mt-1">
                       <select 
                         value={quotaWaitTime} 
                         onChange={e => setQuotaWaitTime(Number(e.target.value))} 
                         disabled={isAnalyzing} 
                         className="bg-slate-800 text-[10px] font-bold p-1 rounded outline-none border-none cursor-pointer"
                       >
                         {[0, 5, 10, 15, 20, 25, 30].map(v => <option key={v} value={v}>{v}s</option>)}
                       </select>
                    </div>
                  </div>
               </div>
            </div>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-7xl mx-auto w-full p-6 space-y-6">
        {!isDataReady ? (
          <div className="py-20 flex flex-col items-center">
             <div className="bg-white p-12 rounded-[64px] shadow-2xl shadow-indigo-100 border border-slate-100 max-w-2xl w-full text-center group">
                <div className="w-24 h-24 bg-gradient-to-br from-indigo-600 to-blue-500 rounded-[32px] mx-auto flex items-center justify-center mb-10 shadow-2xl shadow-indigo-200">
                   <FileSpreadsheet className="w-12 h-12 text-white" />
                </div>
                <h2 className="text-5xl font-black text-slate-800 mb-4 tracking-tighter">Hệ thống <span className="text-indigo-600">Lập lịch</span></h2>
                <p className="text-slate-400 text-lg mb-8 font-medium italic">Vui lòng đảm bảo đã cấu hình API Key để tránh lỗi 429</p>
                
                <button 
                  onClick={() => setIsApiKeyModalOpen(true)}
                  className="mb-8 px-8 py-4 bg-red-600 hover:bg-red-700 text-white rounded-[24px] font-black text-sm uppercase tracking-widest shadow-xl shadow-red-200 transition-all flex items-center gap-3 mx-auto"
                >
                  <Key className="w-5 h-5" /> {hasApiKey ? 'Thay đổi API Key' : 'Thiết lập API Key ngay'}
                </button>

                <div className="grid md:grid-cols-2 gap-8">
                   <FileUploader type="course" label="Lịch giảng dạy" fileName={courseFileName} count={courses.length} onUpload={handleFileUpload} onRemove={() => {setCourses([]); setCourseFileName(null);}} />
                   <FileUploader type="room" label="Danh sách phòng" fileName={roomFileName} count={rooms.length} onUpload={handleFileUpload} onRemove={() => {setRooms([]); setRoomFileName(null);}} />
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
               <button onClick={runTurboProcess} disabled={isAnalyzing} className={`group relative overflow-hidden p-6 rounded-[36px] shadow-2xl transition-all duration-300 flex items-center gap-5 text-left disabled:opacity-50 ${isAnalyzing ? (quotaCountdown > 0 ? 'bg-red-600' : 'bg-slate-800') : 'bg-indigo-600 hover:bg-indigo-700 hover:-translate-y-1 hover:shadow-indigo-300'}`}>
                  <div className="w-12 h-12 rounded-2xl bg-white/20 flex items-center justify-center z-10 shrink-0">
                    {isAnalyzing ? (quotaCountdown > 0 ? <Clock className="w-6 h-6 text-white animate-pulse" /> : <Loader2 className="w-6 h-6 text-white animate-spin" />) : <Zap className="w-6 h-6 text-white" />}
                  </div>
                  <div className="z-10">
                     <p className="text-[10px] text-white/60 uppercase font-black tracking-widest leading-tight">Trạng thái</p>
                     <p className="text-lg font-black text-white leading-tight">
                        {quotaCountdown > 0 ? `ĐỢI ${quotaCountdown}s` : (isAnalyzing ? 'ĐANG CHẠY' : 'CHẠY TURBO')}
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
                   <div className={`p-3 rounded-[20px] ring-1 transition-colors ${quotaCountdown > 0 ? 'bg-red-500/20 ring-red-500/30' : 'bg-indigo-500/20 ring-indigo-500/30'}`}>
                      {quotaCountdown > 0 ? <AlertOctagon className="w-6 h-6 text-red-400" /> : <Code className="w-6 h-6 text-indigo-400" />}
                   </div>
                   <div>
                      <h3 className="text-lg font-black uppercase tracking-tighter text-white">DEBUG & ENGINE LOG</h3>
                      <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">
                        {quotaCountdown > 0 ? "⚠️ HẠN MỨC API ĐÃ HẾT - TỰ ĐỘNG THỬ LẠI KHI CÓ QUOTA" : "Flash Engine: Tự động lặp cho đến khi tối ưu"}
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

      <ApiKeyModal 
        isOpen={isApiKeyModalOpen}
        onClose={() => setIsApiKeyModalOpen(false)}
        onSubmit={handleApiKeySubmit}
      />
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
