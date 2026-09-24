import { ResumeData, DEFAULT_COLORS, DEFAULT_SECTIONS, normalizeSkillLabels } from '../types/resume';
import * as pdfjsLib from 'pdfjs-dist';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import mammoth from 'mammoth/mammoth.browser';
import { normalizeUrl } from './links';

pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl;

type ParsedResumePayload = Partial<ResumeData>;

const uid = (prefix: string) => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

export async function extractResumeText(file: File): Promise<string> {
  const name = file.name.toLowerCase();
  if (name.endsWith('.pdf')) return extractPdfText(file);
  if (name.endsWith('.docx')) return extractDocxText(file);
  if (name.endsWith('.txt')) return file.text();
  if (name.endsWith('.json')) return file.text();
  throw new Error('Unsupported file. Please upload a PDF, DOCX, TXT, or JSON resume.');
}

async function extractPdfText(file: File) {
  const data = new Uint8Array(await file.arrayBuffer());
  const pdf = await pdfjsLib.getDocument({ data }).promise;
  const pages: string[] = [];
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const items = content.items as Array<{ str?: string; transform?: number[] }>;
    // Keep visual order. PDF text items are already approximately ordered, but sorting by
    // vertical position first avoids columns being randomly interleaved in many resumes.
    const sorted = items.slice().sort((a, b) => {
      const ay = a.transform?.[5] ?? 0;
      const by = b.transform?.[5] ?? 0;
      if (Math.abs(ay - by) > 3) return by - ay;
      return (a.transform?.[4] ?? 0) - (b.transform?.[4] ?? 0);
    });
    pages.push(sorted.map((item) => item.str || '').join(' ').replace(/\s+/g, ' ').trim());
  }
  return pages.filter(Boolean).join('\n\n');
}

async function extractDocxText(file: File) {
  const arrayBuffer = await file.arrayBuffer();
  const result = await mammoth.extractRawText({ arrayBuffer });
  return result.value.replace(/\r/g, '').trim();
}

function blankResume(): ResumeData {
  return {
    personalInfo: { fullName: '', jobTitle: '', email: '', phone: '', location: '', website: '', linkedin: '', github: '', profileImage: '', birthDate: '' },
    summary: '', experience: [], education: [], projects: [],
    skills: { mode: 'simple', simple: [], categorized: [] },
    customSections: [], sections: DEFAULT_SECTIONS, colors: DEFAULT_COLORS,
    template: 'tech-sidebar', pageFormat: 'letter', fontSize: 'medium', fontFamily: 'Inter'
  };
}

export function normalizeParsedResume(parsed: ParsedResumePayload, base?: ResumeData): ResumeData {
  const fallback = base ? structuredClone(base) : blankResume();
  const p: Partial<ResumeData['personalInfo']> = parsed.personalInfo || {};
  fallback.personalInfo = { ...fallback.personalInfo, ...p, website: normalizeUrl(p.website), linkedin: normalizeUrl(p.linkedin), github: normalizeUrl(p.github) };
  fallback.summary = typeof parsed.summary === 'string' ? parsed.summary : fallback.summary;
  fallback.experience = Array.isArray(parsed.experience) ? parsed.experience.map((x: any) => ({
    id: x.id || uid('exp'), jobTitle: x.jobTitle || '', company: x.company || '', location: x.location || '',
    startDate: x.startDate || '', endDate: x.endDate || '', current: Boolean(x.current), description: x.description || '',
    bulletPoints: Array.isArray(x.bulletPoints) ? x.bulletPoints.filter(Boolean) : []
  })) : fallback.experience;
  fallback.education = Array.isArray(parsed.education) ? parsed.education.map((x: any) => ({
    id: x.id || uid('edu'), degree: x.degree || '', institution: x.institution || '', location: x.location || '',
    graduationYear: x.graduationYear || '', gpa: x.gpa || '', honors: x.honors || ''
  })) : fallback.education;
  fallback.projects = Array.isArray(parsed.projects) ? parsed.projects.map((x: any) => ({
    id: x.id || uid('project'), title: x.title || '', description: x.description || '',
    technologies: Array.isArray(x.technologies) ? x.technologies.filter(Boolean) : [], liveUrl: normalizeUrl(x.liveUrl),
    githubUrl: normalizeUrl(x.githubUrl), startDate: x.startDate || '', endDate: x.endDate || ''
  })) : fallback.projects;
  if (parsed.skills) {
    fallback.skills = {
      mode: parsed.skills.mode === 'categorized' ? 'categorized' : 'simple',
      simple: Array.isArray(parsed.skills.simple) ? normalizeSkillLabels(parsed.skills.simple) : [],
      categorized: Array.isArray(parsed.skills.categorized)
        ? parsed.skills.categorized.map((c: any) => ({
            id: c.id || uid('skill'),
            name: c.name || 'Skills',
            skills: Array.isArray(c.skills) ? normalizeSkillLabels(c.skills) : []
          }))
        : []
    };
  }
  fallback.customSections = Array.isArray(parsed.customSections) ? parsed.customSections : fallback.customSections;
  return fallback;
}

