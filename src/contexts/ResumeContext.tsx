import React, { createContext, useContext, useEffect, useReducer, ReactNode } from 'react';
import { ResumeData, DEFAULT_COLORS, DEFAULT_SECTIONS } from '../types/resume';

interface ResumeState {
  resumeData: ResumeData;
  isEditing: boolean;
  selectedSection: string | null;
}

type ResumeAction =
  | { type: 'UPDATE_PERSONAL_INFO'; payload: Partial<ResumeData['personalInfo']> }
  | { type: 'UPDATE_SUMMARY'; payload: string }
  | { type: 'UPDATE_EXPERIENCE'; payload: ResumeData['experience'] }
  | { type: 'UPDATE_EDUCATION'; payload: ResumeData['education'] }
  | { type: 'UPDATE_PROJECTS'; payload: ResumeData['projects'] }
  | { type: 'UPDATE_SKILLS'; payload: ResumeData['skills'] }
  | { type: 'UPDATE_CUSTOM_SECTIONS'; payload: ResumeData['customSections'] }
  | { type: 'UPDATE_SECTIONS'; payload: ResumeData['sections'] }
  | { type: 'UPDATE_COLORS'; payload: ResumeData['colors'] }
  | { type: 'UPDATE_TEMPLATE'; payload: ResumeData['template'] }
  | { type: 'UPDATE_PAGE_FORMAT'; payload: ResumeData['pageFormat'] }
  | { type: 'UPDATE_FONT_SIZE'; payload: ResumeData['fontSize'] }
  | { type: 'UPDATE_FONT_FAMILY'; payload: ResumeData['fontFamily'] }
  | { type: 'SET_EDITING'; payload: boolean }
  | { type: 'SET_SELECTED_SECTION'; payload: string | null }
  | { type: 'RESET_RESUME' }
  | { type: 'IMPORT_RESUME_DATA'; payload: ResumeData };

