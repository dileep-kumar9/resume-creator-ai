import { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType, ExternalHyperlink } from 'docx';
import { ResumeData } from '../types/resume';
import { normalizeUrl } from './links';

const downloadBlob = (blob: Blob, filename: string) => {
  const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
};

export async function exportResumeToPDF(element: HTMLElement, data: ResumeData) {
  // Original is a preserved reference. Once tailored, the live artifact renders the editable layout.
  // Exporting that live artifact keeps the tailored content rather than downloading the original PDF.
  // html2pdf keeps the exact live template DOM/CSS, unlike rebuilding the resume in a second renderer.
  const html2pdf = (await import('html2pdf.js')).default;
  const clone = element.cloneNode(true) as HTMLElement;
  clone.style.transform = 'none'; clone.style.width = data.pageFormat === 'a4' ? '210mm' : '8.5in';
  clone.style.height = 'auto'; clone.style.minHeight = data.pageFormat === 'a4' ? '297mm' : '11in'; clone.style.overflow = 'visible'; clone.style.boxShadow = 'none'; clone.style.borderRadius = '0';
  const wrapper = document.createElement('div'); wrapper.style.position = 'fixed'; wrapper.style.left = '-100000px'; wrapper.style.top = '0'; wrapper.style.width = clone.style.width; wrapper.appendChild(clone); document.body.appendChild(wrapper);
  try {
    await html2pdf().set({
      margin: 0, filename: `${safeName(data.personalInfo.fullName || 'resume')}.pdf`,
      image: { type: 'jpeg', quality: 0.98 }, html2canvas: { scale: 2, useCORS: true, backgroundColor: '#ffffff', windowWidth: clone.scrollWidth },
      pagebreak: { mode: ['css', 'legacy'], avoid: ['section', 'h2'] },
      jsPDF: { unit: 'mm', format: data.pageFormat === 'a4' ? 'a4' : 'letter', orientation: 'portrait' },
      enableLinks: true
    }).from(clone).save();
  } finally { wrapper.remove(); }
}

const safeName = (name: string) => name.replace(/[^a-z0-9_-]+/gi, '-').replace(/-+/g, '-').replace(/^-|-$/g, '').toLowerCase() || 'resume';

export async function exportResumeToDOCX(data: ResumeData) {
  const primary = data.colors.primary.replace('#', '');
  const font = data.fontFamily || 'Arial';
  const p = data.personalInfo;
  const children: any[] = [];
  const skills = data.skills.mode === 'simple' ? data.skills.simple : data.skills.categorized.flatMap((c) => c.skills);

  const heading = (text: string) => new Paragraph({
    text, heading: HeadingLevel.HEADING_2,
    style: 'ResumeHeading', spacing: { before: 220, after: 100 }
  });
  const bullet = (text: string) => new Paragraph({ children: [new TextRun({ text, font, size: 19 })], bullet: { level: 0 }, spacing: { after: 60 } });
  const body = (text: string, bold = false) => new Paragraph({ children: [new TextRun({ text, bold, font, size: 19 })], spacing: { after: 70 } });

  const header = new Paragraph({ alignment: data.template === 'business-professional' || data.template === 'elegant-timeline' ? AlignmentType.CENTER : AlignmentType.LEFT,
    children: [new TextRun({ text: p.fullName || 'Resume', bold: true, color: primary, font, size: 34 })], spacing: { after: 70 } });
  const title = p.jobTitle ? new Paragraph({ alignment: data.template === 'business-professional' || data.template === 'elegant-timeline' ? AlignmentType.CENTER : AlignmentType.LEFT,
    children: [new TextRun({ text: p.jobTitle, font, size: 23, color: data.colors.secondary.replace('#', '') })], spacing: { after: 90 } }) : null;
  const contactParts: any[] = [];
  const addContact = (label: string, value?: string) => { if (!value) return; if (contactParts.length) contactParts.push(new TextRun({ text: '  |  ', font, size: 17 })); const url = normalizeUrl(value); if (/^(https?:\/\/|mailto:|tel:)/i.test(url)) contactParts.push(new ExternalHyperlink({ children: [new TextRun({ text: label, font, size: 17, color: primary, underline: {} })], link: url })); else contactParts.push(new TextRun({ text: label, font, size: 17 })); };
  addContact(p.email, p.email ? `mailto:${p.email}` : ''); addContact(p.phone, p.phone ? `tel:${p.phone.replace(/[^+\d]/g,'')}` : ''); addContact(p.location); addContact('LinkedIn', p.linkedin); addContact('Portfolio', p.website);
  const contacts = new Paragraph({ alignment: data.template === 'business-professional' || data.template === 'elegant-timeline' ? AlignmentType.CENTER : AlignmentType.LEFT, children: contactParts, spacing: { after: 160 } });
  children.push(header); if (title) children.push(title); children.push(contacts);

  if (data.summary) { children.push(heading('Professional Summary')); children.push(body(data.summary)); }
  if (data.experience.length) {
    children.push(heading('Experience'));
    for (const e of data.experience) {
      children.push(body(`${e.jobTitle}${e.company ? ` — ${e.company}` : ''}`, true));
      children.push(body(`${e.startDate}${e.endDate ? ` – ${e.endDate}` : e.current ? ' – Present' : ''}${e.location ? ` | ${e.location}` : ''}`));
      for (const b of e.bulletPoints || []) children.push(bullet(b));
      if (!e.bulletPoints?.length && e.description) children.push(body(e.description));
    }
  }
  if (data.projects.length) {
    children.push(heading('Projects'));
    for (const project of data.projects) {
      children.push(body(project.title, true));
      if (project.technologies.length) children.push(body(`Technologies: ${project.technologies.join(', ')}`));
      if (project.description) children.push(body(project.description));
      if (project.liveUrl || project.githubUrl) { const links: any[] = []; if (project.liveUrl) links.push(new ExternalHyperlink({ children: [new TextRun({ text: 'Live', font, size: 17, color: primary, underline: {} })], link: normalizeUrl(project.liveUrl) })); if (project.githubUrl) { if (links.length) links.push(new TextRun({ text: ' | ', font, size: 17 })); links.push(new ExternalHyperlink({ children: [new TextRun({ text: 'Code', font, size: 17, color: primary, underline: {} })], link: normalizeUrl(project.githubUrl) })); } children.push(new Paragraph({ children: links, spacing: { after: 70 } })); }
    }
  }
  if (data.education.length) {
    children.push(heading('Education'));
    for (const e of data.education) children.push(body(`${e.degree}${e.institution ? ` — ${e.institution}` : ''}${e.graduationYear ? ` (${e.graduationYear})` : ''}`, true));
  }
  if (skills.length) { children.push(heading('Skills')); children.push(body(skills.join(' • '))); }

  const sectionChildren = children;
  const doc = new Document({
    styles: { paragraphStyles: [{ id: 'ResumeHeading', name: 'Resume Heading', basedOn: 'Normal', next: 'Normal', run: { font, bold: true, color: primary, size: 22 }, paragraph: { spacing: { before: 220, after: 100 } } }] },
    sections: [{ properties: { page: { size: data.pageFormat === 'a4' ? { width: 11906, height: 16838 } : { width: 12240, height: 15840 }, margin: { top: 850, right: 850, bottom: 850, left: 850 } } }, children: sectionChildren }]
  });
  const blob = await Packer.toBlob(doc); downloadBlob(blob, `${safeName(p.fullName || 'resume')}-${data.template === 'original-upload' ? (data.originalTemplate?.editableTemplate || 'tailored') : data.template}.docx`);
}
