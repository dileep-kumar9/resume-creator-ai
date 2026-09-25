import React from 'react';
import { useResume } from '../../../contexts/ResumeContext';
import { Card, CardContent, CardHeader, CardTitle } from '../../ui/card';
import { Button } from '../../ui/button';
import { Badge } from '../../ui/badge';
import { TEMPLATE_CONFIGS, TemplateType } from '../../../types/resume';
import { Check, Eye, LayoutTemplate } from 'lucide-react';

export const TemplateSelector: React.FC = () => {
  const { state, updateTemplate } = useResume();
  const { template: selectedTemplate } = state.resumeData;

  const selectTemplate = (templateId: TemplateType) => {
    updateTemplate(templateId);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Choose Template</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <Card className={`border-2 ${selectedTemplate === 'original-upload' ? 'border-primary ring-2 ring-primary/30' : 'border-dashed'}`}>
            <CardContent className="p-4">
              <div className="mb-3 overflow-hidden rounded-md border bg-white p-3">
                <div className="text-center text-[9px] text-black">
                  <div className="font-bold text-[12px]">Badham Dileep Kumar</div>
                  <div className="mt-1 text-[7px]">Email | Phone | Location | LinkedIn | Portfolio</div>
                  <div className="mt-1 font-bold text-[8px]">Technical Customer Support Engineer | Customer Success & Troubleshooting</div>
                </div>
                {['PROFESSIONAL SUMMARY','CORE SKILLS','INTERNSHIP EXPERIENCE','KEY PROJECTS','EDUCATION'].map((heading) => (
                  <div key={heading} className="mt-2">
                    <div className="text-[7px] font-bold text-black">{heading}</div>
                    <div className="mt-0.5 h-px w-full bg-black" />
                    <div className="mt-1 space-y-0.5">
                      <div className="h-1.5 w-[92%] rounded bg-gray-200" />
                      <div className="h-1.5 w-[82%] rounded bg-gray-200" />
                    </div>
                  </div>
                ))}
              </div>
              <div className="space-y-3">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <LayoutTemplate className="w-4 h-4 text-primary" />
                      <h3 className="font-semibold text-base">Original Resume — Badham Layout</h3>
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">
                      Extracted from your original resume: centered header, compact contact row, ruled section headings, bold entry titles, and a clean single-column layout. This is a reusable template for your resume content.
                    </p>
                  </div>
                  {selectedTemplate === 'original-upload' && <Check className="w-5 h-5 text-primary" />}
                </div>
                <div className="flex flex-wrap gap-2"><Badge variant="default" className="text-xs">First choice</Badge><Badge variant="outline" className="text-xs">Extracted from your original PDF</Badge></div>
                {state.resumeData.originalTemplate?.tailored && (
                  <div className="rounded-md bg-primary/5 border border-primary/20 px-3 py-2 text-xs text-muted-foreground">
                    This template is editable and remains selected during tailoring. AI changes resume content only; it does not replace this layout.
                  </div>
                )}
                <Button
                  variant={selectedTemplate === 'original-upload' ? 'default' : 'outline'}
                  size="sm"
                  className="w-full"
                  onClick={() => updateTemplate('original-upload')}
                >
                  {selectedTemplate === 'original-upload' ? 'Selected' : 'Use This Template'}
                </Button>
              </div>
            </CardContent>
          </Card>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {TEMPLATE_CONFIGS.map((template) => (
            <Card 
              key={template.id}
              className={`cursor-pointer transition-all hover:shadow-md ${
                selectedTemplate === template.id 
                  ? 'ring-2 ring-primary border-primary' 
                  : 'hover:border-primary/50'
              }`}
              onClick={() => selectTemplate(template.id)}
            >
              <CardContent className="p-4">
                <div className="space-y-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="font-semibold text-base">{template.name}</h3>
                      <p className="text-sm text-muted-foreground mt-1">
                        {template.description}
                      </p>
                    </div>
                    {selectedTemplate === template.id && (
                      <div className="flex-shrink-0">
                        <div className="w-6 h-6 rounded-full bg-primary flex items-center justify-center">
                          <Check className="w-4 h-4 text-white" />
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="flex flex-wrap gap-1">
                    <Badge variant="outline" className="text-xs">
                      {template.category}
                    </Badge>
                    <Badge variant="outline" className="text-xs">
                      {template.layout}
                    </Badge>
                    <Badge variant="outline" className="text-xs">
                      {template.fontFamily}
                    </Badge>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">Colors:</span>
                      <div className="flex gap-1">
                        {template.colorScheme.slice(0, 3).map((color, index) => (
                          <div
                            key={index}
                            className="w-4 h-4 rounded-full border border-border"
                            style={{ backgroundColor: color }}
                          />
                        ))}
                      </div>
                    </div>

                    <div className="space-y-1">
                      <span className="text-xs text-muted-foreground">Features:</span>
                      <ul className="text-xs text-muted-foreground">
                        {template.features.slice(0, 3).map((feature, index) => (
                          <li key={index} className="flex items-center gap-1">
                            <span className="w-1 h-1 rounded-full bg-muted-foreground"></span>
                            {feature}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>

                  <Button
                    variant={selectedTemplate === template.id ? "default" : "outline"}
                    size="sm"
                    className="w-full"
                    onClick={(e) => {
                      e.stopPropagation();
                      selectTemplate(template.id);
                    }}
                  >
                    {selectedTemplate === template.id ? (
                      <>
                        <Check className="w-4 h-4 mr-2" />
                        Selected
                      </>
                    ) : (
                      <>
                        <Eye className="w-4 h-4 mr-2" />
                        Use Template
                      </>
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="mt-6 p-4 bg-muted rounded-lg">
          <h4 className="font-medium mb-2">Template Guidelines</h4>
          <ul className="text-sm text-muted-foreground space-y-1">
            <li>• All templates are ATS-friendly and designed to fit on one page</li>
            <li>• You can switch templates anytime without losing your data</li>
            <li>• Each template is optimized for different career types and industries</li>
            <li>• Colors and fonts can be customized for each template</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
};