const initialResumeData: ResumeData = {
  personalInfo: {
    fullName: 'BADHAM DILEEP KUMAR',
    jobTitle: 'B.Tech — Information Technology | Fresher',
    email: 'dileepkumarbadham@gmail.com',
    phone: '9542167927',
    location: 'Tadepalligudem, Andhra Pradesh',
    website: 'https://dileep-kumar9.github.io/',
    linkedin: 'https://linkedin.com/in/dileep-kumar-badham',
    github: '',
    profileImage: '',
    birthDate: ''
  },
  summary: 'B.Tech Information Technology graduate with hands-on experience developing Python-based applications, web platforms, AI-assisted tools, and API integrations. Skilled in Python, SQL, Flask, Django, FastAPI, data processing, and application development. Seeking an entry-level opportunity to apply technical, analytical, and problem-solving skills while contributing to a collaborative team.',
  experience: [{
    id: 'brainovision-internship',
    jobTitle: 'AWS / Cloud Computing Intern',
    company: 'BrainOvision',
    location: '',
    startDate: '2024',
    endDate: '2024',
    current: false,
    description: '',
    bulletPoints: [
      'Gained hands-on exposure to Amazon Web Services (AWS) fundamentals and cloud computing concepts.',
      'Worked on cloud-based storage and deployment basics, building a practical foundation in AWS services such as S3.'
    ]
  }],
  education: [
    { id: 'btech-it', degree: 'Bachelor of Technology, Information Technology', institution: 'Sir C. R. Reddy College of Engineering', location: 'Eluru · JNTUK', graduationYear: '2021 – 2025', gpa: '7.79 / 10' },
    { id: 'intermediate-mpc', degree: 'Intermediate (MPC)', institution: 'SASI Junior College', location: 'Velivennu', graduationYear: '2019 – 2021', gpa: '91.9%' },
    { id: 'ssc', degree: 'SSC', institution: 'Lotus High School', location: 'Tadepalligudem', graduationYear: '2019', gpa: '74.6%' }
  ],
  projects: [
    { id: 'ai-career-assistant', title: 'AI Career Assistant — AI-Powered Job Application Platform', description: 'Developing a modular career assistant with resume generation, job discovery/application support, application tracking, and interview preparation. Designed a flow to tailor ATS-friendly resumes to a selected job description and let users review the resume before use. Includes tracking to identify jobs already applied to, job matching based on user skills, and a separate workflow for a user-provided job link. Uses Python and a Groq API integration for AI-powered capabilities; application features are being built iteratively.', technologies: ['Python', 'Groq API'] },
    { id: 'facetally', title: 'FaceTally — Face Detection, Recognition & Counting Web App', description: 'Developed a Flask application to detect, recognize, and count faces in uploaded media using OpenCV and face_recognition. Implemented Firebase Authentication with server-side token verification and user-specific known-face storage. Set up a Docker-based environment and persistent storage for reference face data.', technologies: ['Python', 'Flask', 'OpenCV', 'face_recognition', 'Firebase', 'Docker'] },
    { id: 'code-review-assistant', title: 'AI-Powered Code Review Assistant', description: 'Created a Python pipeline that analyzes code submissions and integrates an AI API to generate structured review suggestions. Implemented response parsing and prompt refinement to improve the consistency and usefulness of generated feedback.', technologies: ['Python', 'AI API'] },
    { id: 'samurai-reimei', title: 'SAMURAI REIMEI — Gesture-Controlled FPS Game', description: 'Developing a first-person shooter game project with gesture-based controls and keyboard alternatives for accessible gameplay. Project design includes PC and Android support, multiplayer team rooms, and communication features such as voice signaling and pings.', technologies: ['Gesture Controls', 'PC', 'Android'] }
  ],
  skills: {
    mode: 'categorized',
    simple: [],
    categorized: [
      { id: 'programming', name: 'Programming', skills: ['Python', 'SQL'] },
      { id: 'web-apis', name: 'Web & APIs', skills: ['HTML', 'CSS', 'Flask', 'Django', 'FastAPI', 'REST APIs', 'JSON'] },
      { id: 'data-analytics', name: 'Data & Analytics', skills: ['Pandas', 'NumPy', 'Excel', 'Power BI', 'Data Cleaning', 'Data Validation'] },
      { id: 'ai', name: 'AI', skills: ['Generative AI fundamentals', 'Prompt Engineering', 'RAG fundamentals', 'AI API integration'] },
      { id: 'databases-cloud', name: 'Databases & Cloud', skills: ['SQL databases', 'Cloud Firestore', 'Firebase Authentication', 'AWS S3 fundamentals'] },
      { id: 'tools', name: 'Tools', skills: ['Git', 'GitHub', 'VS Code', 'Docker', 'Postman'] }
    ]
  },
  customSections: [
    { id: 'certifications', title: 'Certifications', content: 'Python for Data Science — IBM Skills Network (Foundation Level)', type: 'bullets', visible: true, order: 7 },
    { id: 'strengths', title: 'Strengths', content: 'Analytical thinking • Problem-solving • Quick learner • Adaptability • Attention to detail • Team collaboration', type: 'paragraph', visible: true, order: 8 }
  ],
  sections: [
    { id: 'summary', title: 'Professional Summary', visible: true, order: 1 },
    { id: 'experience', title: 'Internship Experience', visible: true, order: 2 },
    { id: 'projects', title: 'Projects', visible: true, order: 3 },
    { id: 'education', title: 'Education', visible: true, order: 4 },
    { id: 'skills', title: 'Technical Skills', visible: true, order: 5 },
    { id: 'custom', title: 'Additional Sections', visible: true, order: 6 }
  ],
  colors: { ...DEFAULT_COLORS, primary: '#4F8CC9', secondary: '#4b5563', text: '#222222', background: '#ffffff' },
  template: 'original-upload',
  pageFormat: 'letter',
  fontSize: 'medium',
  fontFamily: 'Helvetica',
  originalTemplate: {
    sourceFileName: 'Badham_Dileep_Kumar_Updated_Resume.pdf',
    sourceFormat: 'pdf',
    importedAt: '2026-09-25T00:00:00.000Z',
    tailored: false,
    editableTemplate: 'business-professional'
  }
};

const initialState: ResumeState = {
  resumeData: initialResumeData,
  isEditing: false,
  selectedSection: null
};

