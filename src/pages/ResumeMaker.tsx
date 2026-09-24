import React, { useRef, useState } from 'react';
import { ResumeProvider, useResume } from '../contexts/ResumeContext';
import { ResumeForm } from '../components/form/ResumeForm';
import { ResumePreview } from '../components/preview/ResumePreview';
import { Button } from '../components/ui/button';
import { Textarea } from '../components/ui/textarea';
import { useToast } from '../components/ui/use-toast';
import { importResumeFromFile } from '../utils/resumeImportExport';
import { exportResumeToPDF, exportResumeToDOCX } from '../utils/resumeExport';
import { extractResumeText } from '../utils/resumeParser';
import { ResumeData } from '../types/resume';
import { Menu, X, FileText, Palette, Settings, LayoutTemplate, Paperclip, Send, Loader2, Download, FileDown, RotateCcw, Sparkles, ChevronLeft } from 'lucide-react';
import { ThemeToggle } from '../components/ThemeToggle';

type SidePanel='content'|'customize'|'settings'|'templates';
type ChatItem={id:string;role:'user'|'assistant';text:string;attachment?:string;changes?:string[];analysis?:any;hasResume?:boolean};

const AgentWorkspace:React.FC=()=>{
  const {state,importResumeData}=useResume();
  const {toast}=useToast();
  const [sidebarOpen,setSidebarOpen]=useState(true);
  const [resumeOpen,setResumeOpen]=useState(false);
  const [resumeEditMode,setResumeEditMode]=useState(false);
  const [panel,setPanel]=useState<SidePanel>('content');
  const [prompt,setPrompt]=useState('');
  const [loading,setLoading]=useState(false);
  const [attachment,setAttachment]=useState<File|null>(null);
  const [attachmentText,setAttachmentText]=useState('');
  const [attachmentPdf,setAttachmentPdf]=useState('');
  const [history,setHistory]=useState<ResumeData[]>([]);
  const [messages,setMessages]=useState<ChatItem[]>([{id:'welcome',role:'assistant',text:'Upload your resume, paste a job description, or tell me what you want changed. I can tailor content, change templates, use a reference resume, make it one page, and export the result.'}]);
  const fileRef=useRef<HTMLInputElement>(null);
  const importRef=useRef<HTMLInputElement>(null);

  const readAttachment=async(file:File)=>{
    setAttachment(file); setAttachmentText(''); setAttachmentPdf('');
    try{
      const text=await extractResumeText(file); setAttachmentText(text.slice(0,120000));
      if(file.type==='application/pdf'||file.name.toLowerCase().endsWith('.pdf')){
        const bytes=new Uint8Array(await file.arrayBuffer()); let binary='';
        for(let i=0;i<bytes.length;i+=0x8000) binary+=String.fromCharCode(...bytes.subarray(i,i+0x8000));
        setAttachmentPdf(btoa(binary));
      }
    }catch(e){toast({title:'Attachment error',description:e instanceof Error?e.message:'Could not read file.',variant:'destructive'});}
  };
  const importResume=async(file?:File)=>{if(!file)return;try{const data=await importResumeFromFile(file,!file.name.toLowerCase().endsWith('.json'));importResumeData(data);setMessages(m=>[...m,{id:crypto.randomUUID(),role:'user',text:'Use this as my resume.',attachment:file.name},{id:crypto.randomUUID(),role:'assistant',text:'Resume loaded. Tell me what you want to change or paste a job description.',hasResume:true}]);}catch(e){toast({title:'Import failed',description:e instanceof Error?e.message:'Could not parse resume.',variant:'destructive'});}};
  const send=async()=>{
    if(!prompt.trim()||loading)return; const instruction=prompt.trim(); const att=attachment?.name;
    setMessages(m=>[...m,{id:crypto.randomUUID(),role:'user',text:instruction,attachment:att}]);setPrompt('');setLoading(true);
    try{
      const r=await fetch('/api/agent',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({resumeData:state.resumeData,instruction,referenceText:attachmentText,referencePdfBase64:attachmentPdf})});
      const result=await r.json().catch(()=>({})); if(!r.ok){ const message = r.status===429 ? 'AI providers are temporarily rate-limited. Please wait 30–60 seconds and try again.' : (result.error||`Agent failed (${r.status})`); throw new Error(message); } if(!result.resumeData)throw new Error('Agent returned no resume.');
      setHistory(h=>[...h,structuredClone(state.resumeData)]); const next=result.resumeData as ResumeData;if(next.template==='original-upload')next.template='modern-minimal';importResumeData(next);
      setMessages(m=>[...m,{id:crypto.randomUUID(),role:'assistant',text:result.message||'Resume updated.',changes:result.changes,analysis:result.analysis,hasResume:true}]);setAttachment(null);setAttachmentText('');setAttachmentPdf('');
    }catch(e){setMessages(m=>[...m,{id:crypto.randomUUID(),role:'assistant',text:e instanceof Error?e.message:'Unable to complete request.'}]);}finally{setLoading(false);}
  };
  const undo=()=>{const prev=history.at(-1);if(!prev)return;importResumeData(prev);setHistory(h=>h.slice(0,-1));};
  const pdf=async()=>{const el=document.getElementById('resume-content');if(el)await exportResumeToPDF(el,state.resumeData);};
  const docx=()=>exportResumeToDOCX(state.resumeData);
  const panelMap:any={content:'form',customize:'customize',settings:'settings',templates:'templates'};
  return <div className="h-screen w-full bg-background flex overflow-hidden">
    <aside className={`${sidebarOpen?'w-[360px]':'w-0'} shrink-0 border-r bg-card transition-all duration-200 overflow-hidden flex flex-col`}>
      <div className="h-14 px-3 flex items-center justify-between border-b"><span className="font-semibold whitespace-nowrap">Resume Studio</span><Button size="icon" variant="ghost" onClick={()=>setSidebarOpen(false)}><ChevronLeft className="w-4 h-4"/></Button></div>
      <div className="p-2 grid grid-cols-2 gap-1 border-b">
        <Button variant={panel==='content'?'secondary':'ghost'} className="justify-start" onClick={()=>setPanel('content')}><FileText className="w-4 h-4 mr-2"/>Content</Button>
        <Button variant={panel==='templates'?'secondary':'ghost'} className="justify-start" onClick={()=>setPanel('templates')}><LayoutTemplate className="w-4 h-4 mr-2"/>Templates</Button>
        <Button variant={panel==='customize'?'secondary':'ghost'} className="justify-start" onClick={()=>setPanel('customize')}><Palette className="w-4 h-4 mr-2"/>Customize</Button>
        <Button variant={panel==='settings'?'secondary':'ghost'} className="justify-start" onClick={()=>setPanel('settings')}><Settings className="w-4 h-4 mr-2"/>Settings</Button>
      </div>
      <div className="flex-1 min-h-0 overflow-auto"><ResumeForm activePanel={panelMap[panel]}/></div>
    </aside>

    <main className="flex-1 min-w-0 flex flex-col relative">
      <header className="h-14 border-b flex items-center justify-between px-3 md:px-5 bg-background/95 backdrop-blur">
        <div className="flex items-center gap-2">{!sidebarOpen&&<Button size="icon" variant="ghost" onClick={()=>setSidebarOpen(true)}><Menu className="w-5 h-5"/></Button>}{!resumeOpen&&<Button size="icon" variant="ghost" title="Open created resume" onClick={()=>setResumeOpen(true)}><FileText className="w-5 h-5"/></Button>}<Sparkles className="w-5 h-5"/><span className="font-semibold">Resume Agent</span></div>
        <div className="flex gap-1 items-center"><ThemeToggle /><Button size="sm" variant="ghost" onClick={undo} disabled={!history.length}><RotateCcw className="w-4 h-4 md:mr-2"/><span className="hidden md:inline">Undo</span></Button><Button size="sm" variant="ghost" onClick={docx}><FileDown className="w-4 h-4 md:mr-2"/><span className="hidden md:inline">DOCX</span></Button><Button size="sm" onClick={pdf}><Download className="w-4 h-4 md:mr-2"/><span className="hidden md:inline">PDF</span></Button></div>
      </header>
      <section className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto px-4 py-8 space-y-7 pb-44">
          {messages.map(msg=><div key={msg.id} className={`flex ${msg.role==='user'?'justify-end':'justify-start'}`}><div className={`${msg.role==='user'?'max-w-[85%] bg-muted rounded-3xl px-4 py-3':'w-full'} text-sm leading-6`}>
            {msg.attachment&&<div className="mb-2 inline-flex items-center gap-2 border rounded-xl px-3 py-2 bg-background"><FileText className="w-4 h-4"/><span className="max-w-[260px] truncate">{msg.attachment}</span></div>}
            <div className="whitespace-pre-wrap">{msg.text}</div>
            {msg.changes?.length?<ul className="mt-3 list-disc pl-5 text-muted-foreground">{msg.changes.map((x,i)=><li key={i}>{x}</li>)}</ul>:null}
            {msg.analysis?.gaps?.length?<div className="mt-3 text-muted-foreground"><b className="text-foreground">Gaps:</b> {msg.analysis.gaps.join(', ')}</div>:null}
            {msg.hasResume&&<div className="mt-4 border rounded-2xl bg-muted/30 p-3 flex items-center justify-between gap-3"><div><div className="font-medium">Created resume</div><div className="text-xs text-muted-foreground">Open the live version in the right sidebar. Small edits are local and do not call the AI.</div></div><Button size="sm" onClick={()=>{setResumeOpen(true);setResumeEditMode(false)}}>Open resume</Button></div>}
          </div></div>)}
          {loading&&<div className="flex items-center gap-3 text-sm text-muted-foreground"><Loader2 className="w-4 h-4 animate-spin"/>Working on your resume…</div>}
        </div>
      </section>
      <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-background via-background/95 to-transparent pt-6 pb-3 px-3">
        <div className="max-w-3xl mx-auto border rounded-[26px] bg-card shadow-md p-1.5">
          {attachment&&<div className="mx-2 mt-1 mb-2 inline-flex items-center gap-2 bg-muted rounded-xl px-3 py-2 text-xs"><FileText className="w-4 h-4"/><span className="max-w-[260px] truncate">{attachment.name}</span><button onClick={()=>{setAttachment(null);setAttachmentText('');setAttachmentPdf('')}}><X className="w-3.5 h-3.5"/></button></div>}
          <Textarea value={prompt} onChange={e=>setPrompt(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();send();}}} placeholder="Message Resume Agent… paste a JD or ask for any resume change" className="border-0 shadow-none focus-visible:ring-0 min-h-[44px] h-[44px] max-h-28 resize-none py-2.5 px-3 text-[15px] leading-5"/>
          <div className="flex justify-between items-center px-1 pb-0.5"><div className="flex gap-1"><Button size="icon" variant="ghost" onClick={()=>fileRef.current?.click()} title="Attach reference"><Paperclip className="w-4 h-4"/></Button><Button size="sm" variant="ghost" onClick={()=>importRef.current?.click()}>Upload resume</Button></div><Button size="icon" className="rounded-full" disabled={!prompt.trim()||loading} onClick={send}>{loading?<Loader2 className="w-4 h-4 animate-spin"/>:<Send className="w-4 h-4"/>}</Button></div>
        </div>
      </div>
      {resumeOpen&&<aside className="resume-artifact-sidebar w-[min(560px,42vw)] min-w-[380px] shrink-0 border-l bg-card flex flex-col shadow-xl z-20">
        <div className="h-14 px-3 border-b flex items-center justify-between">
          <div className="flex items-center gap-2"><FileText className="w-4 h-4"/><span className="font-semibold">Created resume</span></div>
          <div className="flex items-center gap-1">
            <Button size="sm" variant={resumeEditMode?'secondary':'ghost'} onClick={()=>setResumeEditMode(v=>!v)}>{resumeEditMode?'Preview':'Edit'}</Button>
            <Button size="icon" variant="ghost" title="Collapse resume" onClick={()=>setResumeOpen(false)}><ChevronLeft className="w-4 h-4"/></Button>
          </div>
        </div>
        <div className="flex-1 min-h-0 overflow-auto">
          {resumeEditMode ? <div className="p-3"><ResumeForm activePanel="form"/></div> : <div className="p-3"><div className="resume-artifact-paper"><ResumePreview artifact/></div></div>}
        </div>
      </aside>}
      <input ref={fileRef} className="hidden" type="file" accept=".pdf,.docx,.txt" onChange={e=>{const f=e.target.files?.[0];if(f)readAttachment(f);e.currentTarget.value='';}}/>
      <input ref={importRef} className="hidden" type="file" accept=".pdf,.docx,.txt,.json" onChange={e=>{importResume(e.target.files?.[0]);e.currentTarget.value='';}}/>
    </main>
  </div>;
};
export const ResumeMaker:React.FC=()=> <ResumeProvider><AgentWorkspace/></ResumeProvider>;
