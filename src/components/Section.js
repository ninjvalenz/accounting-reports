import React from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';

const Section = ({ title, icon: Icon, expanded, onToggle, children }) => {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
      <button
        onClick={onToggle}
        className="flex items-center justify-between w-full p-4 bg-gradient-to-r from-slate-50 to-white border-b border-slate-100 hover:from-slate-100 transition-all"
      >
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-100 rounded-lg">
            <Icon size={20} className="text-blue-600" />
          </div>
          <h3 className="text-lg font-semibold text-slate-800">{title}</h3>
        </div>
        {expanded ? (
          <ChevronUp size={20} className="text-slate-400" />
        ) : (
          <ChevronDown size={20} className="text-slate-400" />
        )}
      </button>
      {expanded && <div className="p-4">{children}</div>}
    </div>
  );
};

export default Section;
