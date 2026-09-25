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
  // Always keep a local, source-grounded parse as a safety net. AI extraction
  // can return a syntactically valid but incomplete object during provider
  // overload; merging it over the local parse prevents projects, experience,
  // education or contact fields from disappearing.
  const text = await extractResumeText(file);
  if (!text.trim()) throw new Error('No readable text was found in this resume. Scanned/image-only PDFs need OCR before import.');
  const localData = parseResumeHeuristically(text);

  if (useAI && isPdf) {
    const bytes = new Uint8Array(await file.arrayBuffer());
    let binary = '';
    const chunk = 0x8000;
    for (let i = 0; i < bytes.length; i += chunk) binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
    let aiData: ResumeData;
    try {
      aiData = await parseResumeWithAI({ pdfBase64: btoa(binary) });
    } catch {
      aiData = localData;
    }
    let data = normalizeParsedResume(aiData, localData);
    // Never allow a valid-but-sparse AI extraction to hide source sections.
    // Merge each core collection from the local text parse when the AI result
    // omitted it. This is deliberately additive: AI can improve fields, but it
    // cannot erase factual source entries.
    data = {
      ...data,
      experience: data.experience.length ? data.experience : localData.experience,
      projects: data.projects.length ? data.projects : localData.projects,
      education: data.education.length ? data.education : localData.education,
      skills: (data.skills.simple.length || data.skills.categorized.length) ? data.skills : localData.skills,
      summary: data.summary || localData.summary,
      personalInfo: { ...localData.personalInfo, ...data.personalInfo, fullName: data.personalInfo.fullName || localData.personalInfo.fullName, jobTitle: data.personalInfo.jobTitle || localData.personalInfo.jobTitle, email: data.personalInfo.email || localData.personalInfo.email, phone: data.personalInfo.phone || localData.personalInfo.phone, location: data.personalInfo.location || localData.personalInfo.location, website: data.personalInfo.website || localData.personalInfo.website, linkedin: data.personalInfo.linkedin || localData.personalInfo.linkedin }
    };
    return { ...data, template: 'original-upload', originalTemplate: { sourceFileName: file.name, sourceFormat: 'pdf', importedAt: new Date().toISOString(), sourceDataUrl: `data:application/pdf;base64,${btoa(binary)}`, editableTemplate: 'modern-minimal' } };
  }

  let data: ResumeData;
  if (useAI) {
    try {
      const aiData = await parseResumeWithAI({ text });
      data = normalizeParsedResume(aiData, localData);
    } catch {
      data = localData;
    }
  } else {
    data = localData;
  }

  const mime = ext === 'docx' ? 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' : 'text/plain';
  const bytes = new Uint8Array(await file.arrayBuffer());
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  data = {
    ...data,
    experience: data.experience.length ? data.experience : localData.experience,
    projects: data.projects.length ? data.projects : localData.projects,
    education: data.education.length ? data.education : localData.education,
    skills: (data.skills.simple.length || data.skills.categorized.length) ? data.skills : localData.skills,
    summary: data.summary || localData.summary,
    personalInfo: { ...localData.personalInfo, ...data.personalInfo, fullName: data.personalInfo.fullName || localData.personalInfo.fullName, jobTitle: data.personalInfo.jobTitle || localData.personalInfo.jobTitle, email: data.personalInfo.email || localData.personalInfo.email, phone: data.personalInfo.phone || localData.personalInfo.phone, location: data.personalInfo.location || localData.personalInfo.location, website: data.personalInfo.website || localData.personalInfo.website, linkedin: data.personalInfo.linkedin || localData.personalInfo.linkedin }
  };
  return { ...data, template: 'original-upload', originalTemplate: { sourceFileName: file.name, sourceFormat: ext, importedAt: new Date().toISOString(), sourceDataUrl: `data:${mime};base64,${btoa(binary)}`, editableTemplate: 'modern-minimal' } };
}

export const importResumeFromJSON = (file: File) => importResumeFromFile(file, false);
