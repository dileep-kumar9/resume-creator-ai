import React from 'react';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Github, Linkedin, Globe, ArrowLeft, Code, Coffee, Heart } from 'lucide-react';
import { Link } from 'react-router-dom';

export const About: React.FC = () => {
  return (
    <div className="min-h-screen bg-gradient-secondary">
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          {/* Back button */}
          <Link to="/" className="inline-flex items-center gap-2 mb-8 text-primary hover:text-primary-hover transition-colors">
            <ArrowLeft className="w-4 h-4" />
            Back to Resume Maker
          </Link>

          {/* Header */}
          <div className="text-center mb-12">
            <h1 className="text-4xl font-bold text-gradient mb-4">About the Developer</h1>
            <p className="text-xl text-text-secondary">Meet the person behind Resume Maker</p>
          </div>

          {/* Main card */}
          <Card className="mb-8 resume-shadow">
            <CardHeader className="text-center pb-6">
              <div className="w-32 h-32 mx-auto mb-6 rounded-full bg-gradient-primary flex items-center justify-center">
                <Code className="w-16 h-16 text-white" />
              </div>
              <CardTitle className="text-3xl font-bold mb-2">Mustahoshin Hossain Ahamed Afif</CardTitle>
              <p className="text-xl text-text-secondary font-medium">M. H. A. Afif</p>
              <p className="text-text-light">Full Stack Developer & UI/UX Enthusiast</p>
            </CardHeader>
            
            <CardContent className="space-y-6">
              <div className="text-center">
                <p className="text-lg text-text-secondary leading-relaxed">
                  Passionate about creating beautiful, functional applications that solve real-world problems. 
                  Resume Maker was built to help job seekers create professional, ATS-friendly resumes with ease.
                </p>
              </div>

              {/* Skills */}
              <div className="grid md:grid-cols-3 gap-6 mt-8">
                <div className="text-center">
                  <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-resume-blue/10 flex items-center justify-center">
                    <Code className="w-8 h-8 text-resume-blue" />
                  </div>
                  <h3 className="font-semibold mb-2">Frontend Development</h3>
                  <p className="text-sm text-text-secondary">React, TypeScript, Tailwind CSS</p>
                </div>
                
                <div className="text-center">
                  <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-resume-green/10 flex items-center justify-center">
                    <Coffee className="w-8 h-8 text-resume-green" />
                  </div>
                  <h3 className="font-semibold mb-2">Backend Development</h3>
                  <p className="text-sm text-text-secondary">Node.js, Python, Databases</p>
                </div>
                
                <div className="text-center">
                  <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-resume-purple/10 flex items-center justify-center">
                    <Heart className="w-8 h-8 text-resume-purple" />
                  </div>
                  <h3 className="font-semibold mb-2">UI/UX Design</h3>
                  <p className="text-sm text-text-secondary">User-centered design, Prototyping</p>
                </div>
              </div>

              {/* Connect section */}
              <div className="border-t border-border pt-6">
                <h3 className="text-xl font-semibold text-center mb-6">Connect with me</h3>
                <div className="flex flex-wrap justify-center gap-4">
                  <Button 
                    asChild 
                    variant="outline" 
                    className="flex items-center gap-2 resume-hover"
                  >
                    <a 
                      href="https://www.linkedin.com/in/mha-afif/" 
                      target="_blank" 
                      rel="noopener noreferrer"
                    >
                      <Linkedin className="w-5 h-5" />
                      LinkedIn
                    </a>
                  </Button>
                  
                  <Button 
                    asChild 
                    variant="outline" 
                    className="flex items-center gap-2 resume-hover"
                  >
                    <a 
                      href="https://github.com/Afif718" 
                      target="_blank" 
                      rel="noopener noreferrer"
                    >
                      <Github className="w-5 h-5" />
                      GitHub
                    </a>
                  </Button>
                  
                  <Button 
                    asChild 
                    variant="outline" 
                    className="flex items-center gap-2 resume-hover"
                  >
                    <a 
                      href="https://afif.systemsage.tech/" 
                      target="_blank" 
                      rel="noopener noreferrer"
                    >
                      <Globe className="w-5 h-5" />
                      Portfolio
                    </a>
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Project info */}
          <Card className="resume-shadow">
            <CardContent className="pt-6">
              <div className="text-center">
                <h3 className="text-xl font-semibold mb-4">About Resume Maker</h3>
                <p className="text-text-secondary leading-relaxed">
                  This application was built with React, TypeScript, and Tailwind CSS. It features real-time preview, 
                  multiple professional templates, drag-and-drop functionality, and ATS-friendly PDF generation. 
                  The goal is to make creating professional resumes accessible and enjoyable for everyone.
                </p>
                
                <div className="mt-6 pt-6 border-t border-border">
                  <p className="text-sm text-text-light">
                    Made with <Heart className="w-4 h-4 inline text-resume-red" /> for job seekers everywhere
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};