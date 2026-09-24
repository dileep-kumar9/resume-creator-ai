import React from 'react';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { FileText, Palette, Download, Zap, Users, Star } from 'lucide-react';
import { Link } from 'react-router-dom';

const Index = () => {
  return (
    <div className="min-h-screen bg-gradient-secondary">
      {/* Hero Section */}
      <div className="container mx-auto px-4 py-16">
        <div className="text-center mb-16">
          <div className="flex justify-center mb-6">
            <div className="w-20 h-20 rounded-2xl bg-gradient-primary flex items-center justify-center">
              <FileText className="w-10 h-10 text-white" />
            </div>
          </div>
          <h1 className="text-5xl font-bold text-gradient mb-6">Resume Maker</h1>
          <p className="text-xl text-text-secondary mb-8 max-w-2xl mx-auto">
            Create professional, ATS-friendly resumes with our modern resume builder. 
            Choose from 6 beautiful templates and customize to perfection.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button asChild size="lg" className="resume-hover">
              <Link to="/resume-maker">
                Start Building Your Resume
              </Link>
            </Button>
            <Button asChild variant="outline" size="lg" className="resume-hover">
              <Link to="/about">
                Learn More
              </Link>
            </Button>
          </div>
        </div>

        {/* Features Grid */}
        <div className="grid md:grid-cols-3 gap-8 mb-16">
          <Card className="resume-shadow resume-hover">
            <CardHeader>
              <div className="w-12 h-12 rounded-xl bg-resume-blue/10 flex items-center justify-center mb-4">
                <Palette className="w-6 h-6 text-resume-blue" />
              </div>
              <CardTitle>6 Professional Templates</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-text-secondary">
                Choose from modern templates designed for different industries and career levels.
              </p>
            </CardContent>
          </Card>

          <Card className="resume-shadow resume-hover">
            <CardHeader>
              <div className="w-12 h-12 rounded-xl bg-resume-green/10 flex items-center justify-center mb-4">
                <Zap className="w-6 h-6 text-resume-green" />
              </div>
              <CardTitle>ATS-Friendly</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-text-secondary">
                All templates are optimized for Applicant Tracking Systems with selectable text.
              </p>
            </CardContent>
          </Card>

          <Card className="resume-shadow resume-hover">
            <CardHeader>
              <div className="w-12 h-12 rounded-xl bg-resume-purple/10 flex items-center justify-center mb-4">
                <Download className="w-6 h-6 text-resume-purple" />
              </div>
              <CardTitle>PDF Download</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-text-secondary">
                Download your resume as a perfectly formatted PDF that fits on one page.
              </p>
            </CardContent>
          </Card>
        </div>

        {/* CTA Section */}
        <div className="text-center">
          <Card className="max-w-2xl mx-auto resume-shadow">
            <CardContent className="pt-8">
              <h2 className="text-3xl font-bold mb-4">Ready to Get Started?</h2>
              <p className="text-text-secondary mb-6">
                Join thousands of job seekers who have created professional resumes with our builder.
              </p>
              <Button asChild size="lg" className="resume-hover">
                <Link to="/resume-maker">
                  Create Your Resume Now
                </Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default Index;
