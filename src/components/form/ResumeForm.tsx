import React, { useState } from 'react';
import { PersonalInfoForm } from './sections/PersonalInfoForm';
import { SummaryForm } from './sections/SummaryForm';
import { ExperienceForm } from './sections/ExperienceForm';
import { EducationForm } from './sections/EducationForm';
import { ProjectsForm } from './sections/ProjectsForm';
import { SkillsForm } from './sections/SkillsForm';
import { CustomSectionsForm } from './sections/CustomSectionsForm';
import { TemplateSelector } from './sections/TemplateSelector';
import { ColorCustomizer } from './sections/ColorCustomizer';
import { SectionManager } from './sections/SectionManager';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { AITailorPanel } from './AITailorPanel';

interface ResumeFormProps {
  activePanel: 'form' | 'customize' | 'settings' | 'ai-tailor' | 'templates';
}

export const ResumeForm: React.FC<ResumeFormProps> = ({ activePanel }) => {
  const [activeTab, setActiveTab] = useState('personal');

  const renderPanel = () => {
    switch (activePanel) {
      case 'form':
        return (
          <div className="resume-form-root p-3 h-full min-h-0">
            <Tabs value={activeTab} onValueChange={setActiveTab} className="h-full min-h-0 flex flex-col">
              <TabsList className="resume-form-tabs grid w-full grid-cols-4 gap-1 mb-3 shrink-0" aria-label="Resume sections">
                <TabsTrigger value="personal" className="resume-form-tab">Personal</TabsTrigger>
                <TabsTrigger value="experience" className="resume-form-tab" title="Work & Projects">Work</TabsTrigger>
                <TabsTrigger value="education" className="resume-form-tab" title="Education & Skills">Education</TabsTrigger>
                <TabsTrigger value="custom" className="resume-form-tab">Custom</TabsTrigger>
              </TabsList>

              <div className="resume-form-scroll flex-1 min-h-0 overflow-y-auto overflow-x-hidden">
                <TabsContent value="personal" className="space-y-4 mt-0">
                  <PersonalInfoForm />
                  <SummaryForm />
                </TabsContent>

                <TabsContent value="experience" className="space-y-4 mt-0">
                  <ExperienceForm />
                  <ProjectsForm />
                </TabsContent>

                <TabsContent value="education" className="space-y-4 mt-0">
                  <EducationForm />
                  <SkillsForm />
                </TabsContent>

                <TabsContent value="custom" className="space-y-4 mt-0">
                  <CustomSectionsForm />
                </TabsContent>
              </div>
            </Tabs>
          </div>
        );

      case 'templates':
        return <div className="space-y-8 p-6"><TemplateSelector /></div>;
      case 'customize':
        return <div className="space-y-8 p-6"><ColorCustomizer /></div>;
      
      case 'ai-tailor':
        return <AITailorPanel />;
      case 'settings':
        return (
          <div className="space-y-8 p-6">
            <SectionManager />
          </div>
        );
      
      default:
        return null;
    }
  };

  return (
    <div className="resume-form-root h-full min-h-0">
      {activePanel === 'form'
        ? renderPanel()
        : <div className="resume-form-panel-scroll h-full overflow-y-auto overflow-x-hidden">{renderPanel()}</div>}
    </div>
  );
};