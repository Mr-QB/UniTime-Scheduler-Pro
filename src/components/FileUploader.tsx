
import React, { useRef, useState } from 'react';
import * as XLSX from 'xlsx';
import { Upload, FileSpreadsheet, AlertTriangle, Home, CheckCircle2, X, RefreshCw } from 'lucide-react';
import { CourseData, RoomData } from '../types';

interface FileUploaderProps {
  onUpload: (data: any[], fileName: string, type: 'course' | 'room') => void;
  onRemove: () => void;
  type: 'course' | 'room';
  label: string;
  fileName: string | null;
  count: number;
}

const FileUploader: React.FC<FileUploaderProps> = ({ onUpload, onRemove, type, label, fileName, count }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const processFile = (file: File) => {
    if (!file.name.endsWith('.xlsx') && !file.name.endsWith('.xls')) {
      setError("Vui lòng tải lên tệp Excel (.xlsx hoặc .xls)");
      return;
    }

    try {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = e.target?.result;
          if (!data) {
            setError("Không thể đọc dữ liệu file");
            return;
          }
          
          const workbook = XLSX.read(data, { type: 'binary' });
          const sheetName = workbook.SheetNames[0];
          if (!sheetName) {
            setError("File Excel không có sheet nào");
            return;
          }
          
          const worksheet = workbook.Sheets[sheetName];
          const json = XLSX.utils.sheet_to_json<any>(worksheet);
          
          if (!json || json.length === 0) {
            setError("File Excel không có dữ liệu");
            return;
          }

          if (type === 'course') {
            const formattedData: CourseData[] = json.map((row: any) => ({
              stt: row['STT'] || '',
              courseCode: row['Mã học phần'] || row['Mã HP'] || '',
              courseName: row['Tên học phần'] || row['Học phần'] || '',
              credits: row['Số tín chỉ'] || row['Số TC'] || 0,
              sectionCode: row['Mã lớp học phần'] || row['Mã LHP'] || '',
              lecturer: row['Giảng viên'] || row['Giảng Viên'] || '',
              studentCount: Number(row['Số sinh viên'] || row['Số SV'] || 0),
              registeredCount: Number(row['Số đăng ký'] || row['Số ĐK'] || 0),
              dayOfWeek: row['Thứ'] || '',
              period: row['Tiết'] || '',
              room: row['Giảng đường'] || '',
              duration: row['Thời lượng'] || '',
              validationStatus: 'unchecked' as const
            }));
            onUpload(formattedData, file.name, 'course');
          } else {
            const formattedData: RoomData[] = json.map((row: any) => ({
              stt: row['STT'] || '',
              roomName: row['Phòng'] || row['Tên phòng'] || '',
              capacity: Number(row['SL'] || row['Số lượng'] || row['Sức chứa'] || 0),
            }));
            onUpload(formattedData, file.name, 'room');
          }
          setError(null);
        } catch (err) {
          setError("Có lỗi khi xử lý file Excel: " + (err instanceof Error ? err.message : String(err)));
          console.error(err);
        }
      };
      reader.readAsBinaryString(file);
    } catch (err) {
      setError("Lỗi khi đọc file: " + (err instanceof Error ? err.message : String(err)));
      console.error(err);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
    e.target.value = ''; // Reset input
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) processFile(file);
  };

  // Nếu đã có file, hiển thị thẻ Trạng thái thành công
  if (fileName) {
    return (
      <div className="w-full bg-emerald-50 border-2 border-emerald-200 rounded-2xl p-6 relative group animate-in zoom-in-95 duration-200">
        <button 
          onClick={onRemove}
          className="absolute top-3 right-3 p-1.5 bg-emerald-100 text-emerald-600 rounded-full hover:bg-red-100 hover:text-red-600 transition-colors"
          title="Xóa tệp"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="flex items-center gap-4">
          <div className="bg-emerald-500 p-3 rounded-xl shadow-lg shadow-emerald-200">
            {type === 'course' ? <FileSpreadsheet className="w-6 h-6 text-white" /> : <Home className="w-6 h-6 text-white" />}
          </div>
          <div className="flex-1 min-w-0">
            <h4 className="text-emerald-900 font-bold text-sm truncate">{fileName}</h4>
            <div className="flex items-center gap-2 mt-1">
              <span className="flex items-center gap-1 text-[11px] font-bold text-emerald-600 bg-emerald-100 px-2 py-0.5 rounded">
                <CheckCircle2 className="w-3 h-3" />
                {count} {type === 'course' ? 'Lớp học' : 'Phòng học'}
              </span>
              <span className="text-[10px] text-emerald-400 italic">Đã sẵn sàng phân tích</span>
            </div>
          </div>
        </div>
        
        <div className="mt-4 pt-4 border-t border-emerald-100">
          <button 
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-2 text-[11px] font-bold text-emerald-700 hover:text-indigo-600 transition-colors uppercase tracking-wider"
          >
            <RefreshCw className="w-3 h-3" />
            Thay đổi tệp khác
          </button>
        </div>
        <input type="file" ref={fileInputRef} onChange={handleFileChange} accept=".xlsx, .xls" className="hidden" />
      </div>
    );
  }

  // Khung upload mặc định (Dropzone)
  return (
    <div className="w-full">
      <div
        className={`relative group border-2 border-dashed rounded-2xl p-8 transition-all flex flex-col items-center justify-center cursor-pointer min-h-[180px]
          ${isDragging ? 'border-indigo-500 bg-indigo-50' : 'border-slate-300 hover:border-indigo-400 bg-white shadow-sm'}
        `}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
      >
        <div className={`p-4 rounded-2xl mb-4 transition-colors ${isDragging ? 'bg-indigo-100' : 'bg-slate-100 group-hover:bg-indigo-50'}`}>
          {type === 'course' ? (
            <FileSpreadsheet className={`w-8 h-8 ${isDragging ? 'text-indigo-600' : 'text-slate-400 group-hover:text-indigo-500'}`} />
          ) : (
            <Home className={`w-8 h-8 ${isDragging ? 'text-indigo-600' : 'text-slate-400 group-hover:text-indigo-500'}`} />
          )}
        </div>
        
        <p className="text-sm font-bold text-slate-700">{label}</p>
        <p className="text-slate-400 text-xs mt-2 text-center max-w-[200px] leading-relaxed">Kéo thả tệp Excel vào đây hoặc nhấp để chọn từ máy tính</p>
        
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileChange}
          accept=".xlsx, .xls"
          className="hidden"
        />

        {error && (
          <div className="mt-4 flex items-center gap-2 text-red-600 bg-red-50 px-3 py-1.5 rounded-lg border border-red-100 text-[10px] font-bold">
            <AlertTriangle className="w-3 h-3" />
            {error}
          </div>
        )}
      </div>
    </div>
  );
};

export default FileUploader;
