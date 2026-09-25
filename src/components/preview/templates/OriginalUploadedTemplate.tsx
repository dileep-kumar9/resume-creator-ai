import React from 'react';
import { ResumeData } from '../../../types/resume';
import { normalizeUrl } from '../../../utils/links';

interface Props { data: ResumeData }

/**
 * Extracted from Badham Dileep Kumar's uploaded resume PDF.
 * This is a reusable template/layout, not an image/PDF background:
 * centered header, compact contact row, black ruled section headings,
 * single-column content, bold entry titles, and compact bullet lists.
 */
export const OriginalUploadedTemplate: React.FC<Props> = ({ data }) => {
  const { personalInfo, summary, experience, education, projects, skills, sections, customSections } = data;
  // The source PDF uses Helvetica at approximately 9.2 pt for body text.
  // CSS px are 0.75 pt in print, so 12.27px reproduces that size.
  const bodyFontSize = data.fontSize === 'small' ? 11.2 : data.fontSize === 'large' ? 13.6 : 12.27;
  const sectionFontSize = bodyFontSize * (11 / 9.2);
  const contactFontSize = bodyFontSize * (9.5 / 9.2);
  const titleFontSize = bodyFontSize * (10.5 / 9.2);
  const headingColor = data.colors.primary || '#244678';

  const visible = new Set(
    sections.filter(section => section.visible).map(section => section.id)
  );

  const categories = skills.categorized.length
    ? skills.categorized
    : (skills.simple.length ? [{ id: 'simple', name: 'Skills', skills: skills.simple }] : []);

  const external = (value: string) => /^https?:\/\//i.test(value) ? value : normalizeUrl(value);

  const ContactLink = ({ label, value, kind }: { label: string; value?: string; kind?: 'email' | 'phone' | 'url' }) => {
    if (!value) return null;
    const href = kind === 'email'
      ? `mailto:${value}`
      : kind === 'phone'
        ? `tel:${value.replace(/[^+\d]/g, '')}`
        : external(value);
    const display = label === 'Portfolio' || label === 'LinkedIn' ? label : value;
    return <a href={href} target={kind === 'url' ? '_blank' : undefined} rel={kind === 'url' ? 'noreferrer' : undefined} className="hover:underline">{display}</a>;
  };

  const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
    <section className="mb-[13px]">
      <h2 className="mb-[7px] border-b pb-[4px] text-[12px] font-bold uppercase leading-none" style={{ color: headingColor, borderColor: headingColor, fontSize: `${sectionFontSize}px` }}>
        {title}
      </h2>
      {children}
    </section>
  );

  return (
    <div
      className="w-full bg-white text-black"
      data-template="badham-original"
      style={{
        minHeight: '100%',
        fontFamily: `${data.fontFamily || 'Helvetica'}, Arial, Helvetica, sans-serif`,
        fontSize: `${bodyFontSize}px`,
        lineHeight: 1.34,
        boxSizing: 'border-box',
      }}
    >
      <header className="text-center pb-[10px]">
        <h1 className="m-0 font-bold leading-[1.05]" style={{ fontSize: '24px' }}>
          {personalInfo.fullName || 'Your Name'}
        </h1>

        <div className="mt-[5px] leading-[1.25]" style={{ fontSize: `${contactFontSize}px` }}>
          {personalInfo.email && <ContactLink label="Email" value={personalInfo.email} kind="email" />}
          {personalInfo.phone && <><span> | </span><ContactLink label="Phone" value={personalInfo.phone} kind="phone" /></>}
          {personalInfo.location && <><span> | </span><span>{personalInfo.location}</span></>}
          {personalInfo.linkedin && <><span> | </span><ContactLink label="LinkedIn" value={personalInfo.linkedin} kind="url" /></>}
          {personalInfo.website && <><span> | </span><ContactLink label="Portfolio" value={personalInfo.website} kind="url" /></>}
        </div>

        {personalInfo.jobTitle && (
          <div className="mt-[9px] font-bold leading-[1.15]" style={{ fontSize: `${titleFontSize}px` }}>
            {personalInfo.jobTitle}
          </div>
        )}
      </header>

      <main>
        {visible.has('summary') && summary && (
          <Section title="Professional Summary">
            <p className="m-0 text-justify">{summary}</p>
          </Section>
        )}

        {visible.has('skills') && categories.length > 0 && (
          <Section title="Core Skills">
            <div className="space-y-[5px]">
              {categories.map((category, index) => (
                <div key={category.id || index} className="flex items-start gap-[5px]">
                  <span className="mt-[1px]">•</span>
                  <div>
                    <strong>{category.name}:</strong>{' '}
                    <span>{category.skills.join(', ')}</span>
                  </div>
                </div>
              ))}
            </div>
          </Section>
        )}

        {visible.has('experience') && experience.length > 0 && (
          <Section title="Internship Experience">
            <div className="space-y-[7px]">
              {experience.map(item => (
                <div key={item.id}>
                  <div className="mb-[3px]">
                    <strong>{item.jobTitle}</strong>
                    {item.company && <> <span>|</span> {item.company}</>}
                    {(item.startDate || item.endDate) && <> <span>|</span> {item.startDate}{item.endDate ? ` - ${item.endDate}` : ''}</>}
                  </div>
                  {item.bulletPoints.length > 0 ? (
                    <ul className="m-0 ml-[15px] list-disc space-y-[2px] pl-[8px]">
                      {item.bulletPoints.map((bullet, index) => <li key={index}>{bullet}</li>)}
                    </ul>
                  ) : item.description ? <p className="m-0">{item.description}</p> : null}
                </div>
              ))}
            </div>
          </Section>
        )}

        {visible.has('projects') && projects.length > 0 && (
          <Section title="Key Projects">
            <div className="space-y-[8px]">
              {projects.map(project => (
                <div key={project.id}>
                  <div className="mb-[3px]">
                    <strong>{project.title}</strong>
                    {project.technologies.length > 0 && <> <span>|</span> <em>{project.technologies.join(', ')}</em></>}
                    {(project.startDate || project.endDate) && <> <span>|</span> {project.startDate}{project.endDate ? ` - ${project.endDate}` : ''}</>}
                  </div>
                  {project.description && <p className="m-0">{project.description}</p>}
                  {(project.liveUrl || project.githubUrl) && (
                    <div className="mt-[2px] flex gap-3 text-[10px]">
                      {project.liveUrl && <a href={external(project.liveUrl)} target="_blank" rel="noreferrer" className="underline">Portfolio</a>}
                      {project.githubUrl && <a href={external(project.githubUrl)} target="_blank" rel="noreferrer" className="underline">Code</a>}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </Section>
        )}

        {visible.has('education') && education.length > 0 && (
          <Section title="Education">
            <div className="space-y-[6px]">
              {education.map(item => (
                <div key={item.id}>
                  <div className="flex items-start justify-between gap-4">
                    <strong className="font-bold">{item.degree}</strong>
                    {item.graduationYear && <span className="shrink-0 text-right">{item.graduationYear}</span>}
                  </div>
                  <div className="text-[#444]">
                    {item.institution}{item.location ? `, ${item.location}` : ''}{item.gpa ? ` — ${item.id === 'btech-it' ? 'CGPA: ' : ''}${item.gpa}` : ''}
                  </div>
                </div>
              ))}
            </div>
          </Section>
        )}

        {visible.has('custom') && customSections.filter(section => section.visible).sort((a, b) => a.order - b.order).map(section => (
          <Section key={section.id} title={section.title}>
            {section.type === 'bullets' ? (
              <ul className="m-0 list-disc pl-4"><li>{section.content}</li></ul>
            ) : <p className="m-0">{section.content}</p>}
          </Section>
        ))}
      </main>
    </div>
  );
};
