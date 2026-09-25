import React, { useEffect, useRef, useState } from 'react';
import { useResume } from '../../contexts/ResumeContext';
import { TechSidebarTemplate } from './templates/TechSidebarTemplate';
import { BusinessProfessionalTemplate } from './templates/BusinessProfessionalTemplate';
import { ModernMinimalTemplate } from './templates/ModernMinimalTemplate';
import { ElegantTimelineTemplate } from './templates/ElegantTimelineTemplate';
import { CreativeModernTemplate } from './templates/CreativeModernTemplate';
import { BJetProfessionalTemplate } from './templates/BJetProfessionalTemplate';
import { OriginalUploadedTemplate } from './templates/OriginalUploadedTemplate';

export const ResumePreview: React.FC<{ artifact?: boolean }> = ({ artifact = false }) => {
  const { state } = useResume();
  const { resumeData } = state;
  const previewHostRef = useRef<HTMLDivElement>(null);
  const [hostWidth, setHostWidth] = useState(500);

  useEffect(() => {
    const el = previewHostRef.current;
    if (!el) return;
    const update = () => setHostWidth(Math.max(1, el.clientWidth - 16));
    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => observer.disconnect();
  }, [artifact]);

  // The selected template is authoritative. In particular, AI tailoring must
  // never silently replace the user's Original Uploaded Resume selection.
  // Tailored content is still kept in resumeData and can be rendered after the
  // user explicitly chooses a built-in editable template.
  const visualTemplate = resumeData.template;

  if (visualTemplate === 'original-upload' && resumeData.originalTemplate?.sourceDataUrl && !resumeData.originalTemplate.tailored) {
    return (
      <div ref={previewHostRef} className="w-full h-full flex items-center justify-center p-2">
        <div id="resume-content" className="w-full h-full bg-white shadow-xl overflow-hidden">
          {resumeData.originalTemplate.sourceFormat === 'pdf' ? (
            <iframe title="Original uploaded resume" src={resumeData.originalTemplate.sourceDataUrl} className="w-full h-full border-0" />
          ) : (
            <div className="p-8 text-sm text-muted-foreground"><strong>Original uploaded document:</strong> {resumeData.originalTemplate.sourceFileName}<p className="mt-2">The original document is preserved as uploaded.</p></div>
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
      case 'original-upload':
        return <OriginalUploadedTemplate data={resumeData} />;
      default:
        return <TechSidebarTemplate data={resumeData} />;
    }
  };

  const isA4 = resumeData.pageFormat === 'a4';
  const pageWidth = isA4 ? 794 : 816;
  const pageHeight = isA4 ? 1123 : 1056;
  const containerWidth = artifact ? hostWidth : 860;
  const scaleWidth = Math.max(0.2, Math.min(1, containerWidth / pageWidth));

  // The artifact is a real document viewer. Its outer page follows the panel
  // width and the inner A4/Letter document is scaled once. This avoids the old
  // double-sizing path that produced a large blank white page with microscopic
  // content when the artifact was resized.
  const scale = scaleWidth;
  const outerWidth = artifact ? Math.max(220, Math.floor(containerWidth)) : Math.floor(pageWidth * scale);
  const outerHeight = artifact ? Math.ceil(pageHeight * scale) : Math.floor(pageHeight * scale);

  return (
    <div ref={previewHostRef} className="w-full h-full flex items-start justify-center p-2" style={{overflowX: artifact ? 'hidden' : 'visible'}}>
      <div
        className="bg-white rounded-lg shadow-xl origin-top-left"
        style={{
          width: outerWidth,
          height: outerHeight,
          maxWidth: '100%',
          flex: '0 0 auto',
          overflow: 'hidden'
        }}
      >
        <div
          id="resume-content"
          className="relative print:shadow-none print:rounded-none overflow-hidden"
          style={{
            width: isA4 ? '210mm' : '8.5in',
            height: isA4 ? '297mm' : '11in',
            fontSize: artifact ? `${Math.max(11, 11 / scale)}px` : '11px',
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