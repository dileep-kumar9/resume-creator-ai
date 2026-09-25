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
  const [contentHeight, setContentHeight] = useState(1056);
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = previewHostRef.current;
    if (!el) return;
    const update = () => setHostWidth(Math.max(1, el.clientWidth - 16));
    update();
    const observer = new ResizeObserver(() => {
      update();
      if (contentRef.current) setContentHeight(Math.max(1, contentRef.current.scrollHeight));
    });
    observer.observe(el);
    if (contentRef.current) observer.observe(contentRef.current);
    requestAnimationFrame(() => { if (contentRef.current) setContentHeight(Math.max(1, contentRef.current.scrollHeight)); });
    return () => observer.disconnect();
  }, [artifact, resumeData]);

  // The selected template is authoritative. In particular, AI tailoring must
  // never silently replace the user's Original Uploaded Resume selection.
  // Tailored content is still kept in resumeData and can be rendered after the
  // user explicitly chooses a built-in editable template.
  const visualTemplate = resumeData.template;


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
  const measuredContentHeight = Math.max(pageHeight, contentHeight);
  const outerHeight = Math.ceil(measuredContentHeight * scale);

  return (
    <div ref={previewHostRef} className="w-full h-full flex items-start justify-center p-2" style={{overflowX: artifact ? 'hidden' : 'visible', overflowY: 'visible'}}>
      <div
        className="bg-white rounded-lg shadow-xl origin-top-left"
        style={{
          width: outerWidth,
          height: outerHeight,
          maxWidth: '100%',
          flex: '0 0 auto',
          overflow: 'visible'
        }}
      >
        <div
          id="resume-content"
          ref={contentRef}
          className="relative print:shadow-none print:rounded-none" data-control="resume-rendered"
          style={{
            width: isA4 ? '210mm' : '8.5in',
            minHeight: isA4 ? '297mm' : '11in',
            height: 'auto',
            fontSize: `${resumeData.fontSize === 'small' ? 10.5 : resumeData.fontSize === 'large' ? 12.5 : 11}px`,
            lineHeight: '1.35',
            fontFamily: `${resumeData.fontFamily || 'Arial'}, Arial, Helvetica, sans-serif`,
            padding: '0.75in',
            color: resumeData.colors?.text || '#222222',
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