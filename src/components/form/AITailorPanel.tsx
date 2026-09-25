import React, { useRef, useState } from 'react';
import { FileText, Loader2, Paperclip, RotateCcw, ShieldCheck, Sparkles, Wand2, X } from 'lucide-react';
import { Textarea } from '../ui/textarea';
import { Button } from '../ui/button';
import { Alert, AlertDescription, AlertTitle } from '../ui/alert';
import { Badge } from '../ui/badge';
import { useResume } from '../../contexts/ResumeContext';
import { ResumeData } from '../../types/resume';
import { extractResumeText } from '../../utils/resumeParser';

const examples = [
  'Tailor my resume to this job description. Keep everything factual and ATS-friendly.',
  'Make this resume one page and more compact without removing important information.',
  'Change the template to a clean professional design and keep all my content unchanged.',
  'Use the attached resume as a visual reference and make my resume look similar without copying its content.',
  'Rewrite my summary and project bullets to emphasize Python, SQL, APIs and data processing for this role.'
];

type Analysis = { summary?: string; strengths?: string[]; gaps?: string[]; matchedKeywords?: string[]; missingKeywords?: string[]; recommendations?: string[] };
type ChatTurn = { role: 'user' | 'assistant'; content: string; at: string };
const CHAT_KEY = 'resume-studio-agent-conversation-v1';
const VERSIONS_KEY = 'resume-studio-agent-versions-v1';
const loadVersions = (): Array<{ label: string; at: string; resume: ResumeData }> => { try { const v = JSON.parse(localStorage.getItem(VERSIONS_KEY) || '[]'); return Array.isArray(v) ? v.slice(-20) : []; } catch { return []; } };
const loadChat = (): ChatTurn[] => { try { const v = JSON.parse(localStorage.getItem(CHAT_KEY) || '[]'); return Array.isArray(v) ? v.slice(-30) : []; } catch { return []; } };

