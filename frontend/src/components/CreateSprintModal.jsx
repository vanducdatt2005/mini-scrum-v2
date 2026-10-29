import { useState } from "react";
import { createSprint } from "../services/api";

export default function CreateSprintModal({ isOpen, onClose, projectId, onCreated }) {
  const [formData, setFormData] = useState({
    name: "",
    goal: "",
    startDate: "",
    endDate: "",
  });
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await createSprint(projectId, formData);
      onCreated();
      onClose();
    } catch (err) {
      console.error("Error creating sprint:", err);
      alert("Khởi tạo Sprint thất bại. Vui lòng kiểm tra lại dữ liệu.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
      <div className="bg-surface rounded-3xl w-full max-w-md shadow-2xl overflow-hidden border border-outline-variant/20 animate-in fade-in zoom-in duration-300">
        <div className="p-6 border-b border-outline-variant/10 flex justify-between items-center">
          <h2 className="text-xl font-bold text-on-surface font-['Manrope']">Create New Sprint</h2>
          <button onClick={onClose} className="p-2 hover:bg-surface-container rounded-full transition-colors">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>
        
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-on-surface-variant mb-1">Sprint Name</label>
            <input 
              required
              className="w-full bg-surface-container text-on-surface px-4 py-3 rounded-xl border border-transparent focus:border-primary focus:ring-0 outline-none transition-all placeholder:text-outline"
              placeholder="e.g. Sprint 1, Q1 Launch"
              value={formData.name}
              onChange={(e) => setFormData({...formData, name: e.target.value})}
            />
          </div>
          
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-on-surface-variant mb-1">Sprint Goal</label>
            <textarea 
              className="w-full bg-surface-container text-on-surface px-4 py-3 rounded-xl border border-transparent focus:border-primary focus:ring-0 outline-none transition-all placeholder:text-outline min-h-[100px] resize-none"
              placeholder="What do we want to achieve?"
              value={formData.goal}
              onChange={(e) => setFormData({...formData, goal: e.target.value})}
            />
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-on-surface-variant mb-1">Start Date</label>
              <input 
                type="date"
                className="w-full bg-surface-container text-on-surface px-4 py-3 rounded-xl border border-transparent focus:border-primary outline-none transition-all"
                value={formData.startDate}
                onChange={(e) => setFormData({...formData, startDate: e.target.value})}
              />
            </div>
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-on-surface-variant mb-1">End Date</label>
              <input 
                type="date"
                className="w-full bg-surface-container text-on-surface px-4 py-3 rounded-xl border border-transparent focus:border-primary outline-none transition-all"
                value={formData.endDate}
                onChange={(e) => setFormData({...formData, endDate: e.target.value})}
              />
            </div>
          </div>
          
          <div className="pt-4 flex gap-3">
            <button 
              type="button"
              onClick={onClose}
              className="flex-1 px-6 py-3 rounded-xl font-bold text-on-surface-variant hover:bg-surface-container transition-all"
            >
              Cancel
            </button>
            <button 
              type="submit"
              disabled={loading}
              className="flex-1 px-6 py-3 rounded-xl font-bold bg-primary text-on-primary shadow-lg hover:shadow-primary/20 hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50 disabled:scale-100"
            >
              {loading ? "Creating..." : "Create Sprint"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
