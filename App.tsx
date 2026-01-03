
import React, { useState } from 'react';
import { 
  LayoutDashboard as IconDashboard,
  ShieldCheck as IconShield,
  ShieldAlert as IconShieldAlert,
  Sparkles as IconSparkles,
  PieChart as IconAnalyze,
  HelpCircle,
  AlertTriangle,
  FileSpreadsheet,
  Home,
  Settings2,
  CheckCircle,
  Loader2,
  RefreshCw
} from 'lucide-react';
import { CourseData, RoomData } from './types';
import TimetableGrid from './components/TimetableGrid';
import RoomGrid from './components/RoomGrid';
import FileUploader from './components/FileUploader';
import { analyzeSchedule } from './services/geminiService';
import { validateAISuggestions } from './utils/validator';

const App: React.FC = () => {
  const [courses, setCourses] = useState<CourseData[]>([]);
  const [rooms, setRooms] = useState<RoomData[]>([]);
  const [courseFileName, setCourseFileName] = useState<string | null>(null);
  const [roomFileName, setRoomFileName] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [aiAnalysis, setAiAnalysis] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'schedule' | 'rooms'>('schedule');
  
  const [allowOverride, setAllowOverride] = useState(false);
  const [iteration, setIteration] = useState(0);
  const maxAttempts = 10; // Tăng số vòng lặp nhưng mỗi vòng sẽ nhanh hơn

  const handleFileUpload = (data: any[], name: string, type: 'course' | 'room') => {
    if (type === 'course') {
      setCourses(data.map(item => ({ ...item, isError: false, suggestedRoom: undefined, validationStatus: 'unchecked' })));
      setCourseFileName(name);
    } else {
      setRooms(data);
      setRoomFileName(name);
    }
    setAiAnalysis(null);
    setIteration(0);
  };

  const removeFile = (type: 'course' | 'room') => {
    if (type === 'course') { setCourses([]); setCourseFileName(null); }
    else { setRooms([]); setRoomFileName(null); }
    setAiAnalysis(null);
    setIteration(0);
  };

  const runAiAnalysis = async () => {
    if (courses.length === 0 || rooms.length === 0) return;
    setIsAnalyzing(true);
    
    let currentCourses = [...courses];
    let attempt = 0;
    let fullLog = "";

    try {
      while (attempt < maxAttempts) {
        attempt++;
        setIteration(attempt);
        
        // 1. Kiểm định trạng thái hiện tại
        currentCourses = validateAISuggestions(currentCourses, rooms);
        
        const needsWork = currentCourses.filter(c => 
          c.validationStatus === 'violated' || 
          c.validationStatus === 'original_violated' || 
          (!c.room || c.room.toLowerCase() === 'null' || c.room.trim() === '')
        );

        if (needsWork.length === 0 && attempt > 1) {
          fullLog = `[HOÀN TẤT] Hệ thống đã hội tụ thành công.\n` + fullLog;
          setAiAnalysis(fullLog);
          break;
        }

        setAiAnalysis(`[Vòng ${attempt}] Đang xử lý ${needsWork.length} lớp còn lại...`);

        const { report, suggestions } = await analyzeSchedule(currentCourses, rooms, allowOverride, attempt);
        
        if (suggestions.length === 0) {
          fullLog = `[Vòng ${attempt}] AI không tìm thấy thêm phương án. Dừng tại đây.\n` + fullLog;
          setAiAnalysis(fullLog);
          break;
        }

        // 2. Cập nhật gợi ý hàng loạt
        const suggestionMap = new Map(suggestions.map(s => [String(s.stt), s.room]));
        
        currentCourses = currentCourses.map(course => {
          const sugRoom = suggestionMap.get(String(course.stt));
          if (sugRoom) {
            const isOriginalEmpty = !course.room || course.room.toLowerCase() === 'null' || course.room.trim() === '';
            if (allowOverride || isOriginalEmpty) {
              return { ...course, suggestedRoom: sugRoom };
            }
          }
          return course;
        });

        // 3. Re-validate
        currentCourses = validateAISuggestions(currentCourses, rooms);
        setCourses([...currentCourses]);
        
        fullLog = `[Vòng ${attempt}] Xếp được ${suggestions.length} lớp. ${report}\n` + fullLog;
        setAiAnalysis(fullLog);
      }
    } catch (error) {
      setAiAnalysis("Lỗi trong chu trình hội tụ turbo.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const originalErrorCount = courses.filter(c => c.validationStatus === 'original_violated').length;
  const verifiedCount = courses.filter(c => c.validationStatus === 'verified').length;
  const aiViolationCount = courses.filter(c => c.validationStatus === 'violated').length;
  const unassignedCount = courses.filter(c => (!c.room || c.room.toLowerCase() === 'null' || c.room.trim() === '') && !c.suggestedRoom).length;
  
  const isDataReady = courses.length > 0 && rooms.length > 0;

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      <header className="bg-slate-900 text-white shadow-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-indigo-600 p-2 rounded-lg">
              <IconDashboard className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-md font-black leading-none uppercase tracking-tighter">UniTime <span className="text-indigo-400">Turbo</span></h1>
              <p className="text-[9px] text-slate-400 mt-1 uppercase font-bold tracking-widest italic">High-Density Batch Processing</p>
            </div>
          </div>
          
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-3 bg-white/5 px-4 py-2 rounded-2xl border border-white/10">
              <Settings2 className="w-4 h-4 text-indigo-400" />
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <div className="relative inline-flex items-center">
                  <input 
                    type="checkbox" 
                    checked={allowOverride} 
                    onChange={(e) => setAllowOverride(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-9 h-5 bg-slate-700 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-indigo-500"></div>
                </div>
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-300">Ghi đè lịch cũ</span>
              </label>
            </div>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-7xl mx-auto w-full p-4 md:p-6 space-y-8">
        {!isDataReady && (
          <div className="py-12 flex flex-col items-center text-center space-y-8">
            <div className="inline-flex items-center gap-2 bg-indigo-50 text-indigo-600 px-4 py-1.5 rounded-full text-[11px] font-black uppercase tracking-widest border border-indigo-100 mb-2 animate-bounce">
              <RefreshCw className="w-3 h-3" />
              Batch processing: 200+ classes / round
            </div>
            <div className="bg-white p-10 rounded-[48px] shadow-2xl shadow-indigo-100 border border-slate-100 max-w-3xl w-full">
              <h2 className="text-4xl font-black text-slate-800 mb-4 tracking-tighter italic">Quản lý Giảng đường Thông minh</h2>
              <div className="grid md:grid-cols-2 gap-6 mt-8">
                <FileUploader type="course" label="Lịch giảng dạy (.xlsx)" fileName={courseFileName} count={courses.length} onUpload={handleFileUpload} onRemove={() => removeFile('course')} />
                <FileUploader type="room" label="Danh sách phòng (.xlsx)" fileName={roomFileName} count={rooms.length} onUpload={handleFileUpload} onRemove={() => removeFile('room')} />
              </div>
            </div>
          </div>
        )}

        {isDataReady && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
              <div className="bg-white p-5 rounded-3xl shadow-sm border border-slate-200">
                <p className="text-[10px] text-slate-400 uppercase font-black tracking-widest">Hợp lệ (Verified)</p>
                <div className="flex items-baseline gap-2 mt-1">
                  <p className="text-3xl font-black text-emerald-600">{verifiedCount}</p>
                  <IconShield className="w-4 h-4 text-emerald-500" />
                </div>
              </div>
              <div className="bg-white p-5 rounded-3xl shadow-sm border border-slate-200">
                <p className="text-[10px] text-slate-400 uppercase font-black tracking-widest">Đang trống</p>
                <div className="flex items-baseline gap-2 mt-1">
                  <p className={`text-3xl font-black ${unassignedCount > 0 ? 'text-amber-500' : 'text-slate-200'}`}>{unassignedCount}</p>
                  <HelpCircle className="w-4 h-4 text-amber-400" />
                </div>
              </div>
              <div className="bg-white p-5 rounded-3xl shadow-sm border border-slate-200">
                <p className="text-[10px] text-slate-400 uppercase font-black tracking-widest">Lỗi Gốc</p>
                <p className={`text-3xl font-black mt-1 ${originalErrorCount > 0 ? 'text-amber-600' : 'text-slate-200'}`}>{originalErrorCount}</p>
              </div>
              <div className="bg-white p-5 rounded-3xl shadow-sm border border-slate-200">
                <p className="text-[10px] text-slate-400 uppercase font-black tracking-widest text-red-400">AI Vi phạm</p>
                <p className={`text-3xl font-black mt-1 ${aiViolationCount > 0 ? 'text-red-600' : 'text-slate-200'}`}>{aiViolationCount}</p>
              </div>
              <button 
                onClick={runAiAnalysis}
                disabled={isAnalyzing}
                className={`text-white font-black rounded-3xl shadow-xl transition-all flex flex-col items-center justify-center gap-1 disabled:opacity-50 active:scale-95
                  ${isAnalyzing ? 'bg-amber-500 shadow-amber-200' : 'bg-indigo-600 shadow-indigo-200 hover:bg-indigo-700'}
                `}
              >
                <div className="flex items-center gap-2">
                  {isAnalyzing ? <Loader2 className="w-4 h-4 animate-spin" /> : <IconAnalyze className="w-4 h-4" />}
                  <span className="text-xs">{isAnalyzing ? `BATCH ${iteration}/${maxAttempts}...` : 'BẮT ĐẦU HỘI TỤ'}</span>
                </div>
                <span className="text-[9px] opacity-70 uppercase tracking-tighter">
                  Greedy Filling Mode
                </span>
              </button>
            </div>

            <div className="bg-white rounded-[32px] shadow-xl border border-slate-200 overflow-hidden">
              <div className="flex border-b border-slate-100 bg-slate-50/50 p-2">
                <button onClick={() => setActiveTab('schedule')} className={`px-8 py-3 text-[11px] font-black rounded-2xl transition-all ${activeTab === 'schedule' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400 hover:text-indigo-600'}`}>LỊCH TRÌNH & KIỂM ĐỊNH</button>
                <button onClick={() => setActiveTab('rooms')} className={`px-8 py-3 text-[11px] font-black rounded-2xl ml-2 transition-all ${activeTab === 'rooms' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400 hover:text-indigo-600'}`}>DANH SÁCH PHÒNG</button>
                <div className="flex-1" />
                <button onClick={() => { setCourses([]); setRooms([]); setAiAnalysis(null); setCourseFileName(null); setRoomFileName(null); setIteration(0); }} className="text-[10px] font-bold text-slate-400 px-6 hover:text-red-500 transition-colors uppercase tracking-widest">Làm mới</button>
              </div>
              <div className="p-0 overflow-hidden">
                {activeTab === 'schedule' ? <TimetableGrid data={courses} /> : <RoomGrid data={rooms} />}
              </div>
            </div>

            {aiAnalysis && (
              <div className="bg-slate-900 border border-slate-800 rounded-[32px] shadow-2xl overflow-hidden p-8">
                <div className="flex items-center gap-3 mb-6">
                  <div className="p-2 bg-indigo-500/20 rounded-xl">
                    <IconSparkles className="w-5 h-5 text-indigo-400" />
                  </div>
                  <h3 className="text-sm font-black uppercase tracking-widest text-white">Log Hội tụ Trí tuệ Nhân tạo</h3>
                </div>
                <div className="text-[11px] text-slate-400 font-mono whitespace-pre-wrap max-h-60 overflow-y-auto custom-scrollbar leading-relaxed">
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

export default App;
