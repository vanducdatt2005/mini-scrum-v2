import React, { useState, useEffect } from 'react';
import { getAttachments, uploadAttachment, deleteAttachment } from '../services/api';

export default function AttachmentSection({ entityId, entityType = 'task' }) {
  const [attachments, setAttachments] = useState([]);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (entityId) loadAttachments();
  }, [entityId]);

  const loadAttachments = async () => {
    try {
      const res = await getAttachments(entityType, entityId);
      setAttachments(res.data);
    } catch (err) {
      console.error("Lỗi tải danh sách file:", err);
    }
  };

  const handleFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('file', file);
    formData.append(entityType === 'task' ? 'taskId' : 'userStoryId', entityId);

    try {
      setUploading(true);
      await uploadAttachment(formData);
      await loadAttachments();
    } catch (err) {
      alert("Lỗi tải file lên: " + (err.response?.data?.error || "Vui lòng thử lại"));
    } finally {
      setUploading(false);
      e.target.value = null;
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Bạn muốn xóa tệp này?")) return;
    try {
      await deleteAttachment(id);
      await loadAttachments();
    } catch (err) {
      alert("Lỗi khi xóa tệp");
    }
  };

  const getFileIcon = (type) => {
    if (!type) return 'description';
    if (type.includes('image')) return 'image';
    if (type.includes('pdf')) return 'picture_as_pdf';
    return 'description';
  };

  const baseUrl = import.meta.env.VITE_BACKEND_URL || `http://${window.location.hostname}:5000`;

  return (
    <div className="mt-6 border-t border-outline-variant/20 pt-6">
      <div className="flex justify-between items-center mb-4">
        <h4 className="text-sm font-bold text-on-surface flex items-center gap-2">
          <span className="material-symbols-outlined text-[18px]">attach_file</span>
          Tệp đính kèm ({attachments.length})
        </h4>
        
        <label className={`cursor-pointer flex items-center gap-1 text-[11px] font-bold px-3 py-1.5 rounded-full bg-primary/10 text-primary hover:bg-primary/20 transition-all ${uploading ? 'opacity-50 pointer-events-none' : ''}`}>
          <span className="material-symbols-outlined text-[16px]">{uploading ? 'sync' : 'add'}</span>
          {uploading ? 'Đang tải...' : 'Tải lên'}
          <input type="file" className="hidden" onChange={handleFileChange} disabled={uploading} />
        </label>
      </div>

      <div className="grid grid-cols-1 gap-2">
        {attachments.map((file) => (
          <div key={file.id} className="flex items-center justify-between p-3 rounded-xl bg-surface-container-low border border-outline-variant/10 hover:border-primary/30 transition-all group">
            <div className="flex items-center gap-3 overflow-hidden flex-1">
              <span className="material-symbols-outlined text-primary/70 bg-primary/5 p-2 rounded-lg">
                {getFileIcon(file.fileType)}
              </span>
              <div className="flex flex-col overflow-hidden">
                <a href={`${baseUrl}${file.fileUrl}`} target="_blank" rel="noreferrer" 
                   className="text-[12px] font-bold text-on-surface truncate hover:text-primary transition-colors">
                  {file.fileName}
                </a>
                <span className="text-[10px] text-on-surface-variant/60">
                  {(file.fileSize / 1024).toFixed(1)} KB
                </span>
              </div>
            </div>
            
            <button 
              onClick={() => handleDelete(file.id)}
              className="p-2 text-on-surface-variant/40 hover:text-error transition-colors md:opacity-0 md:group-hover:opacity-100"
              title="Xóa tệp"
            >
              <span className="material-symbols-outlined text-base">delete</span>
            </button>
          </div>
        ))}
        
        {attachments.length === 0 && !uploading && (
          <p className="text-[11px] text-on-surface-variant/50 italic text-center py-2">Chưa có tệp nào</p>
        )}
      </div>
    </div>
  );
}