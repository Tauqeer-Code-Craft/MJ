import React from 'react';
import { Link } from 'react-router-dom';
import { Button } from '../components/UI';
import { Cloud, Zap, Shield, GitBranch, ArrowRight } from 'lucide-react';

const Landing: React.FC = () => {
  return (
    <div className="flex flex-col min-h-screen">
      {/* Hero */}
      <section className="relative pt-32 pb-20 overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-zinc-800/20 via-zinc-950 to-zinc-950 pointer-events-none" />
        <div className="container mx-auto px-4 text-center relative z-10">
          <div className="inline-flex items-center rounded-full border border-zinc-800 bg-zinc-900/50 px-3 py-1 text-sm text-zinc-400 backdrop-blur-xl mb-8">
            <span className="flex h-2 w-2 rounded-full bg-blue-500 mr-2"></span>
            SkyDeploy v3.6 is now live
          </div>
          <h1 className="text-5xl md:text-7xl font-bold tracking-tight text-white mb-6">
            Deploy your code <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-600">
              to the sky.
            </span>
          </h1>
          <p className="text-lg md:text-xl text-zinc-400 max-w-2xl mx-auto mb-10 leading-relaxed">
            A developer-first mini PaaS that simplifies application deployment. 
            Push code, we handle the rest. Fast, secure, and scalable.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link to="/register">
              <Button className="h-12 px-8 text-base">Start Deploying</Button>
            </Link>
            <Link to="/login">
              <Button variant="secondary" className="h-12 px-8 text-base">Login</Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-24 bg-zinc-900/20 border-y border-zinc-800/50">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
            <FeatureCard 
              icon={<Zap className="h-6 w-6 text-yellow-400" />}
              title="Lightning Fast"
              description="Deployments that take seconds, not minutes. Optimized build pipelines for modern frameworks."
            />
            <FeatureCard 
              icon={<GitBranch className="h-6 w-6 text-blue-400" />}
              title="Multi-Framework"
              description="Support for React, Next.js, Python, Node, and more. Auto-detection for seamless builds."
            />
            <FeatureCard 
              icon={<Shield className="h-6 w-6 text-green-400" />}
              title="Secure by Default"
              description="Isolated containers, automatic HTTPS, and secure environment variable management."
            />
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 border-t border-zinc-900 mt-auto">
        <div className="container mx-auto px-4 flex flex-col md:flex-row justify-between items-center text-zinc-500 text-sm">
          <div className="flex items-center gap-2 mb-4 md:mb-0">
            <Cloud className="h-5 w-5 text-zinc-100" />
            <span className="font-semibold text-zinc-100">SkyDeploy</span>
          </div>
          <div className="flex gap-6">
            <a href="#" className="hover:text-zinc-300 transition-colors">Documentation</a>
            <a href="#" className="hover:text-zinc-300 transition-colors">GitHub</a>
            <a href="#" className="hover:text-zinc-300 transition-colors">Status</a>
          </div>
        </div>
      </footer>
    </div>
  );
};

const FeatureCard = ({ icon, title, description }: { icon: React.ReactNode, title: string, description: string }) => (
  <div className="flex flex-col items-start p-6 rounded-xl border border-zinc-800 bg-zinc-950 hover:border-zinc-700 transition-colors">
    <div className="p-3 rounded-lg bg-zinc-900 mb-4 border border-zinc-800">
      {icon}
    </div>
    <h3 className="text-xl font-bold text-zinc-100 mb-2">{title}</h3>
    <p className="text-zinc-400 leading-relaxed">{description}</p>
  </div>
);

export default Landing;
