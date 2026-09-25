import { ResumeData, Experience, Project, SkillCategory, DEFAULT_COLORS, DEFAULT_SECTIONS, normalizeSkillLabels, cleanMissingValue, cleanResumeDate } from '../types/resume';
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
    const items = (content.items as Array<{ str?: string; transform?: number[] }>)
      .filter(item => String(item.str || '').trim());

    // Preserve actual visual line breaks. The previous implementation flattened
    // an entire PDF page into one giant line, which made the local fallback
    // unable to recognize headings such as EXPERIENCE / PROJECTS / EDUCATION.
    const rows: Array<{ y: number; items: Array<{ str?: string; transform?: number[] }> }> = [];
    const tolerance = 3;

    for (const item of items) {
      const y = item.transform?.[5] ?? 0;
      let row = rows.find(r => Math.abs(r.y - y) <= tolerance);
      if (!row) {
        row = { y, items: [] };
        rows.push(row);
      }
      row.items.push(item);
    }

    rows.sort((a, b) => b.y - a.y);

    const pageLines: string[] = [];
    for (const row of rows) {
      const sorted = row.items.slice().sort(
        (a, b) => (a.transform?.[4] ?? 0) - (b.transform?.[4] ?? 0)
      );

      // Split obvious two-column jumps into separate logical lines. This keeps
      // left-column education/skills from being concatenated with right-column
      // summary/experience text.
      let current = '';
      let previousX: number | null = null;
      for (const item of sorted) {
        const x = item.transform?.[4] ?? 0;
        const text = String(item.str || '').replace(/\s+/g, ' ').trim();
        if (!text) continue;

        if (current && previousX !== null && x - previousX > 170) {
          pageLines.push(current.trim());
          current = text;
        } else {
          current = current ? `${current} ${text}` : text;
        }
        previousX = x;
      }
      if (current.trim()) pageLines.push(current.trim());
    }

    pages.push(pageLines.join('\n'));
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
    customSections: [], sections: DEFAULT_SECTIONS, colors: { ...DEFAULT_COLORS, primary: '#4F8CC9', secondary: '#4b5563', text: '#222222', background: '#ffffff' },
    template: 'original-upload', pageFormat: 'letter', fontSize: 'medium', fontFamily: 'Helvetica'
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
        // Last-resort local extraction keeps the uploaded resume usable even
        // when every external AI provider is temporarily unavailable. The
        // original uploaded template is still preserved by importResumeFromFile.
        try {
          const binary = atob(input.pdfBase64);
          const bytes = new Uint8Array(binary.length);
          for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
          const file = new File([bytes], 'resume.pdf', { type: 'application/pdf' });
          const extractedText = await extractResumeText(file);
          if (extractedText.trim()) return parseResumeHeuristically(extractedText);
        } catch {}
        throw new Error(`Resume parsing is temporarily unavailable. Please try again. ${fallbackError?.message || ''}`.trim());
      }
    }
    if (error?.name === 'AbortError') throw new Error('Resume parsing timed out. Please try again.');
    throw error;
  }
}

