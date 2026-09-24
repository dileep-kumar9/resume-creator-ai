import { ResumeData, DEFAULT_COLORS, DEFAULT_SECTIONS, normalizeSkillLabels, cleanMissingValue, cleanResumeDate } from '../types/resume';
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

  // AI output is treated as a set of proposed edits, not a replacement for
  // factual source data. Empty/missing fields never erase the uploaded resume.
  const pick = (value: unknown, original: string) => {
    const cleaned = cleanMissingValue(value);
    return cleaned || original || '';
  };

  fallback.personalInfo = {
    ...fallback.personalInfo,
    fullName: pick(p.fullName, fallback.personalInfo.fullName),
    jobTitle: pick(p.jobTitle, fallback.personalInfo.jobTitle),
    email: pick(p.email, fallback.personalInfo.email),
    phone: pick(p.phone, fallback.personalInfo.phone),
    location: pick(p.location, fallback.personalInfo.location),
    website: normalizeUrl(pick(p.website, fallback.personalInfo.website)),
    linkedin: normalizeUrl(pick(p.linkedin, fallback.personalInfo.linkedin)),
    github: normalizeUrl(pick(p.github, fallback.personalInfo.github))
  };

  if (typeof parsed.summary === 'string' && parsed.summary.trim()) {
    fallback.summary = parsed.summary.trim();
  }

  if (Array.isArray(parsed.experience) && parsed.experience.length) {
    fallback.experience = parsed.experience.map((x: any, index: number) => {
      const original: any = fallback.experience[index] || {};
      const bullets = Array.isArray(x.bulletPoints)
        ? x.bulletPoints.filter((v:any)=>typeof v==='string'&&v.trim()).map((v:any)=>v.trim())
        : [];
      return {
        id: original.id || x.id || uid('exp'),
        jobTitle: pick(x.jobTitle, original.jobTitle),
        company: pick(x.company, original.company),
        location: pick(x.location, original.location),
        // Employment dates are source facts. Keep them unless the user edits
        // them directly in the editor.
        startDate: original.startDate || cleanResumeDate(x.startDate),
        endDate: original.endDate || cleanResumeDate(x.endDate),
        current: typeof x.current === 'boolean' ? (original.startDate ? original.current : x.current) : Boolean(original.current),
        description: pick(x.description, original.description),
        bulletPoints: bullets.length ? bullets : (original.bulletPoints || [])
      };
    });
    // Never silently delete source experience entries if the AI returns fewer.
    if (fallback.experience.length < (base?.experience.length || 0)) {
      fallback.experience = fallback.experience.concat(
        (base?.experience || []).slice(fallback.experience.length)
      );
    }
  }

  if (Array.isArray(parsed.education) && parsed.education.length) {
    fallback.education = parsed.education.map((x: any, index: number) => {
      const original: any = fallback.education[index] || {};
      return {
        id: original.id || x.id || uid('edu'),
        degree: pick(x.degree, original.degree),
        institution: pick(x.institution, original.institution),
        location: pick(x.location, original.location),
        graduationYear: pick(x.graduationYear, original.graduationYear),
        gpa: pick(x.gpa, original.gpa),
        honors: pick(x.honors, original.honors)
      };
    });
    if (fallback.education.length < (base?.education.length || 0)) {
      fallback.education = fallback.education.concat(
        (base?.education || []).slice(fallback.education.length)
      );
    }
  }

  if (Array.isArray(parsed.projects) && parsed.projects.length) {
    fallback.projects = parsed.projects.map((x: any, index: number) => {
      const original: any = fallback.projects[index] || {};
      const technologies = Array.isArray(x.technologies)
        ? normalizeSkillLabels(x.technologies)
        : [];
      return {
        id: original.id || x.id || uid('project'),
        title: pick(x.title, original.title),
        description: pick(x.description, original.description),
        technologies: technologies.length ? technologies : (original.technologies || []),
        liveUrl: normalizeUrl(pick(x.liveUrl, original.liveUrl)),
        githubUrl: normalizeUrl(pick(x.githubUrl, original.githubUrl)),
        // Project dates are also preserved from the uploaded source.
        startDate: original.startDate || cleanResumeDate(x.startDate),
        endDate: original.endDate || cleanResumeDate(x.endDate)
      };
    });
    if (fallback.projects.length < (base?.projects.length || 0)) {
      fallback.projects = fallback.projects.concat(
        (base?.projects || []).slice(fallback.projects.length)
      );
    }
  }

  if (parsed.skills) {
    const simple = Array.isArray(parsed.skills.simple)
      ? normalizeSkillLabels(parsed.skills.simple)
      : [];
    const categorized = Array.isArray(parsed.skills.categorized)
      ? parsed.skills.categorized.map((c: any) => ({
          id: c.id || uid('skill'),
          name: cleanMissingValue(c.name) || 'Skills',
          skills: Array.isArray(c.skills) ? normalizeSkillLabels(c.skills) : []
        })).filter((c:any)=>c.skills.length)
      : [];

    if (simple.length || categorized.length) {
      fallback.skills = {
        mode: categorized.length ? 'categorized' : 'simple',
        simple: simple.length ? simple : fallback.skills.simple,
        categorized: categorized.length ? categorized : fallback.skills.categorized
      };
    }
  }

  if (Array.isArray(parsed.customSections) && parsed.customSections.length) {
    fallback.customSections = parsed.customSections;
  }

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
