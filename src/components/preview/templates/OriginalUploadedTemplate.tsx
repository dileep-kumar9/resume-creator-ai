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
  const link = (label:string, value?:string) => value ? <span className="text-[10px] text-gray-600"><span className="text-emerald-500">●</span> {label}</span> : null;
  return (
    <div className="h-full w-full bg-white text-gray-700" style={{fontFamily:'Georgia, serif'}}>
      <div className="border-b border-blue-100 px-[8%] pt-[5%] pb-[3%]">
        <div className="text-[22px] font-bold text-blue-600">{personalInfo.fullName || 'Your Name'}</div>
        <div className="mt-1 text-[11px] text-gray-600">{personalInfo.jobTitle}</div>
        <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1">
          {link('Email', personalInfo.email)}{link('Phone', personalInfo.phone)}{link('Location', personalInfo.location)}{link('Portfolio', personalInfo.website)}{link('LinkedIn', personalInfo.linkedin)}
        </div>
      </div>
      <div className="grid h-[calc(100%-92px)] grid-cols-[30%_70%] gap-6 px-[8%] py-[2%]">
        <aside>
          {education.length>0 && <><Heading>Education</Heading><div className="space-y-2">{education.map(e=><div key={e.id} className="text-[10px] leading-[1.35]"><div className="font-semibold text-gray-600">{e.degree}</div><div>{e.institution}</div><div className="text-gray-400">{e.graduationYear}{e.gpa ? ` · ${e.gpa}`:''}</div></div>)}</div></>}
          {cats.length>0 && <><Heading>Skills</Heading><div className="space-y-2">{cats.map(c=><div key={c.id}><div className="mb-1 text-[10px] font-semibold text-gray-600">{c.name}</div><div className="flex flex-wrap gap-1">{c.skills.map((x,i)=><span key={i} className="rounded-full bg-emerald-50 px-1.5 py-0.5 text-[9px] text-emerald-700">{x}</span>)}</div></div>)}</div></>}
        </aside>
        <main>
          {summary && <><Heading>Profile</Heading><p className="text-[10px] leading-[1.45]">{summary}</p></>}
          {experience.length>0 && <><Heading>Experience</Heading><div className="space-y-2">{experience.map(e=><div key={e.id}><div className="flex items-start justify-between gap-2"><div><div className="text-[11px] font-bold text-gray-700">{e.jobTitle}</div><div className="text-[10px] text-gray-500">{e.company}{e.location ? ` · ${e.location}`:''}</div></div><div className="rounded-full bg-blue-50 px-1.5 py-0.5 text-[9px] text-blue-600">{e.startDate}{e.endDate ? ` – ${e.endDate}` : ''}</div></div><ul className="ml-3 mt-1 list-disc space-y-0.5 text-[10px] leading-[1.35]">{e.bulletPoints.map((b,i)=><li key={i}>{b}</li>)}</ul></div>)}</div></>}
          {projects.length>0 && <><Heading>Projects</Heading><div className="space-y-2">{projects.map(p=><div key={p.id}><div className="flex items-start justify-between gap-2"><div className="text-[11px] font-bold text-gray-700">{p.title}</div>{(p.startDate||p.endDate)&&<div className="rounded-full bg-blue-50 px-1.5 py-0.5 text-[9px] text-blue-600">{p.startDate}{p.endDate ? ` – ${p.endDate}`:''}</div>}</div><p className="mt-1 text-[10px] leading-[1.35]">{p.description}</p><div className="mt-1 flex flex-wrap gap-1">{p.technologies.map((x,i)=><span key={i} className="rounded bg-gray-100 px-1 text-[9px] text-gray-600">{x}</span>)}</div></div>)}</div></>}
        </main>
      </div>
    </div>
  );
};