function resumeReducer(state: ResumeState, action: ResumeAction): ResumeState {
  switch (action.type) {
    case 'UPDATE_PERSONAL_INFO':
      return {
        ...state,
        resumeData: {
          ...state.resumeData,
          personalInfo: { ...state.resumeData.personalInfo, ...action.payload }
        }
      };
    case 'UPDATE_SUMMARY':
      return {
        ...state,
        resumeData: { ...state.resumeData, summary: action.payload }
      };
    case 'UPDATE_EXPERIENCE':
      return {
        ...state,
        resumeData: { ...state.resumeData, experience: action.payload }
      };
    case 'UPDATE_EDUCATION':
      return {
        ...state,
        resumeData: { ...state.resumeData, education: action.payload }
      };
    case 'UPDATE_PROJECTS':
      return {
        ...state,
        resumeData: { ...state.resumeData, projects: action.payload }
      };
    case 'UPDATE_SKILLS':
      return {
        ...state,
        resumeData: { ...state.resumeData, skills: action.payload }
      };
    case 'UPDATE_CUSTOM_SECTIONS':
      return {
        ...state,
        resumeData: { ...state.resumeData, customSections: action.payload }
      };
    case 'UPDATE_SECTIONS':
      return {
        ...state,
        resumeData: { ...state.resumeData, sections: action.payload }
      };
    case 'UPDATE_COLORS':
      return {
        ...state,
        resumeData: { ...state.resumeData, colors: action.payload }
      };
    case 'UPDATE_TEMPLATE': {
      const original = state.resumeData.originalTemplate;
      const nextOriginal = original
        ? {
            ...original,
            ...(action.payload === 'original-upload'
              ? {}
              : { editableTemplate: action.payload as Exclude<ResumeData['template'], 'original-upload'> })
          }
        : original;
      return {
        ...state,
        resumeData: { ...state.resumeData, template: action.payload, originalTemplate: nextOriginal }
      };
    }
    case 'UPDATE_PAGE_FORMAT':
      return {
        ...state,
        resumeData: { ...state.resumeData, pageFormat: action.payload }
      };
    case 'UPDATE_FONT_SIZE':
      return {
        ...state,
        resumeData: { ...state.resumeData, fontSize: action.payload }
      };
    case 'UPDATE_FONT_FAMILY':
      return {
        ...state,
        resumeData: { ...state.resumeData, fontFamily: action.payload }
      };
    case 'SET_EDITING':
      return { ...state, isEditing: action.payload };
    case 'SET_SELECTED_SECTION':
      return { ...state, selectedSection: action.payload };
    case 'RESET_RESUME':
      return { ...initialState, resumeData: initialResumeData };
    case 'IMPORT_RESUME_DATA':
      return { ...state, resumeData: action.payload };
    default:
      return state;
  }
}

interface ResumeContextType {
  state: ResumeState;
  dispatch: React.Dispatch<ResumeAction>;
  updatePersonalInfo: (data: Partial<ResumeData['personalInfo']>) => void;
  updateSummary: (summary: string) => void;
  updateExperience: (experience: ResumeData['experience']) => void;
  updateEducation: (education: ResumeData['education']) => void;
  updateProjects: (projects: ResumeData['projects']) => void;
  updateSkills: (skills: ResumeData['skills']) => void;
  updateCustomSections: (sections: ResumeData['customSections']) => void;
  updateSections: (sections: ResumeData['sections']) => void;
  updateColors: (colors: ResumeData['colors']) => void;
  updateTemplate: (template: ResumeData['template']) => void;
  updatePageFormat: (format: ResumeData['pageFormat']) => void;
  updateFontSize: (fontSize: ResumeData['fontSize']) => void;
  updateFontFamily: (fontFamily: ResumeData['fontFamily']) => void;
  setEditing: (editing: boolean) => void;
  setSelectedSection: (section: string | null) => void;
  resetResume: () => void;
  importResumeData: (data: ResumeData) => void;
  exportResumeData: () => ResumeData;
}

const ResumeContext = createContext<ResumeContextType | undefined>(undefined);

const loadPersistedState = (): ResumeState => {
  if (typeof window === 'undefined') return initialState;
  try {
    const raw = window.localStorage.getItem('resume-studio-resume-data');
    if (!raw) return initialState;
    const parsed = JSON.parse(raw) as ResumeData;
    if (!parsed || typeof parsed !== 'object' || !parsed.personalInfo || !Array.isArray(parsed.sections)) return initialState;
    // Never restore the synthetic E2E candidate into the user's real workspace.
    // Older E2E runs could persist E2E-Test-Resume in localStorage; clear that
    // stale fixture automatically so normal chat tailoring starts from the
    // user's actual upload.
    const name=String(parsed.personalInfo?.fullName||'').toLowerCase();
    const email=String(parsed.personalInfo?.email||'').toLowerCase();
    const source=String(parsed.originalTemplate?.sourceFileName||'').toLowerCase();
    const company=(parsed.experience||[]).map((x:any)=>String(x.company||'').toLowerCase()).join(' ');
    const synthetic=email==='e2e@example.com' || name.includes('e2e test') || source.includes('e2e-test-resume') || company.includes('example technologies');
    if(synthetic){
      window.localStorage.removeItem('resume-studio-resume-data');
      return initialState;
    }
    return { ...initialState, resumeData: parsed };
  } catch {
    return initialState;
  }
};

