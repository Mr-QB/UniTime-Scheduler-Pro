
import React, { useState } from 'react';
import { 
  LayoutDashboard as IconDashboard,
  ShieldCheck as IconShield,
  ShieldAlert as IconShieldAlert,
  Sparkles as IconSparkles,
  PieChart as IconAnalyze,
  UserCheck as IconUser,
  Layers as IconLayers,
  CalendarDays as IconCalendar,
  AlertTriangle,
  FileSpreadsheet,
  Home
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

  const handleFileUpload = (data: any[], name: string, type: 'course' | 'room') => {
    if (type === 'course') {
      setCourses(data.map(item => ({ ...item, isError: false, suggestedRoom: undefined, validationStatus: 'unchecked' })));
      setCourseFileName(name);
    } else {
      setRooms(data);
      setRoomFileName(name);
    }
    setAiAnalysis(null);
  };

  const removeFile = (type: 'course' | 'room') => {
    if (type === 'course') { setCourses([]); setCourseFileName(null); }
    else { setRooms([]); setRoomFileName(null); }
    setAiAnalysis(null);
  };

  const runAiAnalysis = async () => {
    if (courses.length === 0 || rooms.length === 0) return;
    setIsAnalyzing(true);
    try {
      const { report, errorStts, suggestions } = await analyzeSchedule(courses, rooms);
      
      // Step 1: Apply AI Suggestions and initial error marking
      let updatedCourses: CourseData[] = courses.map(course => {
        const suggestion = suggestions.find(s => String(s.stt) === String(course.stt));
        return {
          ...course,
          isError: errorStts.includes(String(course.stt)),
          suggestedRoom: suggestion ? suggestion.room : undefined
        };
      });

      // Step 2: CODE VALIDATION (The source of truth)
      updatedCourses = validateAISuggestions(updatedCourses, rooms);

      setCourses(updatedCourses);
      setAiAnalysis(report);
    } catch (error) {
      setAiAnalysis("Lỗi phân tích AI. Vui lòng thử lại.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const originalErrorCount = courses.filter(c => c.validationStatus === 'original_violated').length;
  const verifiedCount = courses.filter(c => c.validationStatus === 'verified').length;
  const aiViolationCount = courses.filter(c => c.validationStatus === 'violated').length;
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
              <h1 className="text-md font-black leading-none uppercase tracking-tighter">UniTime <span className="text-indigo-400">Hybrid</span></h1>
              <p className="text-[9px] text-slate-400 mt-1 uppercase font-bold tracking-widest italic">AI Proposed + Code Audited</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="hidden md:flex items-center gap-6 mr-6 border-r border-slate-700 pr-6">
               <div className="flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
                  <span className="text-[10px] font-bold text-slate-300 uppercase tracking-wider">Xác minh Code</span>
               </div>
               <div className="flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-full bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.5)]" />
                  <span className="text-[10px] font-bold text-slate-300 uppercase tracking-wider">Đề xuất AI</span>
               </div>
            </div>
            {isDataReady && (
              <div className="bg-indigo-500/20 border border-indigo-400/30 px-3 py-1 rounded-full">
                <span className="text-[10px] font-black uppercase text-indigo-300">Dữ liệu sẵn sàng</span>
              </div>
            )}
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-7xl mx-auto w-full p-4 md:p-6 space-y-8">
        {!isDataReady && (
          <div className="py-12 flex flex-col items-center text-center space-y-8">
             <div className="inline-flex items-center gap-2 bg-indigo-50 text-indigo-600 px-4 py-1.5 rounded-full text-[11px] font-black uppercase tracking-widest border border-indigo-100 mb-2 animate-bounce">
                <IconSparkles className="w-3 h-3" />
                Dùng AI để xếp lịch, dùng Code để kiểm tra
              </div>
            <div className="bg-white p-10 rounded-[48px] shadow-2xl shadow-indigo-100 border border-slate-100 max-w-3xl w-full">
              <h2 className="text-4xl font-black text-slate-800 mb-4 tracking-tighter italic">Hệ thống Điều phối Giảng đường Thông minh</h2>
              <p className="text-slate-500 text-sm leading-relaxed mb-10 max-w-xl mx-auto">
                Nhập file Excel lịch giảng dạy và danh sách phòng học. Hệ thống sẽ sử dụng <b>Gemini 3 Pro</b> để tìm lỗi và gợi ý phòng trống, sau đó đối soát lại bằng logic thuật toán chính xác 100%.
              </p>
              <div className="grid md:grid-cols-2 gap-6">
                <FileUploader type="course" label="Lịch giảng dạy (.xlsx)" fileName={courseFileName} count={courses.length} onUpload={handleFileUpload} onRemove={() => removeFile('course')} />
                <FileUploader type="room" label="Danh sách phòng (.xlsx)" fileName={roomFileName} count={rooms.length} onUpload={handleFileUpload} onRemove={() => removeFile('room')} />
              </div>
            </div>
          </div>
        )}

        {isDataReady && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="bg-white p-5 rounded-3xl shadow-sm border border-slate-200 group hover:border-emerald-200 transition-colors">
                <p className="text-[10px] text-slate-400 uppercase font-black tracking-widest group-hover:text-emerald-500">Đã xác minh</p>
                <div className="flex items-baseline gap-2 mt-1">
                  <p className="text-3xl font-black text-emerald-600">{verifiedCount}</p>
                  <IconShield className="w-4 h-4 text-emerald-500" />
                </div>
              </div>
              <div className="bg-white p-5 rounded-3xl shadow-sm border border-slate-200 group hover:border-red-200 transition-colors">
                <p className="text-[10px] text-slate-400 uppercase font-black tracking-widest text-red-400">AI Đề xuất Sai</p>
                <div className="flex items-baseline gap-2 mt-1">
                  <p className={`text-3xl font-black ${aiViolationCount > 0 ? 'text-red-600' : 'text-slate-200'}`}>{aiViolationCount}</p>
                  <IconShieldAlert className="w-4 h-4 text-red-500" />
                </div>
              </div>
              <div className="bg-white p-5 rounded-3xl shadow-sm border border-slate-200 group hover:border-amber-200 transition-colors">
                <p className="text-[10px] text-slate-400 uppercase font-black tracking-widest text-amber-500">Vi phạm gốc</p>
                <p className={`text-3xl font-black mt-1 ${originalErrorCount > 0 ? 'text-amber-600' : 'text-slate-200'}`}>{originalErrorCount}</p>
              </div>
              <button 
                onClick={runAiAnalysis}
                disabled={isAnalyzing}
                className="bg-indigo-600 hover:bg-indigo-700 text-white font-black rounded-3xl shadow-xl shadow-indigo-200 transition-all flex items-center justify-center gap-3 disabled:opacity-50 active:scale-95"
              >
                <IconAnalyze className={`w-5 h-5 ${isAnalyzing ? 'animate-spin' : ''}`} />
                {isAnalyzing ? 'ĐANG SUY LUẬN & KIỂM ĐỊNH...' : 'CHẠY AI & ĐỐI SOÁT LOGIC'}
              </button>
            </div>

            <div className="bg-white rounded-[32px] shadow-xl border border-slate-200 overflow-hidden">
              <div className="flex border-b border-slate-100 bg-slate-50/50 p-2">
                <button onClick={() => setActiveTab('schedule')} className={`px-8 py-3 text-[11px] font-black rounded-2xl transition-all ${activeTab === 'schedule' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400 hover:text-indigo-600'}`}>LỊCH HỌC & KIỂM ĐỊNH</button>
                <button onClick={() => setActiveTab('rooms')} className={`px-8 py-3 text-[11px] font-black rounded-2xl ml-2 transition-all ${activeTab === 'rooms' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400 hover:text-indigo-600'}`}>DANH SÁCH PHÒNG</button>
                <div className="flex-1" />
                <button onClick={() => { setCourses([]); setRooms([]); setAiAnalysis(null); setCourseFileName(null); setRoomFileName(null); }} className="text-[10px] font-bold text-slate-400 px-6 hover:text-red-500 transition-colors uppercase tracking-widest">Xóa toàn bộ</button>
              </div>
              <div className="p-0 overflow-hidden">
                {activeTab === 'schedule' ? <TimetableGrid data={courses} /> : <RoomGrid data={rooms} />}
              </div>
            </div>

            {aiAnalysis && (
              <div className="bg-white border border-slate-200 rounded-[32px] shadow-sm overflow-hidden p-8 animate-in fade-in duration-1000">
                <div className="flex items-center gap-3 mb-6">
                  <div className="p-2 bg-indigo-50 rounded-xl">
                    <IconSparkles className="w-5 h-5 text-indigo-600" />
                  </div>
                  <h3 className="text-sm font-black uppercase tracking-widest text-slate-800">Tư duy Phân tích của Trí tuệ Nhân tạo</h3>
                </div>
                <div className="prose prose-slate max-w-none text-xs text-slate-600 leading-loose whitespace-pre-wrap font-medium border-l-2 border-indigo-100 pl-6">
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