export async function parseResumeWithAI(input: { text?: string; pdfBase64?: string }, apiUrl = '/api/parse-resume'): Promise<ResumeData> {
  const request = async (body: { text?: string; pdfBase64?: string }) => {
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 75000);
    try {
      const response = await fetch(apiUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: controller.signal });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        const error: any = new Error(payload.error || `Resume parsing failed (${response.status})`);
        error.status = response.status;
        throw error;
      }
      return normalizeParsedResume(payload.resumeData || {});
    } finally {
      window.clearTimeout(timeout);
    }
  };

  try {
    return await request(input);
  } catch (error: any) {
    // Gemini is currently the only provider receiving the native PDF. If it is
    // overloaded/temporarily unavailable, extract the PDF locally and retry as
    // text so the server can use Groq -> Mistral fallback instead.
    if (input.pdfBase64 && [408, 429, 500, 502, 503, 504].includes(error?.status)) {
      try {
        const binary = atob(input.pdfBase64);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
        const file = new File([bytes], 'resume.pdf', { type: 'application/pdf' });
        const extractedText = await extractResumeText(file);
        if (!extractedText.trim()) throw new Error('The PDF contains no extractable text.');
        return await request({ text: extractedText });
      } catch (fallbackError: any) {
        throw new Error(`Gemini PDF parsing was unavailable, and the text fallback also failed: ${fallbackError?.message || 'unknown error'}`);
      }
    }
    if (error?.name === 'AbortError') throw new Error('Resume parsing timed out. Please try again.');
    throw error;
  }
}

export function parseResumeHeuristically(text: string): ResumeData {
  const data = blankResume();
  const lines = text.split(/\n+/).map((x) => x.trim()).filter(Boolean);
  const email = text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0] || '';
  const phone = text.match(/(?:\+?\d[\d\s().-]{8,}\d)/)?.[0] || '';
  data.personalInfo.email = email;
  data.personalInfo.phone = phone;
  data.personalInfo.fullName = lines.find((line) => /^[A-Za-z][A-Za-z .'-]{2,45}$/.test(line) && !/resume|curriculum vitae|experience|education|skills/i.test(line)) || '';
  const summaryIndex = lines.findIndex((x) => /^(professional summary|summary|profile|objective)$/i.test(x));
  if (summaryIndex >= 0) data.summary = lines.slice(summaryIndex + 1, Math.min(summaryIndex + 4, lines.length)).join(' ');
  const skillsIndex = lines.findIndex((x) => /^skills?$/i.test(x));
  if (skillsIndex >= 0) data.skills.simple = lines.slice(skillsIndex + 1).join(' ').split(/[,•|]/).map((x) => x.trim()).filter((x) => x.length > 1 && x.length < 50).slice(0, 40);
  return data;
}