export function parseResumeHeuristically(text: string): ResumeData {
  const data = blankResume();
  // Recover section boundaries even when a PDF extractor places a heading and
  // the first line of content on the same visual row.
  const normalizedText = text
    .replace(/\r/g, '')
    .replace(/\b(PROFESSIONAL SUMMARY|CORE SKILLS|INTERNSHIP EXPERIENCE|PROFESSIONAL EXPERIENCE|WORK EXPERIENCE|KEY PROJECTS|PROJECTS|EDUCATION|CERTIFICATIONS)\b/gi, '\n$1\n');
  const rawLines = normalizedText.split(/\n+/).map(x => x.trim()).filter(Boolean);
  const lines = rawLines.map(x => x.replace(/\s+/g, ' ').trim()).filter(Boolean);

  const email = text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0] || '';
  const phone = text.match(/(?:\+?\d[\d\s().-]{8,}\d)/)?.[0]?.trim() || '';
  const urls = text.match(/https?:\/\/[^\s|]+/gi) || [];

  data.personalInfo.email = email;
  data.personalInfo.phone = phone;
  data.personalInfo.linkedin = normalizeUrl(
    (text.match(/(?:https?:\/\/)?(?:www\.)?linkedin\.com\/in\/[A-Za-z0-9._-]+/i)?.[0] || '')
  );
  const portfolioMatch =
    urls.find(u => !/linkedin\.com/i.test(u)) ||
    text.match(/(?:https?:\/\/)?[A-Za-z0-9._-]+\.github\.io\/?[A-Za-z0-9._~:/?#\[\]@!$&'()*+,;=%-]*/i)?.[0] ||
    '';
  data.personalInfo.website = normalizeUrl(portfolioMatch);

  // Most resumes put the candidate name on the first line. Prefer that over
  // guessing from arbitrary text later in the document.
  const firstUseful = lines.slice(0, 5).find(line =>
    /^[A-Za-z][A-Za-z .'-]{2,60}$/.test(line) &&
    !/resume|curriculum vitae|professional summary|summary|profile|objective/i.test(line)
  );
  data.personalInfo.fullName = firstUseful || '';

  const headerIndex = data.personalInfo.fullName ? lines.indexOf(data.personalInfo.fullName) : 0;
  const contactLine = lines.slice(headerIndex + 1, headerIndex + 4).join(' | ');
  const locationMatch = contactLine.match(/\b([A-Z][A-Za-z .'-]+,\s*[A-Z][A-Za-z .'-]+)\b/);
  data.personalInfo.location = locationMatch?.[1]?.trim() || '';

  // Locate major sections. This is intentionally conservative: the local
  // parser is a fallback, so it should preserve source facts rather than invent
  // structure from unrelated prose.
  const sectionAliases: Record<string, RegExp> = {
    summary: /^(professional summary|summary|profile|objective)$/i,
    skills: /^(core skills|skills|technical skills)$/i,
    experience: /^(internship experience|professional experience|work experience|experience)$/i,
    projects: /^(key projects|projects|project experience)$/i,
    education: /^education$/i,
    certifications: /^(certifications|certificates)$/i
  };

  const sectionAt: Record<string, number> = {};
  lines.forEach((line, i) => {
    for (const [key, re] of Object.entries(sectionAliases)) {
      if (re.test(line) && sectionAt[key] === undefined) sectionAt[key] = i;
    }
  });

  // Job title is normally between the contact/header block and the first section.
  const firstSection = Math.min(...Object.values(sectionAt).filter(Number.isFinite));
  if (Number.isFinite(firstSection)) {
    const candidates = lines.slice(headerIndex + 1, firstSection).filter(line =>
      !line.includes('@') && !/\b\d{7,}\b/.test(line) &&
      !/linkedin\.com|github\.com|https?:\/\//i.test(line)
    );
    const title = candidates.find(line => line.length > 4 && !/,/.test(line));
    if (title) data.personalInfo.jobTitle = title;
  }

  const sectionEnd = (start: number | undefined) => {
    if (start === undefined) return lines.length;
    const later = Object.values(sectionAt).filter(i => i > start);
    return later.length ? Math.min(...later) : lines.length;
  };

  // Summary
  if (sectionAt.summary !== undefined) {
    const a = sectionAt.summary + 1;
    const b = sectionEnd(sectionAt.summary);
    data.summary = lines.slice(a, b).filter(Boolean).join(' ').trim();
  }

  // Skills. Preserve categories such as "Customer Support:" rather than
  // flattening everything into one malformed string.
  if (sectionAt.skills !== undefined) {
    const skillLines = lines.slice(sectionAt.skills + 1, sectionEnd(sectionAt.skills));
    const categorized: SkillCategory[] = [];
    const simple: string[] = [];
    for (const line of skillLines) {
      const clean = line.replace(/^[•·*-]\s*/, '').trim();
      if (!clean) continue;
      const colon = clean.indexOf(':');
      if (colon > 0 && colon < 45) {
        const name = clean.slice(0, colon).trim();
        const values = normalizeSkillLabels(clean.slice(colon + 1).split(/[,;|]/));
        if (values.length) categorized.push({ id: uid('skill'), name, skills: values });
      } else {
        simple.push(...normalizeSkillLabels(clean.split(/[,;|]/)));
      }
    }
    if (categorized.length) {
      data.skills = { mode: 'categorized', simple, categorized };
    } else {
      data.skills = { mode: 'simple', simple: normalizeSkillLabels(simple), categorized: [] };
    }
  }

  const parseDateRange = (value: string) => {
    const cleaned = value.replace(/[–—]/g, '-').trim();
    const parts = cleaned.split(/\s+-\s+/);
    if (parts.length === 2) {
      return { startDate: cleanResumeDate(parts[0]), endDate: cleanResumeDate(parts[1]) };
    }
    return { startDate: cleanResumeDate(cleaned), endDate: '' };
  };

  // Experience entries: "Title | Company | Date" followed by bullet lines.
  if (sectionAt.experience !== undefined) {
    const block = lines.slice(sectionAt.experience + 1, sectionEnd(sectionAt.experience));
    let current: Experience | null = null;
    const flush = () => {
      if (current) {
        current.description = current.bulletPoints.join('\n');
        data.experience.push(current);
      }
    };
    for (const line of block) {
      const clean = line.replace(/^[•·*-]\s*/, '').trim();
      const parts = clean.split('|').map(x => x.trim()).filter(Boolean);
      if (parts.length >= 2 && !clean.startsWith('•')) {
        flush();
        const dates = parts.length >= 3 ? parseDateRange(parts.slice(2).join(' | ')) : {startDate:'',endDate:''};
        current = {
          id: uid('exp'),
          jobTitle: parts[0],
          company: parts[1],
          location: '',
          startDate: dates.startDate,
          endDate: dates.endDate,
          current: /present|current/i.test(parts.slice(2).join(' ')),
          description: '',
          bulletPoints: []
        };
      } else if (current) {
        current.bulletPoints.push(clean);
      }
    }
    flush();
  }

  // Projects: "Project | Tech stack | Date" followed by bullets/descriptions.
  if (sectionAt.projects !== undefined) {
    const block = lines.slice(sectionAt.projects + 1, sectionEnd(sectionAt.projects));
    let current: Project | null = null;
    const flush = () => {
      if (current) {
        current.description = current.description.trim() || current.title;
        data.projects.push(current);
      }
    };
    for (const line of block) {
      const clean = line.replace(/^[•·*-]\s*/, '').trim();
      const parts = clean.split('|').map(x => x.trim()).filter(Boolean);
      const looksLikeEntry = parts.length >= 2 && (
        /python|java|sql|react|node|flask|opencv|firebase|gpt|api|django|aws|javascript|typescript|mongodb|html|css/i.test(parts[1]) ||
        parts.length >= 3
      );
      if (looksLikeEntry) {
        flush();
        const datePart = parts.length >= 3 ? parts[2] : '';
        const dates = parseDateRange(datePart);
        current = {
          id: uid('project'),
          title: parts[0],
          description: '',
          technologies: normalizeSkillLabels((parts[1] || '').split(/[,;]+/)),
          liveUrl: '',
          githubUrl: '',
          startDate: dates.startDate,
          endDate: dates.endDate
        };
      } else if (current) {
        current.description = current.description
          ? `${current.description}\n${clean}`
          : clean;
      }
    }
    flush();
  }

  // Education lines commonly appear as bullets with degree, institution and
  // CGPA/year in the same line. Parse those without inventing missing fields.
  if (sectionAt.education !== undefined) {
    const block = lines.slice(sectionAt.education + 1, sectionEnd(sectionAt.education));
    for (const line of block) {
      const clean = line.replace(/^[•·*-]\s*/, '').trim();
      if (!clean) continue;
      const parts = clean.split('|').map(x => x.trim()).filter(Boolean);
      if (parts.length >= 2) {
        const degree = parts[0];
        const institution = parts[1];
        const gpa = clean.match(/(?:CGPA|GPA|Percentage|%)[\s:]+([0-9.]+%?)/i)?.[1] || '';
        const years = clean.match(/\b((?:19|20)\d{2})\s*-\s*((?:19|20)\d{2})\b/);
        const graduationYear = years?.[2] || years?.[1] || '';
        data.education.push({
          id: uid('edu'),
          degree,
          institution,
          location: '',
          graduationYear,
          gpa,
          honors: ''
        });
      }
    }
  }

  return data;
}

