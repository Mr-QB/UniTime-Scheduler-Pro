
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
  Loader2
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
  
  // New States
  const [allowOverride, setAllowOverride] = useState(false);
  const [iteration, setIteration] = useState(0);

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
    setAiAnalysis("Đang khởi động chu kỳ phân tích...");
    
    let currentCourses = [...courses];
    let maxAttempts = 3;
    let attempt = 0;
    let finalReport = "";

    try {
      while (attempt < maxAttempts) {
        attempt++;
        setIteration(attempt);
        setAiAnalysis(`Vòng lặp ${attempt}/${maxAttempts}: AI đang tính toán phương án...`);

        // Gửi danh sách lỗi hiện tại (nếu có) để AI biết đường sửa
        const currentErrors = currentCourses
          .filter(c => c.validationStatus === 'violated' || (allowOverride && c.validationStatus === 'original_violated'))
          .map(c => `STT ${c.stt}: ${c.validationError}`);

        const { report, suggestions } = await analyzeSchedule(currentCourses, rooms, allowOverride, currentErrors);
        finalReport = report;

        // Cập nhật gợi ý từ AI
        // Fix: Explicitly type nextCourses as CourseData[] to avoid inference issues where suggestedRoom is incorrectly seen as required
        let nextCourses: CourseData[] = currentCourses.map(course => {
          const suggestion = suggestions.find(s => String(s.stt) === String(course.stt));
          return {
            ...course,
            suggestedRoom: suggestion ? suggestion.room : course.suggestedRoom
          };
        });

        // Code Validator kiểm tra lại ngay lập tức
        nextCourses = validateAISuggestions(nextCourses, rooms);
        
        // Kiểm tra xem còn lỗi "AI Sai" (violated) không?
        const hasAiViolations = nextCourses.some(c => c.validationStatus === 'violated');
        
        currentCourses = nextCourses;
        setCourses([...currentCourses]);

        if (!hasAiViolations) {
          setAiAnalysis(`Thành công rực rỡ! AI đã tìm được phương án không lỗi sau ${attempt} lần thử.\n\n${finalReport}`);
          break; 
        }

        if (attempt === maxAttempts) {
          setAiAnalysis(`Đã đạt giới hạn ${maxAttempts} lần thử. Một số lỗi phức tạp vẫn tồn tại, vui lòng kiểm tra thủ công.\n\n${finalReport}`);
        }
      }
    } catch (error) {
      setAiAnalysis("Lỗi hệ thống trong quá trình lặp. Vui lòng thử lại.");
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
              <h1 className="text-md font-black leading-none uppercase tracking-tighter">UniTime <span className="text-indigo-400">Hybrid</span></h1>
              <p className="text-[9px] text-slate-400 mt-1 uppercase font-bold tracking-widest italic italic">AI-Driven Optimization Loop</p>
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
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-300">Cho phép sửa phòng đã xếp</span>
              </label>
            </div>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-7xl mx-auto w-full p-4 md:p-6 space-y-8">
        {!isDataReady && (
          <div className="py-12 flex flex-col items-center text-center space-y-8">
            <div className="inline-flex items-center gap-2 bg-indigo-50 text-indigo-600 px-4 py-1.5 rounded-full text-[11px] font-black uppercase tracking-widest border border-indigo-100 mb-2 animate-bounce">
              <IconSparkles className="w-3 h-3" />
              Chu trình lặp thông minh tự sửa lỗi
            </div>
            <div className="bg-white p-10 rounded-[48px] shadow-2xl shadow-indigo-100 border border-slate-100 max-w-3xl w-full">
              <h2 className="text-4xl font-black text-slate-800 mb-4 tracking-tighter italic">Hệ thống Điều phối Giảng đường</h2>
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
                <p className="text-[10px] text-slate-400 uppercase font-black tracking-widest">Đã xác minh</p>
                <div className="flex items-baseline gap-2 mt-1">
                  <p className="text-3xl font-black text-emerald-600">{verifiedCount}</p>
                  <IconShield className="w-4 h-4 text-emerald-500" />
                </div>
              </div>
              <div className="bg-white p-5 rounded-3xl shadow-sm border border-slate-200">
                <p className="text-[10px] text-slate-400 uppercase font-black tracking-widest">Chưa có phòng</p>
                <div className="flex items-baseline gap-2 mt-1">
                  <p className={`text-3xl font-black ${unassignedCount > 0 ? 'text-amber-500' : 'text-slate-200'}`}>{unassignedCount}</p>
                  <HelpCircle className="w-4 h-4 text-amber-400" />
                </div>
              </div>
              <div className="bg-white p-5 rounded-3xl shadow-sm border border-slate-200">
                <p className="text-[10px] text-slate-400 uppercase font-black tracking-widest">Sai Gốc</p>
                <p className={`text-3xl font-black mt-1 ${originalErrorCount > 0 ? 'text-amber-600' : 'text-slate-200'}`}>{originalErrorCount}</p>
              </div>
              <div className="bg-white p-5 rounded-3xl shadow-sm border border-slate-200">
                <p className="text-[10px] text-slate-400 uppercase font-black tracking-widest text-red-400">AI Sai</p>
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
                  <span className="text-xs">{isAnalyzing ? `ĐANG THỬ LẦN ${iteration}` : 'CHẠY VÒNG LẶP AI'}</span>
                </div>
                <span className="text-[9px] opacity-70 uppercase tracking-tighter">
                  {allowOverride ? 'Toàn quyền điều phối' : 'Chỉ điền ô trống'}
                </span>
              </button>
            </div>

            <div className="bg-white rounded-[32px] shadow-xl border border-slate-200 overflow-hidden">
              <div className="flex border-b border-slate-100 bg-slate-50/50 p-2">
                <button onClick={() => setActiveTab('schedule')} className={`px-8 py-3 text-[11px] font-black rounded-2xl transition-all ${activeTab === 'schedule' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400 hover:text-indigo-600'}`}>LỊCH HỌC & KIỂM ĐỊNH</button>
                <button onClick={() => setActiveTab('rooms')} className={`px-8 py-3 text-[11px] font-black rounded-2xl ml-2 transition-all ${activeTab === 'rooms' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400 hover:text-indigo-600'}`}>DANH SÁCH PHÒNG</button>
                <div className="flex-1" />
                <button onClick={() => { setCourses([]); setRooms([]); setAiAnalysis(null); setCourseFileName(null); setRoomFileName(null); setIteration(0); }} className="text-[10px] font-bold text-slate-400 px-6 hover:text-red-500 transition-colors uppercase tracking-widest">Xóa dữ liệu</button>
              </div>
              <div className="p-0 overflow-hidden">
                {activeTab === 'schedule' ? <TimetableGrid data={courses} /> : <RoomGrid data={rooms} />}
              </div>
            </div>

            {aiAnalysis && (
              <div className="bg-white border border-slate-200 rounded-[32px] shadow-sm overflow-hidden p-8">
                <div className="flex items-center gap-3 mb-6">
                  <IconSparkles className="w-5 h-5 text-indigo-600" />
                  <h3 className="text-sm font-black uppercase tracking-widest text-slate-800">Nhật ký Phân tích & Tự sửa lỗi</h3>
                </div>
                <div className="text-xs text-slate-600 whitespace-pre-wrap font-medium border-l-2 border-indigo-100 pl-6 leading-relaxed">
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
