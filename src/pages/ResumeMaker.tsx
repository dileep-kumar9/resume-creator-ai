import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
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
  const [artifactWidth,setArtifactWidth]=useState(()=>Math.min(760, Math.max(360, Math.floor(window.innerWidth * 0.42))));
  const [sidebarWidth,setSidebarWidth]=useState(320);
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
  const chatInputRef=useRef<HTMLTextAreaElement>(null);

  // ChatGPT-style behavior: every new user/assistant message and the loading
  // state keeps the conversation viewport at the newest content. The user can
  // still scroll manually after the update.
  const chatWasNearBottomRef=useRef(true);
  const chatScrollMetricsRef=useRef<{scrollHeight:number;scrollTop:number;clientHeight:number}|null>(null);

  const scrollChatToBottom=(behavior:'auto'|'smooth'='auto')=>{
    const el=chatScrollRef.current;
    if(!el)return;
    el.scrollTo({top:Math.max(0,el.scrollHeight-el.clientHeight),behavior});
  };

  useEffect(()=>{
    const el=chatScrollRef.current;
    if(!el)return;
    requestAnimationFrame(()=>{
      scrollChatToBottom('smooth');
    });
  },[messages.length,loading]);

  // Resizing the artifact changes the width of the chat column, which can
  // reflow long messages and change their height. Keep the conversation
  // anchored to the same place (normally the bottom, like ChatGPT) instead
  // of making already-visible text jump out of view.
  useEffect(()=>{
    const el=chatScrollRef.current;
    if(!el)return;
    requestAnimationFrame(()=>{
      if(chatWasNearBottomRef.current) {
        scrollChatToBottom('auto');
      } else if(chatScrollMetricsRef.current) {
        const before=chatScrollMetricsRef.current;
        const oldMax=Math.max(1,before.scrollHeight-before.clientHeight);
        const ratio=Math.max(0,Math.min(1,before.scrollTop/oldMax));
        const nextMax=Math.max(0,el.scrollHeight-el.clientHeight);
        el.scrollTop=nextMax*ratio;
      }
    });
  },[artifactWidth,sidebarWidth]);

  // If the browser/sidebar changes while the artifact is open, keep its width
  // inside the same bounds used by the drag handler so the center conversation
  // never becomes clipped.
  useEffect(()=>{
    const clampArtifact=()=>{
      if(!resumeOpen)return;
      const main=document.querySelector('.resume-studio-main') as HTMLElement | null;
      const mainWidth=main?.clientWidth || window.innerWidth;
      const max=Math.max(0, mainWidth-360);
      setArtifactWidth(w=>Math.min(w,max));
    };
    clampArtifact();
    window.addEventListener('resize',clampArtifact);
    return()=>window.removeEventListener('resize',clampArtifact);
  },[sidebarWidth,resumeOpen]);

  const rememberChatScrollPosition=()=>{
    const el=chatScrollRef.current;
    if(!el)return;
    const distanceFromBottom=el.scrollHeight-el.clientHeight-el.scrollTop;
    chatWasNearBottomRef.current=distanceFromBottom<80;
    chatScrollMetricsRef.current={
      scrollHeight:el.scrollHeight,
      scrollTop:el.scrollTop,
      clientHeight:el.clientHeight
    };
  };

  const resizeChatInput=()=>{
    const el=chatInputRef.current;
    if(!el)return;
    el.style.height='auto';
    // Keep the action row (attachment/send) permanently visible. The old
    // textarea could grow almost as tall as the composer itself and push the
    // action row below the clipped bottom edge.
    const maxHeight=Math.max(160, Math.min(520, Math.floor(window.innerHeight * 0.56)));
    const next=Math.min(Math.max(el.scrollHeight,34),maxHeight);
    el.style.height=`${next}px`;
    el.style.overflowY=el.scrollHeight>maxHeight?'auto':'hidden';
  };

  useLayoutEffect(()=>{
    resizeChatInput();
  },[prompt]);

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
    setPrompt('');
    requestAnimationFrame(()=>{ if(chatInputRef.current){ chatInputRef.current.style.height='34px'; chatInputRef.current.style.overflowY='hidden'; }});
    setLoading(true);

    try{
      // A resume upload is parsed only after Send. This prevents sidebar/tab
      // changes and file selection from mutating the live resume automatically.
      let workingResume=state.resumeData;
      if(attachment && attachmentKind==='resume'){
        workingResume=await importResumeFromFile(attachment,!attachment.name.toLowerCase().endsWith('.json'));
        importResumeData(workingResume);
        openArtifact();

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

      // HARD RULE: the uploaded document is immutable metadata. AI responses
      // are never allowed to replace the selected template or the original
      // uploaded file. Template changes happen only through TemplateSelector.
      if (workingResume.originalTemplate) {
        next.template = 'original-upload';
        next.originalTemplate = structuredClone(workingResume.originalTemplate);
        next.originalTemplate.tailored = true;
      } else {
        next.template = workingResume.template;
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

  const openArtifact=()=>{
    setArtifactWidth(w=>w>24?w:Math.min(760, Math.max(360, Math.floor(window.innerWidth*0.42))));
    setResumeOpen(true);
    setResumeEditMode(false);
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
      openArtifact();
      toast({title:'Open resume preview first',description:'The Created Resume artifact has been opened. Try PDF again after the preview appears.',variant:'destructive'});
      return;
    }
    await exportResumeToPDF(el,state.resumeData);
  };

  const docx=()=>exportResumeToDOCX(state.resumeData);
  const panelMap:any={content:'form',customize:'customize',settings:'settings',templates:'templates'};
  const resizeState=useRef<{startX:number;startWidth:number;pointerId:number;kind:'artifact'|'sidebar'}|null>(null);
  const startResize=(kind:'artifact'|'sidebar')=>(e:React.PointerEvent<HTMLDivElement>)=>{
    e.preventDefault();
    e.stopPropagation();
    const startWidth=kind==='artifact'?artifactWidth:sidebarWidth;
    resizeState.current={startX:e.clientX,startWidth,pointerId:e.pointerId,kind};
    try{e.currentTarget.setPointerCapture(e.pointerId);}catch{}
    document.body.style.cursor='col-resize';
    document.body.style.userSelect='none';
  };
  const moveResize=(e:React.PointerEvent<HTMLDivElement>)=>{
    const s=resizeState.current;
    if(!s)return;
    e.preventDefault();
    if(s.kind==='artifact'){
      const next=s.startWidth-(e.clientX-s.startX);
      // GPT-style artifact: the panel has no artificial 600px floor. It can
      // be dragged very narrow, with the center workspace taking the released space.
      const main = document.querySelector('.resume-studio-main') as HTMLElement | null;
      const mainWidth = main?.clientWidth || window.innerWidth;
      // Keep a real center conversation column visible while allowing the
      // artifact itself to become arbitrarily narrow/closed. The old global
      // window-width cap could consume the entire center pane and clip chat.
      const minimumChatWidth = 360;
      const max = Math.max(0, mainWidth - minimumChatWidth);
      const clamped=Math.max(0,Math.min(max,next));
      // ChatGPT-like behavior: dragging the artifact completely left closes it
      // instead of leaving a unusable sliver. There is no visible minimum width.
      if(clamped<=24) {
        setArtifactWidth(0);
        setResumeOpen(false);
      } else {
        setArtifactWidth(clamped);
      }
    }else{
      const next=s.startWidth+(e.clientX-s.startX);
      setSidebarWidth(Math.max(260,Math.min(420,next)));
    }
  };
  const endResize=(e?:React.PointerEvent<HTMLDivElement>)=>{
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

  return <div
    className={`resume-studio-app ${sidebarOpen?'sidebar-expanded':'sidebar-collapsed'} ${resumeOpen?'artifact-open':'artifact-closed'}`}
    style={{'--studio-sidebar-width':`${sidebarWidth}px`,'--artifact-width':`${artifactWidth}px`} as React.CSSProperties}
  >
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
      {sidebarOpen && <div
        className="resume-studio-sidebar-resize-handle"
        onPointerDown={e=>startResize('sidebar')(e)}
        onPointerMove={moveResize}
        onPointerUp={endResize}
        onPointerCancel={endResize}
        title="Drag to resize sidebar"
        role="separator"
        aria-orientation="vertical"
        aria-label="Resize sidebar"
      ><span /></div>}
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
          <Button
            size="sm"
            variant={resumeOpen?'secondary':'ghost'}
            onClick={()=>{if(resumeOpen){setResumeOpen(false);setResumeEditMode(false);}else{openArtifact();}}}
            title={resumeOpen?'Close created resume':'Open created resume'}
            aria-label={resumeOpen?'Close created resume':'Open created resume'}
          >
            <FileText className="w-4 h-4 md:mr-2"/><span className="hidden md:inline">{resumeOpen?'Artifact':'Open artifact'}</span>
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
          <div ref={chatScrollRef} className="resume-chat-scroll" onScroll={rememberChatScrollPosition}>
            <div className="resume-chat-content">
              {messages.map(msg=><div key={msg.id} className={`resume-chat-row ${msg.role==='user'?'user':'assistant'}`}>
                <div className={`resume-chat-message ${msg.role==='user'?'user-message':'assistant-message'}`}>
                  {msg.attachment&&<div className="mb-2 inline-flex items-center gap-2 border rounded-xl px-3 py-2 bg-background"><FileText className="w-4 h-4"/><span className="max-w-[260px] truncate">{msg.attachment}</span></div>}
                  <div className="whitespace-pre-wrap">{msg.text}</div>
                  {msg.changes?.length?<ul className="mt-3 list-disc pl-5 text-muted-foreground">{msg.changes.map((x,i)=><li key={i}>{x}</li>)}</ul>:null}
                  {msg.analysis?.gaps?.length?<div className="mt-3 text-muted-foreground"><b className="text-foreground">Gaps:</b> {msg.analysis.gaps.join(', ')}</div>:null}
                  {msg.hasResume&&<div className="resume-chat-artifact-link">
                    <div className="min-w-0"><div className="font-medium">Created resume</div><div className="text-xs text-muted-foreground">Open the live artifact on the right. Edits in the artifact are local.</div></div>
                    <Button size="sm" onClick={()=>{openArtifact()}}>Open</Button>
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
                ref={chatInputRef}
                rows={1}
                value={prompt}
                onChange={e=>{setPrompt(e.target.value);requestAnimationFrame(resizeChatInput);}}
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
          <div className="resume-artifact-resize-handle" onPointerDown={e=>startResize('artifact')(e)} onPointerMove={moveResize} onPointerUp={endResize} onPointerCancel={endResize} title="Drag to resize created resume" role="separator" aria-orientation="vertical" aria-label="Resize created resume">
            <span />
          </div>
          <div className="resume-artifact-header">
            <div className="min-w-0">
              <div className="flex items-center gap-2"><FileText className="w-4 h-4 shrink-0"/><span className="font-semibold truncate">Created resume</span></div>
              <div className="text-[11px] text-muted-foreground mt-0.5">
                {state.resumeData.template==='original-upload'
                  ? (state.resumeData.originalTemplate?.tailored ? 'Original uploaded template selected · tailored content rendered in the original-style editable layout' : 'Original uploaded template selected')
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
              <Button size="sm" variant={resumeEditMode?'secondary':'ghost'} onClick={()=>setResumeEditMode(true)}>Edit</Button>
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
