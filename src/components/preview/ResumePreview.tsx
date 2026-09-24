import React, { useEffect, useRef, useState } from 'react';
import { useResume } from '../../contexts/ResumeContext';
import { TechSidebarTemplate } from './templates/TechSidebarTemplate';
import { BusinessProfessionalTemplate } from './templates/BusinessProfessionalTemplate';
import { ModernMinimalTemplate } from './templates/ModernMinimalTemplate';
import { ElegantTimelineTemplate } from './templates/ElegantTimelineTemplate';
import { CreativeModernTemplate } from './templates/CreativeModernTemplate';
import { BJetProfessionalTemplate } from './templates/BJetProfessionalTemplate';

export const ResumePreview: React.FC<{ artifact?: boolean }> = ({ artifact = false }) => {
  const { state } = useResume();
  const { resumeData } = state;
  const previewHostRef = useRef<HTMLDivElement>(null);
  const [hostSize, setHostSize] = useState({ width: 500, height: 720 });

  useEffect(() => {
    const el = previewHostRef.current;
    if (!el) return;
    const update = () => setHostSize({
      width: Math.max(1, el.clientWidth - 16),
      height: Math.max(1, el.clientHeight - 16)
    });
    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => observer.disconnect();
  }, [artifact]);

  const visualTemplate = resumeData.template === 'original-upload' && resumeData.originalTemplate?.tailored
    ? (resumeData.originalTemplate.editableTemplate || 'modern-minimal')
    : resumeData.template;

  if (visualTemplate === 'original-upload' && resumeData.originalTemplate?.sourceDataUrl) {
    return (
      <div ref={previewHostRef} className="w-full h-full flex items-center justify-center p-2">
        <div id="resume-content" className="w-full h-full bg-white shadow-xl overflow-hidden">
          {resumeData.originalTemplate.sourceFormat === 'pdf' ? (
            <iframe
              title="Original uploaded resume"
              src={resumeData.originalTemplate.sourceDataUrl}
              className="w-full h-full border-0"
            />
          ) : (
            <div className="p-8 text-sm text-muted-foreground">
              <strong>Original uploaded document:</strong> {resumeData.originalTemplate.sourceFileName}
              <p className="mt-2">The original DOCX is preserved for download. Choose a built-in template to edit and export the parsed content.</p>
            </div>
          )}
        </div>
      </div>
    );
  }

  const renderTemplate = () => {
    switch (visualTemplate) {
      case 'tech-sidebar':
        return <TechSidebarTemplate data={resumeData} />;
      case 'business-professional':
        return <BusinessProfessionalTemplate data={resumeData} />;
      case 'modern-minimal':
        return <ModernMinimalTemplate data={resumeData} />;
      case 'elegant-timeline':
        return <ElegantTimelineTemplate data={resumeData} />;
      case 'creative-modern':
        return <CreativeModernTemplate data={resumeData} />;
      case 'bjet-professional':
        return <BJetProfessionalTemplate data={resumeData} />;
      default:
        return <TechSidebarTemplate data={resumeData} />;
    }
  };

  // Calculate scale to fit within container
  const isA4 = resumeData.pageFormat === 'a4';
  const pageWidth = isA4 ? 794 : 816; // A4: 210mm = 794px, Letter: 8.5in = 816px
  const pageHeight = isA4 ? 1123 : 1056; // A4: 297mm = 1123px, Letter: 11in = 1056px
  const containerWidth = artifact ? hostSize.width : 860;
  const containerHeight = artifact ? hostSize.height : 650;
  const scaleWidth = containerWidth / pageWidth;
  const scaleHeight = containerHeight / pageHeight;
  const scale = Math.min(1, scaleWidth, scaleHeight);

  return (
    <div ref={previewHostRef} className="w-full h-full flex items-center justify-center p-2">
      <div 
        className="bg-white rounded-lg shadow-xl overflow-visible origin-center"
        style={{
          width: pageWidth * scale,
          height: pageHeight * scale,
          maxWidth: '100%',
          maxHeight: '100%'
        }}
      >
        <div 
          id="resume-content"
          className="w-full h-full relative print:shadow-none print:rounded-none overflow-hidden"
          style={{ 
            width: isA4 ? '210mm' : '8.5in',
            height: isA4 ? '297mm' : '11in',
            fontSize: '11px',
            lineHeight: '1.35',
            fontFamily: 'Inter, system-ui, -apple-system, BlinkMacSystemFont, sans-serif',
            padding: '0.75in',
            color: '#1f2937',
            boxSizing: 'border-box',
            transform: `scale(${scale})`,
            transformOrigin: 'top left'
          }}
        >
          {renderTemplate()}
        </div>
      </div>
    </div>
  );
};