export const AITailorPanel: React.FC = () => {
  const { state, importResumeData } = useResume();
  const [instruction, setInstruction] = useState('');
  const [reference, setReference] = useState<File | null>(null);
  const [referenceText, setReferenceText] = useState('');
  const [referencePdfBase64, setReferencePdfBase64] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [changes, setChanges] = useState<string[]>([]);
  const [message, setMessage] = useState('');
  const [previousResume, setPreviousResume] = useState<ResumeData | null>(null);
  const [conversation, setConversation] = useState<ChatTurn[]>(loadChat);
  const [versions, setVersions] = useState<Array<{ label: string; at: string; resume: ResumeData }>>(loadVersions);
  React.useEffect(() => { try { localStorage.setItem(CHAT_KEY, JSON.stringify(conversation.slice(-30))); } catch {} }, [conversation]);
  React.useEffect(() => { try { localStorage.setItem(VERSIONS_KEY, JSON.stringify(versions.slice(-20))); } catch {} }, [versions]);
  const referenceInput = useRef<HTMLInputElement>(null);

  const addReference = async (file?: File) => {
    if (!file) return;
    setError('');
    try {
      setReference(file);
      const text = await extractResumeText(file);
      setReferenceText(text.slice(0, 120000));
      if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) {
        const bytes = new Uint8Array(await file.arrayBuffer());
        let binary = '';
        const chunk = 0x8000;
        for (let i = 0; i < bytes.length; i += chunk) binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
        setReferencePdfBase64(btoa(binary));
      } else setReferencePdfBase64('');
    } catch (e) {
      setReference(null); setReferenceText(''); setReferencePdfBase64('');
      setError(e instanceof Error ? e.message : 'Could not read the reference file.');
    }
  };

  const runAgent = async () => {
    if (!instruction.trim() || loading) return;
    setLoading(true); setError(''); setMessage(''); setAnalysis(null); setChanges([]);
    try {
      const response = await fetch('/api/agent', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resumeData: state.resumeData, instruction: instruction.trim(), referenceText, referencePdfBase64, conversation: conversation.slice(-12).map(({role,content}) => ({role,content})) })
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(response.status === 429 ? 'AI providers are temporarily rate-limited. Please wait 30–60 seconds and try again.' : (result.error || `Resume Agent failed (${response.status})`));
      if (!result.resumeData) throw new Error('The Resume Agent returned an invalid resume result.');
      setPreviousResume(structuredClone(state.resumeData));
      setVersions(prev => [...prev.slice(-19), { label: instruction.trim().slice(0, 90), at: new Date().toISOString(), resume: structuredClone(state.resumeData) }]);
      const next = structuredClone(result.resumeData as ResumeData);
      // The user's selected template is authoritative. AI tailoring changes
      // resume content only and must never silently switch the template.
      next.template = state.resumeData.template;
      if (state.resumeData.originalTemplate) {
        next.originalTemplate = structuredClone(state.resumeData.originalTemplate);
        next.originalTemplate.tailored = true;
      }
      importResumeData(next);
      setAnalysis(result.analysis || null);
      setChanges(Array.isArray(result.changes) ? result.changes : []);
      setMessage(result.message || 'The resume has been updated.');
      setConversation(prev => [...prev, { role: 'user' as const, content: instruction.trim(), at: new Date().toISOString() }, { role: 'assistant' as const, content: result.message || 'Resume updated.', at: new Date().toISOString() }].slice(-30));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to complete the request.');
    } finally { setLoading(false); }
  };

  const undo = () => { if (previousResume) { importResumeData(previousResume); setPreviousResume(null); setMessage('Reverted the last Resume Agent change.'); } };
  const restoreVersion = (version: { label: string; at: string; resume: ResumeData }) => { setPreviousResume(structuredClone(state.resumeData)); importResumeData(structuredClone(version.resume)); setMessage(`Restored version: ${version.label}`); };
  const clearConversation = () => { setConversation([]); try { localStorage.removeItem(CHAT_KEY); } catch {} setMessage('Conversation history cleared.'); };

  return (
    <div className="p-6 space-y-5 overflow-y-auto h-full">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center"><Sparkles className="w-5 h-5 text-primary" /></div>
        <div><h2 className="text-lg font-semibold">Resume Agent</h2><p className="text-xs text-muted-foreground">Tell it what you want, like ChatGPT or Gemini.</p></div>
      </div>

      <Alert className="bg-primary/5 border-primary/20">
        <ShieldCheck className="h-4 w-4" />
        <AlertTitle>Factual protection is always on</AlertTitle>
        <AlertDescription className="text-xs leading-relaxed">The agent can rewrite and redesign your resume, but it must preserve your real employers, dates, education, projects, technologies, URLs and other unsupported facts.</AlertDescription>
      </Alert>

      <div>
        <label className="text-sm font-medium mb-2 block">What should I do with your resume?</label>
        <Textarea value={instruction} onChange={e => { setInstruction(e.target.value); setError(''); }} placeholder="Example: Tailor my resume to the following job description and make it one page. Emphasize Python and SQL only where my experience supports them..." className="min-h-[220px] resize-none text-sm leading-relaxed" />
      </div>

      <div className="space-y-2">
        <p className="text-xs font-medium text-muted-foreground">Try an example</p>
        <div className="flex flex-wrap gap-2">{examples.map((x,i)=><button key={i} type="button" onClick={()=>setInstruction(x)} className="text-left text-xs rounded-full border px-3 py-1.5 hover:bg-muted transition-colors">{x}</button>)}</div>
      </div>

      <div className="rounded-lg border p-3 space-y-2">
        <div className="flex items-center justify-between"><div><p className="text-sm font-medium">Reference (optional)</p><p className="text-xs text-muted-foreground">Upload a resume/PDF/DOCX and say “make mine like this”.</p></div><Button type="button" size="sm" variant="outline" onClick={()=>referenceInput.current?.click()}><Paperclip className="w-4 h-4 mr-2"/>Add reference</Button></div>
        <input ref={referenceInput} type="file" accept=".pdf,.docx,.txt" className="hidden" onChange={e=>addReference(e.target.files?.[0])}/>
        {reference && <div className="flex items-center gap-2 text-xs rounded-md bg-muted p-2"><FileText className="w-4 h-4"/><span className="truncate flex-1">{reference.name}</span><button type="button" onClick={()=>{setReference(null);setReferenceText('');setReferencePdfBase64('')}}><X className="w-4 h-4"/></button></div>}
      </div>

      <Button onClick={runAgent} disabled={!instruction.trim() || loading} className="w-full gap-2">
        {loading ? <Loader2 className="w-4 h-4 animate-spin"/> : <Wand2 className="w-4 h-4"/>}
        {loading ? 'Working on your resume…' : 'Ask Resume Agent'}
      </Button>

      {error && <Alert variant="destructive"><AlertDescription className="text-sm">{error}</AlertDescription></Alert>}

      {message && <Alert className="border-green-500/30 bg-green-500/5"><AlertTitle>Done</AlertTitle><AlertDescription className="text-sm">{message}</AlertDescription></Alert>}

      {changes.length > 0 && <div className="rounded-lg border bg-card p-4"><p className="text-sm font-semibold mb-2">Changes made</p><ul className="text-sm list-disc pl-5 space-y-1">{changes.map((x,i)=><li key={i}>{x}</li>)}</ul></div>}

      {analysis && <div className="rounded-lg border bg-card p-4 space-y-3">
        <p className="text-sm font-semibold">Analysis</p>
        {analysis.summary && <p className="text-sm text-muted-foreground">{analysis.summary}</p>}
        {analysis.strengths?.length ? <div><p className="text-xs font-semibold uppercase tracking-wide mb-1">Strengths</p><ul className="text-sm list-disc pl-5">{analysis.strengths.map((x,i)=><li key={i}>{x}</li>)}</ul></div>:null}
        {analysis.gaps?.length ? <div><p className="text-xs font-semibold uppercase tracking-wide mb-1">Gaps</p><ul className="text-sm list-disc pl-5">{analysis.gaps.map((x,i)=><li key={i}>{x}</li>)}</ul></div>:null}
        {(analysis.matchedKeywords||[]).length>0 && <div className="flex flex-wrap gap-1.5">{analysis.matchedKeywords!.map(x=><Badge key={x} variant="secondary">{x}</Badge>)}</div>}
      </div>}

      {previousResume && <Button variant="outline" onClick={undo} className="w-full gap-2"><RotateCcw className="w-4 h-4"/> Undo last change</Button>}
      {versions.length > 0 && <div className="rounded-lg border p-3 space-y-2"><div className="flex items-center justify-between"><p className="text-sm font-semibold">Resume versions</p><Button variant="ghost" size="sm" onClick={clearConversation}>Clear chat</Button></div>{versions.slice().reverse().map((v,i)=><div key={`${v.at}-${i}`} className="flex items-center gap-2 text-xs"><span className="flex-1 truncate">{new Date(v.at).toLocaleString()} · {v.label}</span><Button size="sm" variant="outline" onClick={()=>restoreVersion(v)}>Restore</Button></div>)}</div>}
    </div>
  );
};
