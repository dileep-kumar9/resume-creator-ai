import React, { useEffect, useRef, useState } from 'react';
import { ResumeProvider, useResume } from '../contexts/ResumeContext';
import { ResumeForm } from '../components/form/ResumeForm';
import { ResumePreview } from '../components/preview/ResumePreview';
import { Button } from '../components/ui/button';
import { Textarea } from '../components/ui/textarea';
import { useToast } from '../components/ui/use-toast';
import { importResumeFromFile } from '../utils/resumeImportExport';
import { exportResumeToPDF, exportResumeToDOCX } from '../utils/resumeExport';
import { extractResumeText, normalizeParsedResume } from '../utils/resumeParser';
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
  const [artifactWidth,setArtifactWidth]=useState(560);
  const [panel,setPanel]=useState<SidePanel>('content');
  const [prompt,setPrompt]=useState('');
  const [loading,setLoading]=useState(false);
  const [attachment,setAttachment]=useState<File|null>(null);
  const [attachmentKind,setAttachmentKind]=useState<'resume'|'reference'|null>(null);
  const [attachmentText,setAttachmentText]=useState('');
  const [attachmentPdf,setAttachmentPdf]=useState('');
  const [history,setHistory]=useState<ResumeData[]>([]);
  const [messages,setMessages]=useState<ChatItem[]>([{id:'welcome',role:'assistant',text:'Upload your resume, paste a job description, or tell me what you want changed. I can tailor content, change templates, use a reference resume, make it one page, and export the result.'}]);
  const fileRef=useRef<HTMLInputElement>(null);
  const importRef=useRef<HTMLInputElement>(null);
  const chatScrollRef=useRef<HTMLDivElement>(null);

  // ChatGPT-style behavior: every new user/assistant message and the loading
  // state keeps the conversation viewport at the newest content. The user can
  // still scroll manually after the update.
  useEffect(()=>{
    const el=chatScrollRef.current;
    if(!el)return;
    requestAnimationFrame(()=>{
      el.scrollTo({top:el.scrollHeight,behavior:'smooth'});
    });
  },[messages.length,loading]);

  const clearAttachment=()=>{
    setAttachment(null);
    setAttachmentKind(null);
    setAttachmentText('');
    setAttachmentPdf('');
  };

  // Uploading a file only attaches it to the composer. It must never change the
  // resume, template, or artifact until the user explicitly presses Send.
  const readAttachment=async(file:File, kind:'resume'|'reference'='reference')=>{
    setAttachment(file); setAttachmentKind(kind); setAttachmentText(''); setAttachmentPdf('');
    try{
      const text=await extractResumeText(file); setAttachmentText(text.slice(0,120000));
      if(file.type==='application/pdf'||file.name.toLowerCase().endsWith('.pdf')){
        const bytes=new Uint8Array(await file.arrayBuffer()); let binary='';
        for(let i=0;i<bytes.length;i+=0x8000) binary+=String.fromCharCode(...bytes.subarray(i,i+0x8000));
        setAttachmentPdf(btoa(binary));
      }
    }catch(e){
      clearAttachment();
      toast({title:'Attachment error',description:e instanceof Error?e.message:'Could not read file.',variant:'destructive'});
    }
  };

  const send=async()=>{
    const hasAttachment=Boolean(attachment);
    if((!prompt.trim()&&!hasAttachment)||loading)return;

    const instruction=prompt.trim() || (attachmentKind==='resume' ? 'Use this uploaded file as my resume.' : 'Analyze the attached reference document and help me improve my resume.');
    const att=attachment?.name;
    setMessages(m=>[...m,{id:crypto.randomUUID(),role:'user',text:instruction,attachment:att}]);
    setPrompt(''); setLoading(true);

    try{
      // A resume upload is parsed only after Send. This prevents sidebar/tab
      // changes and file selection from mutating the live resume automatically.
      let workingResume=state.resumeData;
      if(attachment && attachmentKind==='resume'){
        workingResume=await importResumeFromFile(attachment,!attachment.name.toLowerCase().endsWith('.json'));
        importResumeData(workingResume);
        setResumeOpen(true);
        setResumeEditMode(false);

        // If the user only uploaded a resume and did not ask for an AI change,
        // stop here. The explicit Send action is the import/parse confirmation.
        if(!prompt.trim()){
          setMessages(m=>[...m,{id:crypto.randomUUID(),role:'assistant',text:'Resume loaded. Your uploaded content is now in the editor. Tell me what you want to change or paste a job description.',hasResume:true}]);
          clearAttachment();
          return;
        }
      }

      const referenceTextForAgent=attachmentKind==='reference' ? attachmentText : '';
      const referencePdfForAgent=attachmentKind==='reference' ? attachmentPdf : '';
      const r=await fetch('/api/agent',{
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body:JSON.stringify({resumeData:workingResume,instruction,referenceText:referenceTextForAgent,referencePdfBase64:referencePdfForAgent})
      });
      const result=await r.json().catch(()=>({}));
      if(!r.ok){
        const message=r.status===429
          ? 'AI providers are temporarily rate-limited. Please wait 30–60 seconds and try again.'
          : (result.error||`Agent failed (${r.status})`);
        throw new Error(message);
      }
      if(!result.resumeData)throw new Error('Agent returned no resume.');

      setHistory(h=>[...h,structuredClone(workingResume)]);
      const next = normalizeParsedResume(result.resumeData as ResumeData, workingResume);

      // The AI agent is never allowed to choose a template. The template used
      // for this request is the user's current selection and remains unchanged.
      next.template = workingResume.template;
      if (workingResume.originalTemplate) {
        next.originalTemplate = {
          ...workingResume.originalTemplate,
          tailored: true,
          editableTemplate:
            workingResume.originalTemplate.editableTemplate || 'modern-minimal'
        };
      }
      importResumeData(next);
      setResumeOpen(true);
      setResumeEditMode(false);
      setMessages(m=>[...m,{id:crypto.randomUUID(),role:'assistant',text:result.message||'Resume updated.',changes:result.changes,analysis:result.analysis,hasResume:true}]);
      clearAttachment();
    }catch(e){
      setMessages(m=>[...m,{id:crypto.randomUUID(),role:'assistant',text:e instanceof Error?e.message:'Unable to complete request.'}]);
    }finally{setLoading(false);}
  };

  const undo=()=>{
    const prev=history.at(-1);
    if(!prev)return;
    importResumeData(prev);
    setHistory(h=>h.slice(0,-1));
  };

  const pdf=async()=>{
    const el=document.getElementById('resume-content');
    if(!el){
      setResumeOpen(true);
      setResumeEditMode(false);
      toast({title:'Open resume preview first',description:'The Created Resume artifact has been opened. Try PDF again after the preview appears.',variant:'destructive'});
      return;
    }
    await exportResumeToPDF(el,state.resumeData);
  };

  const docx=()=>exportResumeToDOCX(state.resumeData);
  const panelMap:any={content:'form',customize:'customize',settings:'settings',templates:'templates'};
  const resizeState=useRef<{startX:number;startWidth:number;pointerId:number}|null>(null);
  const startArtifactResize=(e:React.PointerEvent<HTMLDivElement>)=>{
    if(!resumeOpen)return;
    e.preventDefault();
    e.stopPropagation();
    resizeState.current={startX:e.clientX,startWidth:artifactWidth,pointerId:e.pointerId};
    try{e.currentTarget.setPointerCapture(e.pointerId);}catch{}
    document.body.style.cursor='col-resize';
    document.body.style.userSelect='none';
  };
  const moveArtifactResize=(e:React.PointerEvent<HTMLDivElement>)=>{
    const s=resizeState.current;
    if(!s)return;
    e.preventDefault();
    const next=s.startWidth-(e.clientX-s.startX);
    const min=420;
    const max=Math.max(min,Math.min(900,window.innerWidth-360));
    setArtifactWidth(Math.max(min,Math.min(max,next)));
  };
  const endArtifactResize=(e?:React.PointerEvent<HTMLDivElement>)=>{
    if(!resizeState.current)return;
    if(e)try{e.currentTarget.releasePointerCapture(e.pointerId);}catch{}
    resizeState.current=null;
    document.body.style.cursor='';
    document.body.style.userSelect='';
  };

  const navItems:[
    SidePanel,string,React.ComponentType<{className?:string}>
  ][]=[
    ['content','Content',FileText],
    ['templates','Templates',LayoutTemplate],
    ['customize','Customize',Palette],
    ['settings','Settings',Settings],
  ];

  return <div className={`resume-studio-app ${sidebarOpen?'sidebar-expanded':'sidebar-collapsed'} ${resumeOpen?'artifact-open':'artifact-closed'}`}>
    <aside className="resume-studio-sidebar">
      <div className="resume-studio-brand">
        <span className="resume-studio-brand-full">Resume Studio</span>
        <span className="resume-studio-brand-mini">RS</span>
        <Button size="icon" variant="ghost" className="resume-studio-collapse" onClick={()=>setSidebarOpen(v=>!v)} aria-label={sidebarOpen?'Collapse sidebar':'Expand sidebar'}>
          {sidebarOpen?<ChevronLeft className="w-4 h-4"/>:<Menu className="w-4 h-4"/>}
        </Button>
      </div>

      <nav className="resume-studio-nav" aria-label="Resume workspace">
        {navItems.map(([id,label,Icon])=><Button
          key={id}
          variant={panel===id?'secondary':'ghost'}
          className="resume-studio-nav-item"
          onClick={()=>{setPanel(id); if(!sidebarOpen)setSidebarOpen(true);}}
          title={label}
          aria-label={label}
        >
          <Icon className="w-5 h-5 shrink-0"/>
          <span className="resume-studio-nav-label">{label}</span>
        </Button>)}
      </nav>

      <div className="resume-studio-panel">
        <ResumeForm activePanel={panelMap[panel]}/>
      </div>
    </aside>

    <main className="resume-studio-main">
      <header className="resume-studio-header">
        <div className="flex items-center gap-2 min-w-0">
          <Sparkles className="w-5 h-5 shrink-0"/>
          <span className="font-semibold truncate">Resume Agent</span>
          <span className="resume-studio-header-subtitle">AI Resume Workspace</span>
        </div>
        <div className="flex gap-1 items-center">
          <ThemeToggle compact={true}/>
          <Button size="sm" variant="ghost" onClick={undo} disabled={!history.length} title="Undo last AI change">
            <RotateCcw className="w-4 h-4 md:mr-2"/><span className="hidden md:inline">Undo</span>
          </Button>
          <Button size="sm" variant="ghost" onClick={docx} title="Export DOCX">
            <FileDown className="w-4 h-4 md:mr-2"/><span className="hidden md:inline">DOCX</span>
          </Button>
          <Button size="sm" onClick={pdf} title="Export PDF">
            <Download className="w-4 h-4 md:mr-2"/><span className="hidden md:inline">PDF</span>
          </Button>
        </div>
      </header>

      <div className="resume-studio-workspace">
        <section className="resume-chat-column">
          <div ref={chatScrollRef} className="resume-chat-scroll">
            <div className="resume-chat-content">
              {messages.map(msg=><div key={msg.id} className={`resume-chat-row ${msg.role==='user'?'user':'assistant'}`}>
                <div className={`resume-chat-message ${msg.role==='user'?'user-message':'assistant-message'}`}>
                  {msg.attachment&&<div className="mb-2 inline-flex items-center gap-2 border rounded-xl px-3 py-2 bg-background"><FileText className="w-4 h-4"/><span className="max-w-[260px] truncate">{msg.attachment}</span></div>}
                  <div className="whitespace-pre-wrap">{msg.text}</div>
                  {msg.changes?.length?<ul className="mt-3 list-disc pl-5 text-muted-foreground">{msg.changes.map((x,i)=><li key={i}>{x}</li>)}</ul>:null}
                  {msg.analysis?.gaps?.length?<div className="mt-3 text-muted-foreground"><b className="text-foreground">Gaps:</b> {msg.analysis.gaps.join(', ')}</div>:null}
                  {msg.hasResume&&<div className="resume-chat-artifact-link">
                    <div className="min-w-0"><div className="font-medium">Created resume</div><div className="text-xs text-muted-foreground">Open the live artifact on the right. Edits in the artifact are local.</div></div>
                    <Button size="sm" onClick={()=>{setResumeOpen(true);setResumeEditMode(false)}}>Open</Button>
                  </div>}
                </div>
              </div>)}
              {loading&&<div className="resume-chat-loading"><Loader2 className="w-4 h-4 animate-spin"/>Working on your resume…</div>}
            </div>
          </div>

          <div className="resume-chat-composer-wrap">
            <div className="resume-chat-composer">
              {attachment&&<div className="resume-chat-attachment"><FileText className="w-4 h-4"/><span>{attachment.name}</span><button type="button" onClick={()=>{setAttachment(null);setAttachmentText('');setAttachmentPdf('')}} aria-label="Remove attachment"><X className="w-3.5 h-3.5"/></button></div>}
              <Textarea
                rows={1}
                value={prompt}
                onChange={e=>setPrompt(e.target.value)}
                onKeyDown={e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();send();}}}
                placeholder="Message Resume Agent… paste a JD or ask for any resume change"
                aria-label="Message Resume Agent"
                className="resume-chat-input"
              />
              <div className="resume-chat-composer-actions">
                <div className="flex gap-1 items-center">
                  <Button size="icon" variant="ghost" onClick={()=>fileRef.current?.click()} title="Attach reference document" aria-label="Attach reference"><Paperclip className="w-4 h-4"/></Button>
                  <Button size="sm" variant="ghost" onClick={()=>importRef.current?.click()}>Upload resume</Button>
                </div>
                <Button size="icon" className="rounded-full resume-send-button" disabled={(!prompt.trim()&&!attachment)||loading} onClick={send} title="Send" aria-label="Send message">
                  {loading?<Loader2 className="w-4 h-4 animate-spin"/>:<Send className="w-4 h-4"/>}
                </Button>
              </div>
            </div>
          </div>
        </section>

        {resumeOpen&&<aside className="resume-artifact-panel" style={{width:artifactWidth,flexBasis:artifactWidth}} aria-label="Created resume artifact">
          <div className="resume-artifact-resize-handle" onPointerDown={startArtifactResize} onPointerMove={moveArtifactResize} onPointerUp={endArtifactResize} onPointerCancel={endArtifactResize} title="Drag to resize created resume" role="separator" aria-orientation="vertical" aria-label="Resize created resume">
            <span />
          </div>
          <div className="resume-artifact-header">
            <div className="min-w-0">
              <div className="flex items-center gap-2"><FileText className="w-4 h-4 shrink-0"/><span className="font-semibold truncate">Created resume</span></div>
              <div className="text-[11px] text-muted-foreground mt-0.5">
                {state.resumeData.template==='original-upload'
                  ? `Original uploaded file preserved · tailored content uses ${state.resumeData.originalTemplate?.editableTemplate || 'modern-minimal'} layout`
                  : 'Editable template selected by you'}
              </div>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <Button
                size="icon"
                variant="ghost"
                title="Close artifact"
                aria-label="Close artifact"
                onClick={()=>setResumeOpen(false)}
              >
                <X className="w-4 h-4"/>
              </Button>
            </div>
          </div>

          <div className="resume-artifact-toolbar">
            <span className="text-xs text-muted-foreground">Live artifact</span>
            <div className="flex gap-1">
              <Button size="sm" variant="ghost" onClick={()=>setResumeEditMode(false)}>Preview</Button>
              <Button size="sm" variant={resumeEditMode?'secondary':'ghost'} onClick={()=>{
                if (state.resumeData.template==='original-upload' && state.resumeData.originalTemplate && !state.resumeData.originalTemplate.tailored) {
                  importResumeData({
                    ...state.resumeData,
                    originalTemplate: {
                      ...state.resumeData.originalTemplate,
                      tailored: true,
                      editableTemplate: state.resumeData.originalTemplate.editableTemplate || 'modern-minimal'
                    }
                  });
                }
                setResumeEditMode(true);
              }}>Edit</Button>
            </div>
          </div>

          <div className="resume-artifact-body">
            {resumeEditMode
              ? <div className="resume-artifact-editor"><ResumeForm activePanel="form"/></div>
              : <div className="resume-artifact-preview"><ResumePreview artifact/></div>}
          </div>
        </aside>}
      </div>

      <input ref={fileRef} className="hidden" type="file" accept=".pdf,.docx,.txt" onChange={e=>{const f=e.target.files?.[0];if(f)readAttachment(f,'reference');e.currentTarget.value='';}}/>
      <input ref={importRef} className="hidden" type="file" accept=".pdf,.docx,.txt,.json" onChange={e=>{const f=e.target.files?.[0];if(f)readAttachment(f,'resume');e.currentTarget.value='';}}/>
    </main>
  </div>;
};
export const ResumeMaker:React.FC=()=> <ResumeProvider><AgentWorkspace/></ResumeProvider>;
