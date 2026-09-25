import React from 'react';
import { useResume } from '../../../contexts/ResumeContext';
import { Card, CardContent, CardHeader, CardTitle } from '../../ui/card';
import { Button } from '../../ui/button';
import { Badge } from '../../ui/badge';
import { TEMPLATE_CONFIGS, TemplateType } from '../../../types/resume';
import { Check, Eye } from 'lucide-react';

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
        <Card
            className={`border-2 overflow-hidden cursor-pointer transition-all ${selectedTemplate === 'original-upload' ? 'border-primary ring-2 ring-primary/30' : 'border-dashed hover:border-primary/50'}`}
            onClick={() => state.resumeData.originalTemplate && updateTemplate('original-upload')}
          >
            <div className="relative bg-muted/30 border-b">
              <div className="absolute left-3 top-3 z-10 flex items-center gap-2">
                <Badge className="bg-background/95 text-foreground border shadow-sm">Original uploaded template</Badge>
                <Badge variant="outline" className="bg-background/95 text-foreground">
                  {state.resumeData.originalTemplate?.sourceFormat?.toUpperCase() || 'PDF'}
                </Badge>
              </div>
              {selectedTemplate === 'original-upload' && (
                <div className="absolute right-3 top-3 z-10 rounded-full bg-primary p-1.5 text-primary-foreground shadow">
                  <Check className="w-4 h-4" />
                </div>
              )}
              <div className="h-64 w-full overflow-hidden bg-white flex items-center justify-center">
                {(state.resumeData.originalTemplate?.sourceFormat === 'pdf' && state.resumeData.originalTemplate.sourceDataUrl) || !state.resumeData.originalTemplate ? (
                  <iframe
                    title="Original uploaded resume template preview"
                    src={state.resumeData.originalTemplate?.sourceDataUrl || '/templates/badham-dileep-kumar-original-resume.pdf'}
                    className="h-full w-full border-0 pointer-events-none"
                  />
                ) : (
                  <div className="px-6 text-center text-sm text-muted-foreground">
                    <div className="mx-auto mb-2 w-12 h-14 rounded border bg-white flex items-center justify-center">
                      <span className="text-xs font-semibold">PDF</span>
                    </div>
                    Preview is preserved when the original document is opened.
                  </div>
                )}
              </div>
            </div>
            <CardContent className="p-4">
              <div className="space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="font-semibold text-base">Original Uploaded Resume</h3>
                    <p className="text-sm text-muted-foreground mt-1 break-words">
                      {state.resumeData.originalTemplate?.sourceFileName || 'Badham Dileep Kumar — Original Resume'}
                    </p>
                    <p className="text-xs text-muted-foreground mt-2">
                      This is your original resume design. It is kept as a first-class template and is never replaced automatically by AI tailoring.
                    </p>
                  </div>
                </div>
                {state.resumeData.originalTemplate?.tailored && (
                  <div className="rounded-md bg-primary/5 border border-primary/20 px-3 py-2 text-xs text-muted-foreground">
                    Tailored resume data is currently rendered using the original-style editable layout.
                  </div>
                )}
                <Button
                  variant={selectedTemplate === 'original-upload' ? 'default' : 'outline'}
                  disabled={!state.resumeData.originalTemplate}
                  size="sm"
                  className="w-full"
                  onClick={(e) => { e.stopPropagation(); if (state.resumeData.originalTemplate) updateTemplate('original-upload'); }}
                >
                  {selectedTemplate === 'original-upload' ? (
                    <><Check className="w-4 h-4 mr-2" />Original Selected</>
                  ) : state.resumeData.originalTemplate ? 'Use Original' : 'Upload Resume to Activate'}
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