import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getAppDetails, redeployApp, deleteApp } from '../services/api';
import { AppData } from '../types';
import { Button, Input, Modal, Badge } from '../components/UI';
import { 
  GitBranch, 
  ExternalLink, 
  Terminal, 
  RefreshCw, 
  Trash2, 
  Database, 
  Clock, 
  ArrowLeft,
  Server,
  Activity,
  Copy,
  Check
} from 'lucide-react';

const AppDetails: React.FC = () => {
  const { appName } = useParams<{ appName: string }>();
  const navigate = useNavigate();
  const { showToast } = useAuth();
  
  const [app, setApp] = useState<AppData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  // Modals
  const [isRedeployOpen, setIsRedeployOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  
  // Action States
  const [actionLoading, setActionLoading] = useState(false);
  const [redeployEnv, setRedeployEnv] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (appName) {
      fetchDetails();
    }
  }, [appName]);

  const fetchDetails = async () => {
    if (!appName) return;
    try {
      setLoading(true);
      setError('');
      const data = await getAppDetails(appName);
      setApp(data);
    } catch (err) {
      setError('Failed to load application details.');
      showToast('Could not fetch app details', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleEnvProcessing = (raw: string): string => {
    return raw
      .split(',')
      .map(e => e.trim())
      .filter(e => e && !e.startsWith('PORT='))
      .join(',');
  };

  const handleRedeploy = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!app) return;
    setActionLoading(true);
    try {
      await redeployApp(app.app_name, { ENV_KEYS: handleEnvProcessing(redeployEnv) });
      showToast('Redeployment initiated successfully', 'success');
      setIsRedeployOpen(false);
      fetchDetails(); // Refresh status
    } catch (err) {
      showToast('Redeployment failed', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!app) return;
    setActionLoading(true);
    try {
      await deleteApp(app.app_name);
      showToast('App deleted successfully', 'success');
      navigate('/dashboard');
    } catch (err) {
      showToast('Failed to delete app', 'error');
      setActionLoading(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    showToast('Copied to clipboard', 'success');
  };

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-5xl">
         <div className="h-8 w-32 bg-zinc-800 rounded animate-pulse mb-8" />
         <div className="h-64 bg-zinc-900 rounded-lg border border-zinc-800 animate-pulse" />
      </div>
    );
  }

  if (error || !app) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-5xl text-center">
        <h2 className="text-xl text-red-500 font-semibold mb-2">{error || 'App not found'}</h2>
        <Button onClick={() => navigate('/dashboard')} variant="secondary">Back to Dashboard</Button>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-5xl animate-in fade-in duration-300">
      <Button 
        variant="ghost" 
        className="mb-6 pl-0 hover:pl-2 transition-all text-zinc-400 hover:text-white"
        onClick={() => navigate('/dashboard')}
      >
        <ArrowLeft className="mr-2 h-4 w-4" /> Back to Dashboard
      </Button>

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <h1 className="text-3xl font-bold text-white tracking-tight">{app.app_name}</h1>
            <Badge status={app.status} />
          </div>
          <a 
            href={app.git_repo_url} 
            target="_blank" 
            rel="noreferrer" 
            className="text-sm text-zinc-500 hover:text-blue-400 flex items-center gap-1 transition-colors"
          >
            <GitBranch className="h-3 w-3" />
            {app.git_repo_url}
          </a>
        </div>
        <div className="flex gap-3">
            {app.access_url && (
                <a href={app.access_url} target="_blank" rel="noreferrer">
                    <Button>
                        <ExternalLink className="mr-2 h-4 w-4" /> Open App
                    </Button>
                </a>
            )}
            <Button variant="secondary" onClick={() => setIsRedeployOpen(true)}>
                <RefreshCw className="mr-2 h-4 w-4" /> Redeploy
            </Button>
            <Button variant="danger" onClick={() => setIsDeleteOpen(true)}>
                <Trash2 className="h-4 w-4" />
            </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Main Info */}
        <div className="md:col-span-2 space-y-6">
            <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-6">
                <h3 className="text-lg font-semibold text-zinc-100 mb-4 flex items-center gap-2">
                    <Activity className="h-5 w-5 text-blue-500" /> Deployment Info
                </h3>
                <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-6">
                    <div>
                        <dt className="text-sm font-medium text-zinc-500 mb-1">Framework</dt>
                        <dd className="text-zinc-200 capitalize flex items-center gap-2">
                             <div className="h-2 w-2 rounded-full bg-white" />
                             {app.framework}
                        </dd>
                    </div>
                    <div>
                        <dt className="text-sm font-medium text-zinc-500 mb-1">Port</dt>
                        <dd className="text-zinc-200 font-mono">{app.port}</dd>
                    </div>
                    <div>
                        <dt className="text-sm font-medium text-zinc-500 mb-1">Container ID</dt>
                        <dd className="text-zinc-200 font-mono text-xs bg-zinc-900 py-1 px-2 rounded w-fit">
                            {app.container_id || 'Pending'}
                        </dd>
                    </div>
                    <div>
                        <dt className="text-sm font-medium text-zinc-500 mb-1">Project Root</dt>
                        <dd className="text-zinc-200 font-mono text-sm">{app.project_root || './'}</dd>
                    </div>
                    <div className="sm:col-span-2">
                        <dt className="text-sm font-medium text-zinc-500 mb-1">Public URL</dt>
                        <dd className="flex items-center gap-2">
                            {app.access_url ? (
                                <a href={app.access_url} target="_blank" rel="noreferrer" className="text-blue-400 hover:underline break-all">
                                    {app.access_url}
                                </a>
                            ) : (
                                <span className="text-zinc-600">Not available</span>
                            )}
                        </dd>
                    </div>
                </dl>
            </div>

            {/* Linked Database */}
            {app.database && (
                 <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-6">
                    <h3 className="text-lg font-semibold text-zinc-100 mb-4 flex items-center gap-2">
                        <Database className="h-5 w-5 text-green-500" /> Linked Database
                    </h3>
                    <div className="bg-zinc-900/50 rounded-lg p-4 border border-zinc-900">
                        <div className="flex items-center justify-between mb-2">
                             <span className="font-medium text-zinc-200">{app.database.name}</span>
                             <Badge status={app.database.status || 'unknown'} />
                        </div>
                        {app.database.connection_uri && (
                             <div className="relative group mt-3">
                                <code className="block bg-black rounded p-3 text-xs text-zinc-400 font-mono break-all pr-10">
                                    {app.database.connection_uri}
                                </code>
                                <button
                                    onClick={() => copyToClipboard(app.database?.connection_uri || '')}
                                    className="absolute right-2 top-2 p-1 rounded hover:bg-zinc-800 text-zinc-500 hover:text-white"
                                >
                                    {copied ? <Check className="h-3 w-3 text-green-400" /> : <Copy className="h-3 w-3" />}
                                </button>
                             </div>
                        )}
                    </div>
                 </div>
            )}
        </div>

        {/* Sidebar / Metadata */}
        <div className="space-y-6">
            <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-6">
                <h3 className="text-sm font-medium text-zinc-400 mb-4 uppercase tracking-wider">Metadata</h3>
                <div className="space-y-4">
                    <div className="flex items-center gap-3 text-sm text-zinc-300">
                        <Clock className="h-4 w-4 text-zinc-500" />
                        <span>Created {app.createdAt ? new Date(app.createdAt).toLocaleDateString() : 'N/A'}</span>
                    </div>
                    <div className="flex items-center gap-3 text-sm text-zinc-300">
                         <Server className="h-4 w-4 text-zinc-500" />
                         <span>Type: {app.app_type || 'Web Service'}</span>
                    </div>
                </div>
            </div>

            <div className="rounded-xl border border-red-900/20 bg-red-950/5 p-6">
                <h3 className="text-sm font-medium text-red-400 mb-2">Danger Zone</h3>
                <p className="text-xs text-red-400/70 mb-4">Irreversible actions for this application.</p>
                <Button variant="danger" className="w-full justify-start" onClick={() => setIsDeleteOpen(true)}>
                    <Trash2 className="mr-2 h-4 w-4" /> Delete Application
                </Button>
            </div>
        </div>
      </div>

      {/* Redeploy Modal with Confirmation */}
      <Modal 
        isOpen={isRedeployOpen} 
        onClose={() => setIsRedeployOpen(false)} 
        title="Redeploy Application"
      >
        <form onSubmit={handleRedeploy} className="space-y-4 mt-2">
           <div className="bg-blue-900/20 border border-blue-900/50 p-3 rounded-md text-sm text-blue-200 mb-4">
               <strong>Confirm Redeployment:</strong> This will pull the latest code from the Git repository, rebuild the container, and restart the service. Service may be interrupted briefly.
           </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-zinc-400">Update Environment Variables (Optional)</label>
            <Input 
              placeholder="KEY=VALUE,KEY2=VALUE2" 
              value={redeployEnv}
              onChange={e => setRedeployEnv(e.target.value)}
            />
            <p className="text-xs text-zinc-500">Leave empty to keep existing variables.</p>
          </div>
          <div className="flex justify-end gap-2 mt-6">
            <Button type="button" variant="ghost" onClick={() => setIsRedeployOpen(false)}>Cancel</Button>
            <Button type="submit" isLoading={actionLoading}>Yes, Redeploy</Button>
          </div>
        </form>
      </Modal>

      {/* Delete Modal */}
      <Modal 
        isOpen={isDeleteOpen} 
        onClose={() => setIsDeleteOpen(false)} 
        title="Delete Application"
      >
        <div className="space-y-4 mt-4">
          <div className="bg-red-900/20 border border-red-900/50 p-4 rounded-md">
             <p className="text-sm text-red-200">
                Are you absolutely sure? This action cannot be undone. This will permanently delete 
                <span className="font-bold text-white mx-1">{app.app_name}</span> 
                and stop the running container.
             </p>
          </div>
          <div className="flex justify-end gap-2 mt-6">
            <Button variant="ghost" onClick={() => setIsDeleteOpen(false)}>Cancel</Button>
            <Button variant="danger" onClick={handleDelete} isLoading={actionLoading}>Confirm Delete</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default AppDetails;