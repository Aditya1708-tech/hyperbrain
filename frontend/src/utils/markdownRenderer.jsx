import React from 'react';

const parseInlineMarkdown = (text) => {
  if (!text) return "";
  // Split the text by "**" to parse bold elements
  const parts = text.split('**');
  return parts.map((part, i) => {
    // Every odd index was surrounded by **
    if (i % 2 === 1) {
      return <strong key={i} className="font-bold text-slate-900 dark:text-slate-100">{part}</strong>;
    }
    return part;
  });
};

export const renderMarkdown = (text) => {
  if (!text) return null;
  
  // Split the text by newlines
  const lines = text.split('\n');
  
  return (
    <div className="space-y-1.5 break-words">
      {lines.map((line, index) => {
        let trimmed = line.trim();
        
        // Check for headings
        if (trimmed.startsWith('### ')) {
          return (
            <h3 key={index} className="text-[12px] font-bold text-slate-800 dark:text-slate-200 mt-3 mb-1 uppercase tracking-wide">
              {parseInlineMarkdown(trimmed.replace('### ', ''))}
            </h3>
          );
        }
        if (trimmed.startsWith('## ')) {
          return (
            <h2 key={index} className="text-[13px] font-extrabold text-slate-900 dark:text-slate-100 mt-4 mb-1.5 uppercase tracking-wide border-b border-border-theme pb-0.5">
              {parseInlineMarkdown(trimmed.replace('## ', ''))}
            </h2>
          );
        }
        if (trimmed.startsWith('# ')) {
          return (
            <h1 key={index} className="text-[14px] font-black text-primary mt-5 mb-2 uppercase tracking-wide">
              {parseInlineMarkdown(trimmed.replace('# ', ''))}
            </h1>
          );
        }
        
        // Check for list items
        if (trimmed.startsWith('* ') || trimmed.startsWith('- ')) {
          const cleanLine = trimmed.replace(/^[*+-]\s+/, '');
          return (
            <div key={index} className="flex items-start space-x-1.5 ml-2.5 my-0.5">
              <span className="text-slate-400 select-none">•</span>
              <span className="text-[11px] text-slate-650 dark:text-slate-350 leading-relaxed">
                {parseInlineMarkdown(cleanLine)}
              </span>
            </div>
          );
        }

        // Check for simple horizontal rules
        if (trimmed === '---') {
          return <hr key={index} className="my-3 border-border-theme" />;
        }
        
        // Default text line
        if (trimmed === '') {
          return <div key={index} className="h-1" />;
        }
        
        return (
          <p key={index} className="text-[11px] text-slate-650 dark:text-slate-350 leading-relaxed">
            {parseInlineMarkdown(line)}
          </p>
        );
      })}
    </div>
  );
};