export const ResumeProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [state, dispatch] = useReducer(resumeReducer, initialState, loadPersistedState);

  useEffect(() => {
    try {
      window.localStorage.setItem('resume-studio-resume-data', JSON.stringify(state.resumeData));
    } catch {
      // Large original PDFs or a browser storage quota should never break editing.
    }
  }, [state.resumeData]);

  const updatePersonalInfo = (data: Partial<ResumeData['personalInfo']>) => {
    dispatch({ type: 'UPDATE_PERSONAL_INFO', payload: data });
  };

  const updateSummary = (summary: string) => {
    dispatch({ type: 'UPDATE_SUMMARY', payload: summary });
  };

  const updateExperience = (experience: ResumeData['experience']) => {
    dispatch({ type: 'UPDATE_EXPERIENCE', payload: experience });
  };

  const updateEducation = (education: ResumeData['education']) => {
    dispatch({ type: 'UPDATE_EDUCATION', payload: education });
  };

  const updateProjects = (projects: ResumeData['projects']) => {
    dispatch({ type: 'UPDATE_PROJECTS', payload: projects });
  };

  const updateSkills = (skills: ResumeData['skills']) => {
    dispatch({ type: 'UPDATE_SKILLS', payload: skills });
  };

  const updateCustomSections = (sections: ResumeData['customSections']) => {
    dispatch({ type: 'UPDATE_CUSTOM_SECTIONS', payload: sections });
  };

  const updateSections = (sections: ResumeData['sections']) => {
    dispatch({ type: 'UPDATE_SECTIONS', payload: sections });
  };

  const updateColors = (colors: ResumeData['colors']) => {
    dispatch({ type: 'UPDATE_COLORS', payload: colors });
  };

  const updateTemplate = (template: ResumeData['template']) => {
    dispatch({ type: 'UPDATE_TEMPLATE', payload: template });
  };

  const updatePageFormat = (format: ResumeData['pageFormat']) => {
    dispatch({ type: 'UPDATE_PAGE_FORMAT', payload: format });
  };

  const updateFontSize = (fontSize: ResumeData['fontSize']) => {
    dispatch({ type: 'UPDATE_FONT_SIZE', payload: fontSize });
  };

  const updateFontFamily = (fontFamily: ResumeData['fontFamily']) => {
    dispatch({ type: 'UPDATE_FONT_FAMILY', payload: fontFamily });
  };

  const setEditing = (editing: boolean) => {
    dispatch({ type: 'SET_EDITING', payload: editing });
  };

  const setSelectedSection = (section: string | null) => {
    dispatch({ type: 'SET_SELECTED_SECTION', payload: section });
  };

  const resetResume = () => {
    dispatch({ type: 'RESET_RESUME' });
  };

  const importResumeData = (data: ResumeData) => {
    dispatch({ type: 'IMPORT_RESUME_DATA', payload: data });
  };

  const exportResumeData = (): ResumeData => {
    return state.resumeData;
  };

  const value: ResumeContextType = {
    state,
    dispatch,
    updatePersonalInfo,
    updateSummary,
    updateExperience,
    updateEducation,
    updateProjects,
    updateSkills,
    updateCustomSections,
    updateSections,
    updateColors,
    updateTemplate,
    updatePageFormat,
    updateFontSize,
    updateFontFamily,
    setEditing,
    setSelectedSection,
    resetResume,
    importResumeData,
    exportResumeData
  };

  return (
    <ResumeContext.Provider value={value}>
      {children}
    </ResumeContext.Provider>
  );
};

export const useResume = () => {
  const context = useContext(ResumeContext);
  if (context === undefined) {
    throw new Error('useResume must be used within a ResumeProvider');
  }
  return context;
};