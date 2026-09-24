import { ResumeData } from '../types/resume';
import { extractResumeText, normalizeParsedResume, parseResumeHeuristically, parseResumeWithAI } from './resumeParser';

export const exportResumeAsJSON = (resumeData: ResumeData, filename?: string) => {
  try {
    const dataBlob = new Blob([JSON.stringify(resumeData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a'); link.href = url;
    link.download = filename || `resume-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(link); link.click(); link.remove(); URL.revokeObjectURL(url); return true;
  } catch (error) { console.error(error); return false; }
};

export async function importResumeFromFile(file: File, useAI = true): Promise<ResumeData> {
  const ext = file.name.toLowerCase().endsWith('.pdf') ? 'pdf'
    : file.name.toLowerCase().endsWith('.docx') ? 'docx'
    : file.name.toLowerCase().endsWith('.txt') ? 'txt' : 'json';
  if (file.name.toLowerCase().endsWith('.json')) {
    const parsed = JSON.parse(await file.text());
    if (!parsed.personalInfo || !parsed.sections || !parsed.colors) throw new Error('Invalid resume JSON format.');
    const data = normalizeParsedResume(parsed);
    return { ...data, originalTemplate: parsed.originalTemplate };

  }
  const isPdf = file.name.toLowerCase().endsWith('.pdf');
  if (useAI && isPdf) {
    const bytes = new Uint8Array(await file.arrayBuffer());
    let binary = '';
    const chunk = 0x8000;
    for (let i = 0; i < bytes.length; i += chunk) binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
    const data = await parseResumeWithAI({ pdfBase64: btoa(binary) });
    return { ...data, template: 'original-upload', originalTemplate: { sourceFileName: file.name, sourceFormat: 'pdf', importedAt: new Date().toISOString(), sourceDataUrl: `data:application/pdf;base64,${btoa(binary)}`, editableTemplate: 'modern-minimal' } };
  }
  const text = await extractResumeText(file);
  if (!text.trim()) throw new Error('No readable text was found in this resume. Scanned/image-only PDFs need OCR before import.');
  const data = useAI ? await parseResumeWithAI({ text }) : parseResumeHeuristically(text);
  const mime = ext === 'docx' ? 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' : 'text/plain';
  const bytes = new Uint8Array(await file.arrayBuffer());
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  return { ...data, template: 'original-upload', originalTemplate: { sourceFileName: file.name, sourceFormat: ext, importedAt: new Date().toISOString(), sourceDataUrl: `data:${mime};base64,${btoa(binary)}`, editableTemplate: 'modern-minimal' } };
}

export const importResumeFromJSON = (file: File) => importResumeFromFile(file, false);
