import React from 'react';
import { ResumeData } from '../../../types/resume';

interface Props { data: ResumeData }

const Heading: React.FC<{children: React.ReactNode}> = ({children}) => (
  <div className="mb-2 mt-4 border-b border-blue-200 pb-1 text-[9px] font-bold uppercase tracking-wide text-blue-600">{children}</div>
);

export const OriginalUploadedTemplate: React.FC<Props> = ({ data }) => {
  const { personalInfo, summary, experience, education, projects, skills } = data;
  const cats = skills.categorized.length
    ? skills.categorized
    : (skills.simple.length ? [{ id:'simple', name:'Skills', skills:skills.simple }] : []);
  const link = (label:string, value?:string) => {
    if (!value) return null;
    const href = /^https?:\/\//i.test(value) ? value : label === 'Email' ? `mailto:${value}` : label === 'Phone' ? `tel:${value.replace(/[^+\d]/g,'')}` : value;
    return <a href={href} target={/^https?:\/\//i.test(href) ? '_blank' : undefined} rel={/^https?:\/\//i.test(href) ? 'noreferrer' : undefined} className="text-[10px] text-gray-700 hover:text-blue-700 underline-offset-2 hover:underline">{label === 'Portfolio' || label === 'LinkedIn' ? label : value}</a>;
  };
  return (
    <div className="w-full bg-white text-black" style={{fontFamily:'Arial, Helvetica, sans-serif', minHeight:'100%'}}>
      <header className="px-[7%] pt-[6%] pb-[3%]">
        <div className="text-[19px] font-normal leading-tight">{personalInfo.fullName || 'Your Name'}</div>
        {personalInfo.jobTitle && <div className="mt-1 text-[12px] leading-tight">{personalInfo.jobTitle}</div>}
        <div className="mt-2 flex flex-wrap gap-x-2 gap-y-0.5 text-[10px] leading-tight">
          {personalInfo.email && link('Email', personalInfo.email)}
          {personalInfo.phone && <><span>|</span>{link('Phone', personalInfo.phone)}</>}
          {personalInfo.location && <><span>|</span>{link('Location', personalInfo.location)}</>}
          {personalInfo.website && <><span>|</span>{link('Portfolio', personalInfo.website)}</>}
          {personalInfo.linkedin && <><span>|</span>{link('LinkedIn', personalInfo.linkedin)}</>}
        </div>
      </header>

      <main className="px-[7%] pb-[7%]">
        {summary && <section className="mb-4">
          <h2 className="mb-1 text-[12px] font-bold uppercase">PROFESSIONAL SUMMARY</h2>
          <p className="text-[11px] leading-[1.35]">{summary}</p>
        </section>}

        {experience.length > 0 && <section className="mb-4">
          <h2 className="mb-1 text-[12px] font-bold uppercase">EXPERIENCE</h2>
          <div className="space-y-2">
            {experience.map(e => <div key={e.id} className="text-[11px] leading-[1.35]">
              <div><span className="font-bold">{e.jobTitle}</span>{e.company ? ` | ${e.company}` : ''}{e.location ? ` | ${e.location}` : ''}{e.startDate || e.endDate ? ` | ${e.startDate}${e.endDate ? ` - ${e.endDate}` : ''}` : ''}</div>
              {e.bulletPoints.length > 0 && <ul className="ml-4 list-disc space-y-0.5">{e.bulletPoints.map((b,i)=><li key={i}>{b}</li>)}</ul>}
              {!e.bulletPoints.length && e.description && <p>{e.description}</p>}
            </div>)}
          </div>
        </section>}

        {projects.length > 0 && <section className="mb-4">
          <h2 className="mb-1 text-[12px] font-bold uppercase">PROJECTS</h2>
          <div className="space-y-2">
            {projects.map(p => <div key={p.id} className="text-[11px] leading-[1.35]">
              <div><span className="font-bold">{p.title}</span>{p.technologies.length ? ` | ${p.technologies.join(', ')}` : ''}{p.startDate || p.endDate ? ` | ${p.startDate}${p.endDate ? ` - ${p.endDate}` : ''}` : ''}</div>
              {p.description && <p>{p.description}</p>}
              <div className="flex flex-wrap gap-x-2">
                {p.liveUrl && <a href={p.liveUrl} target="_blank" rel="noreferrer" className="text-blue-700 underline">Portfolio</a>}
                {p.githubUrl && <a href={p.githubUrl} target="_blank" rel="noreferrer" className="text-blue-700 underline">Code</a>}
              </div>
            </div>)}
          </div>
        </section>}

        {education.length > 0 && <section className="mb-4">
          <h2 className="mb-1 text-[12px] font-bold uppercase">EDUCATION</h2>
          <div className="space-y-1 text-[11px] leading-[1.35]">
            {education.map(e => <div key={e.id}>{e.degree}{e.institution ? ` | ${e.institution}` : ''}{e.graduationYear ? ` | ${e.graduationYear}` : ''}{e.gpa ? ` | CGPA ${e.gpa}` : ''}</div>)}
          </div>
        </section>}

        {cats.length > 0 && <section>
          <h2 className="mb-1 text-[12px] font-bold uppercase">SKILLS</h2>
          <div className="text-[11px] leading-[1.35]">
            {cats.map((c,i) => <div key={c.id || i}><span className="font-bold">{c.name}:</span> {c.skills.join(', ')}</div>)}
          </div>
        </section>}
      </main>
    </div>
  );
};
