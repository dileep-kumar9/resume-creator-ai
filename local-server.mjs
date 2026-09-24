import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const distPath = path.join(__dirname, 'dist');
const port = Number(process.env.PORT || 8787);
const geminiParserModel = process.env.GEMINI_PARSER_MODEL || 'gemini-3.1-flash-lite';
const geminiKey = process.env.GEMINI_API_KEY || '';
const groqModel = process.env.GROQ_MODEL || 'openai/gpt-oss-120b';
const groqKey = process.env.GROQ_API_KEY || '';
const mistralModel = process.env.MISTRAL_MODEL || 'mistral-small-latest';
const mistralKey = process.env.MISTRAL_API_KEY || '';

function collectSkills(skills) {
  if (!skills) return [];
  if (skills.mode === 'simple') return Array.isArray(skills.simple) ? skills.simple : [];
  return Array.isArray(skills.categorized) ? skills.categorized.flatMap((c) => Array.isArray(c.skills) ? c.skills : []) : [];
}
function extractKeywords(jd) {
  const common=['Python','JavaScript','TypeScript','React','Node.js','Express','Django','Java','SQL','MySQL','MariaDB','PostgreSQL','MongoDB','AWS','Azure','GCP','Linux','Windows','Docker','Kubernetes','Jenkins','Git','CI/CD','DevOps','REST API','Networking','TCP/IP','DNS','Active Directory','IIS','VoIP','FreeSWITCH','FreePBX','BGP','OSPF','CloudWatch','Terraform','Ansible','Cybersecurity','Security','SOC','SIEM','Incident Response','Monitoring','Troubleshooting','Service Desk','Technical Support'];
  const lower=jd.toLowerCase(); return common.filter(x=>lower.includes(x.toLowerCase())).slice(0,20);
}
const resumeSchema={type:'object',properties:{personalInfo:{type:'object',properties:{fullName:{type:'string'},jobTitle:{type:'string'},email:{type:'string'},phone:{type:'string'},location:{type:'string'},website:{type:'string'},linkedin:{type:'string'},github:{type:'string'},birthDate:{type:'string'}},required:['fullName','jobTitle','email','phone','location','website','linkedin','github','birthDate']},summary:{type:'string'},experience:{type:'array',items:{type:'object',properties:{jobTitle:{type:'string'},company:{type:'string'},location:{type:'string'},startDate:{type:'string'},endDate:{type:'string'},current:{type:'boolean'},description:{type:'string'},bulletPoints:{type:'array',items:{type:'string'}}},required:['jobTitle','company','location','startDate','endDate','current','description','bulletPoints']}},education:{type:'array',items:{type:'object',properties:{degree:{type:'string'},institution:{type:'string'},location:{type:'string'},graduationYear:{type:'string'},gpa:{type:'string'},honors:{type:'string'}},required:['degree','institution','location','graduationYear','gpa','honors']}},projects:{type:'array',items:{type:'object',properties:{title:{type:'string'},description:{type:'string'},technologies:{type:'array',items:{type:'string'}},liveUrl:{type:'string'},githubUrl:{type:'string'},startDate:{type:'string'},endDate:{type:'string'}},required:['title','description','technologies','liveUrl','githubUrl','startDate','endDate']}},skills:{type:'object',properties:{mode:{type:'string',enum:['simple','categorized']},simple:{type:'array',items:{type:'string'}},categorized:{type:'array',items:{type:'object',properties:{name:{type:'string'},skills:{type:'array',items:{type:'string'}}},required:['name','skills']}}},required:['mode','simple','categorized']},customSections:{type:'array',items:{type:'object',properties:{title:{type:'string'},content:{type:'string'}},required:['title','content']}}},required:['personalInfo','summary','experience','education','projects','skills','customSections']};

function makeStrictJsonSchema(schema) {
  if (!schema || typeof schema !== 'object') return schema;
  if (Array.isArray(schema)) return schema.map(makeStrictJsonSchema);
  const out = {};
  for (const [key, value] of Object.entries(schema)) out[key] = makeStrictJsonSchema(value);
  if (schema.type === 'object') {
    out.additionalProperties = false;
    if (out.properties && !out.required) out.required = Object.keys(out.properties);
  }
  return out;
}

function extractionPrompt(text='') { return `You are a resume document extraction engine. Extract ONLY information explicitly present in the supplied resume. This is not rewriting.

Rules:
- Preserve wording verbatim wherever possible. Do not improve grammar, summarize, infer, normalize, or fabricate.
- Preserve EVERY experience entry and EVERY bullet/point as a separate bullet string.
- Preserve EVERY project, its complete description, each project bullet/point, technologies, and URLs. If a project has multiple lines, keep them in description or bulletPoints without dropping content.
- Preserve all education, certifications, skills, contact information, dates, employers, titles, locations and links.
- If a field is absent, use an empty string or empty array.
- Never turn missing information into a guess.
- Use the JSON schema exactly.

Resume text/content follows:\n${text}`; }
const tailorSchema={type:'object',properties:{analysis:{type:'object',properties:{summary:{type:'string'},strengths:{type:'array',items:{type:'string'}},gaps:{type:'array',items:{type:'string'}},matchedKeywords:{type:'array',items:{type:'string'}},missingKeywords:{type:'array',items:{type:'string'}},recommendations:{type:'array',items:{type:'string'}}},required:['summary','strengths','gaps','matchedKeywords','missingKeywords','recommendations']},tailoredResume:{type:'object',properties:{summary:{type:'string'},experienceBulletPoints:{type:'array',items:{type:'array',items:{type:'string'}}},projectDescriptions:{type:'array',items:{type:'string'}},skillsOrder:{type:'array',items:{type:'string'}},customSections:{type:'array',items:{type:'object',properties:{title:{type:'string'},content:{type:'string'}},required:['title','content']}}},required:['summary','experienceBulletPoints','projectDescriptions','skillsOrder','customSections']}},required:['analysis','tailoredResume']};
function compactResume(r){return {summary:r.summary||'',experience:(r.experience||[]).map(e=>({jobTitle:e.jobTitle,company:e.company,location:e.location,startDate:e.startDate,endDate:e.endDate,current:e.current,description:e.description||'',bulletPoints:e.bulletPoints||[]})),projects:(r.projects||[]).map(p=>({title:p.title,description:p.description,technologies:p.technologies||[],liveUrl:p.liveUrl||'',githubUrl:p.githubUrl||''})),skills:collectSkills(r.skills),education:r.education||[],customSections:(r.customSections||[]).filter(s=>s.visible!==false).map(s=>({title:s.title,content:s.content}))};}
function tailorPrompt(resumeData,jd){return `Act as a senior resume analyst and ATS resume writer. Analyze the candidate against the job description and then create a genuinely tailored version of the existing resume.

FACTUAL INTEGRITY IS ABSOLUTE:
- Use ONLY facts supported by the candidate resume. Never invent or imply an employer, title, date, degree, certification, technology, responsibility, metric, project, tool or achievement.
- Do not add a skill merely because it appears in the JD. Only reorder/select skills already present in the candidate resume.
- Preserve company names, job titles, dates, education, project names, technologies and URLs exactly.
- Preserve the number and order of experience entries and projects.
- Rewrite existing bullets when the original evidence supports stronger, JD-relevant wording.
- Rewrite project descriptions only when supported by the existing project description/technology information.
- Do not manufacture financial, ML, Rust, Java, distributed-systems, forecasting, anomaly-detection or other JD experience when the resume does not support it.
- If a requirement is a genuine gap, report it as a gap instead of pretending the candidate has it.
- Make the tailored version visibly more relevant: use the JD's terminology where it accurately describes existing evidence, improve action verbs, emphasize relevant technical work, and prioritize the strongest matching skills.
- A JD-tailoring request MUST produce actual rewritten content, not a lightly reformatted copy. Rewrite the professional summary specifically for the target role. Rewrite the candidate's relevant experience bullets and project descriptions using materially different wording while preserving their facts. Do not copy any original bullet verbatim when a truthful rewrite is possible. Reorder existing skills to put the most relevant supported skills first.
- The tailored summary and rewritten bullets must explicitly connect the candidate's existing evidence to the JD's responsibilities where justified (for example Python, SQL, data analysis, AI/API work, unstructured-data processing, AWS, debugging). Never add unsupported technologies or achievements.
- Return one complete tailored content result, not generic advice.

OUTPUT JSON MUST MATCH THE PROVIDED SCHEMA.

CANDIDATE RESUME:
${JSON.stringify(compactResume(resumeData))}

JOB DESCRIPTION:
${jd}`;}
async function providerGenerate(provider, modelName, key, contents, schema, timeoutMs=45000) {
  if (!key) throw new Error(`${provider} API key is not configured.`);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    let url, body, headers = {'Content-Type':'application/json'};
    if (provider === 'gemini') {
      url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(modelName)}:generateContent?key=${encodeURIComponent(key)}`;
      body = {contents, generationConfig:{temperature:0, responseMimeType:'application/json', responseSchema:schema}};
    } else if (provider === 'groq') {
      url = 'https://api.groq.com/openai/v1/chat/completions';
      headers.Authorization = `Bearer ${key}`;
      body = {model:modelName, messages:contents.map(c=>({role:c.role||'user',content:c.parts?.map(p=>p.text||'').join('')||''})), temperature:0, response_format:{type:'json_object'}};
    } else {
      url = 'https://api.mistral.ai/v1/chat/completions';
      headers.Authorization = `Bearer ${key}`;
      body = {model:modelName, messages:contents.map(c=>({role:c.role||'user',content:c.parts?.map(p=>p.text||'').join('')||''})), temperature:0, response_format:{type:'json_object'}};
    }
    const r = await fetch(url,{method:'POST',headers,signal:controller.signal,body:JSON.stringify(body)});
    const payload = await r.json().catch(()=>({}));
    if (!r.ok) {
      const msg = payload?.error?.message || payload?.message || `${provider} API returned ${r.status}`;
      const err = new Error(msg); err.status=r.status; err.provider=provider; throw err;
    }
    let text = '';
    if (provider === 'gemini') text = payload?.candidates?.[0]?.content?.parts?.map(p=>p.text||'').join('')||'';
    else text = payload?.choices?.[0]?.message?.content || '';
    if (!text) throw new Error(`${provider} returned an empty response.`);
    const parsed = JSON.parse(text);
    if (provider === 'groq' && (!parsed || typeof parsed !== 'object' || Array.isArray(parsed))) throw new Error('Groq returned an invalid JSON object.');
    return parsed;
  } catch(e) {
    if (e?.name==='AbortError') { const err=new Error(`${provider} request timed out.`); err.status=504; err.provider=provider; throw err; }
    throw e;
  } finally { clearTimeout(timer); }
}

async function generateWithFallback(contents, schema, opts={}) {
  const attempts=[];
  if (opts.primary==='groq') attempts.push(['groq',groqModel,groqKey]);
  if (opts.primary==='gemini') attempts.push(['gemini',geminiParserModel,geminiKey]);
  attempts.push(['mistral',mistralModel,mistralKey]);
  let last;
  for (const [provider,model,key] of attempts) {
    if (!key) continue;
    try { return {data:await providerGenerate(provider,model,key,contents,schema,opts.timeoutMs||45000),provider,model}; }
    catch(e) { last=e; console.warn(`${provider} failed:`, e.message); if (![408,409,429,500,502,503,504].includes(e.status||0)) break; }
  }
  throw last || new Error('No AI provider is configured.');
}

function sendJson(res,status,data){const body=JSON.stringify(data);res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Content-Length':Buffer.byteLength(body)});res.end(body);}
async function readBody(req,max=20_000_000){let raw='';for await(const c of req){raw+=c;if(raw.length>max) throw Object.assign(new Error('Upload is too large.'),{status:413});}return JSON.parse(raw||'{}');}
async function handleParseResume(req,res){
  try{
    const b=await readBody(req);
    const {text,pdfBase64}=b;
    if(!text?.trim()&&!pdfBase64)return sendJson(res,400,{error:'No resume content was provided.'});

    // PDF files get a layout-aware Gemini attempt first. If Gemini is temporarily
    // overloaded, the browser can extract the PDF text and retry this endpoint
    // with plain text; text requests then use Groq -> Mistral fallback.
    if(pdfBase64){
      const contents=[{parts:[
        {inlineData:{mimeType:'application/pdf',data:pdfBase64}},
        {text:extractionPrompt('The attached PDF is the source document. Preserve its visible section structure and all content exactly.')}
      ]}];
      try{
        const result=await providerGenerate('gemini',geminiParserModel,geminiKey,contents,resumeSchema,60000);
        return sendJson(res,200,{resumeData:result,provider:'gemini',model:geminiParserModel});
      }catch(e){
        console.warn(`Gemini PDF parser failed (${e.status||'unknown'}): ${e.message}. Waiting for client text fallback.`);
        return sendJson(res,e.status||503,{error:e.message||'Gemini PDF parsing failed.',provider:'gemini',fallbackAvailable:true});
      }
    }

    const contents=[{parts:[{text:extractionPrompt(text.trim())}]}];
    const result=await generateWithFallback(contents,resumeSchema,{primary:'groq',timeoutMs:45000});
    sendJson(res,200,{resumeData:result.data,provider:result.provider,model:result.model});
  }catch(e){
    console.error('Resume parse error:',e);
    sendJson(res,e.status||500,{error:e.message||'Failed to parse resume.'});
  }
}
function normalizeTailoring(ai) {
  if (!ai || typeof ai !== 'object' || Array.isArray(ai)) return null;
  // Accept the intended shape plus common model variations/wrappers.
  let t = ai.tailoredResume || ai.tailored_resume || ai.resumeData || ai.resume || ai.result || ai.data?.tailoredResume || ai.data?.resumeData;
  // Some JSON-mode providers return the tailored fields at the root instead of
  // preserving the requested wrapper. Treat that as a valid tailored result.
  if (!t && (typeof ai.summary === 'string' || Array.isArray(ai.experience) || Array.isArray(ai.projects) || Array.isArray(ai.skills) || ai.skills?.simple || ai.skills?.categorized)) t = ai;
  // Some providers put the useful result one level deeper under result/data.
  if (t && t.result && typeof t.result === 'object' && !Array.isArray(t.result)) t = t.result;
  if (!t || typeof t !== 'object' || Array.isArray(t)) return null;
  const analysis = ai.analysis || ai.resumeAnalysis || ai.data?.analysis || t.analysis || {};
  const out = { analysis, tailoredResume: {} };
  const tr = out.tailoredResume;
  tr.summary = typeof t.summary === 'string' ? t.summary : '';
  tr.experienceBulletPoints = Array.isArray(t.experienceBulletPoints) ? t.experienceBulletPoints :
    Array.isArray(t.experience) ? t.experience.map(e => Array.isArray(e?.bulletPoints) ? e.bulletPoints : (Array.isArray(e?.bullets) ? e.bullets : [])) : [];
  tr.projectDescriptions = Array.isArray(t.projectDescriptions) ? t.projectDescriptions :
    Array.isArray(t.projects) ? t.projects.map(p => typeof p?.description === 'string' ? p.description : '') : [];
  tr.skillsOrder = Array.isArray(t.skillsOrder) ? t.skillsOrder :
    Array.isArray(t.skills) ? (t.skills.mode === 'simple' ? t.skills.simple : (t.skills.categorized || []).flatMap(c => c.skills || [])) : [];
  tr.customSections = Array.isArray(t.customSections) ? t.customSections : [];
  // Consider a result usable when it contains at least one meaningful editable field.
  // This prevents a perfectly valid analysis wrapper from being rejected just because
  // a provider omitted an empty optional section.
  const usable = Boolean(
    tr.summary.trim() ||
    tr.experienceBulletPoints.some(x => Array.isArray(x) && x.length) ||
    tr.projectDescriptions.some(x => typeof x === 'string' && x.trim()) ||
    tr.skillsOrder.length ||
    tr.customSections.length
  );
  return usable ? out : null;
}
function applyTailoring(original,ai){
  const normalized=normalizeTailoring(ai);
  if(!normalized) throw new Error('AI returned JSON, but no usable tailored resume was found.');
  const result=structuredClone(original); const t=normalized.tailoredResume;
  if(typeof t.summary==='string'&&t.summary.trim()) result.summary=t.summary.trim();
  if(Array.isArray(t.experienceBulletPoints)) {
    result.experience=(original.experience||[]).map((x,i)=>({...x,bulletPoints:Array.isArray(t.experienceBulletPoints[i])&&t.experienceBulletPoints[i].length?t.experienceBulletPoints[i].filter(v=>typeof v==='string'&&v.trim()).map(v=>v.trim()):x.bulletPoints}));
  }
  if(Array.isArray(t.projectDescriptions)) {
    result.projects=(original.projects||[]).map((x,i)=>({...x,description:typeof t.projectDescriptions[i]==='string'&&t.projectDescriptions[i].trim()?t.projectDescriptions[i].trim():x.description}));
  }
  if(Array.isArray(t.skillsOrder)){
    const originalSkills=collectSkills(original.skills); const lookup=new Map(originalSkills.map(s=>[s.toLowerCase(),s]));
    const ordered=[...new Set(t.skillsOrder.map(s=>typeof s==='string'?lookup.get(s.trim().toLowerCase()):'').filter(Boolean))];
    if(ordered.length){
      if(original.skills.mode==='simple') result.skills={...original.skills,simple:ordered};
      else result.skills={...original.skills,categorized:(original.skills.categorized||[]).map(c=>({...c,skills:c.skills.filter(s=>ordered.some(x=>x.toLowerCase()===s.toLowerCase()))}))};
    }
  }
  return result;
}

const agentResumeSchema=JSON.parse(JSON.stringify(resumeSchema));
agentResumeSchema.properties.sections={type:'array',items:{type:'object',properties:{id:{type:'string'},title:{type:'string'},visible:{type:'boolean'},order:{type:'number'}},required:['id','title','visible','order']}};
agentResumeSchema.properties.colors={type:'object',properties:{primary:{type:'string'},secondary:{type:'string'},accent:{type:'string'},text:{type:'string'},background:{type:'string'}},required:['primary','secondary','accent','text','background']};
agentResumeSchema.properties.template={type:'string',enum:['original-upload','tech-sidebar','business-professional','modern-minimal','elegant-timeline','creative-modern','bjet-professional']};
agentResumeSchema.properties.pageFormat={type:'string',enum:['letter','a4']};
agentResumeSchema.properties.fontSize={type:'string',enum:['small','medium','large']};
agentResumeSchema.properties.fontFamily={type:'string'};
agentResumeSchema.required=[...new Set([...(agentResumeSchema.required||[]),'sections','colors','template','pageFormat','fontSize','fontFamily'])];
const agentSchema={type:'object',properties:{intent:{type:'string'},message:{type:'string'},analysis:{type:'object',properties:{summary:{type:'string'},strengths:{type:'array',items:{type:'string'}},gaps:{type:'array',items:{type:'string'}},matchedKeywords:{type:'array',items:{type:'string'}},missingKeywords:{type:'array',items:{type:'string'}},recommendations:{type:'array',items:{type:'string'}}},required:['summary','strengths','gaps','matchedKeywords','missingKeywords','recommendations']},changes:{type:'array',items:{type:'string'}},resumeData:agentResumeSchema},required:['intent','message','analysis','changes','resumeData']};

const TEMPLATE_NAMES={
  'tech-sidebar':'Tech Sidebar',
  'business-professional':'Business Professional',
  'modern-minimal':'Modern Minimal',
  'elegant-timeline':'Elegant Timeline',
  'creative-modern':'Creative Modern',
  'bjet-professional':'B-JET Professional'
};
function agentPrompt(resumeData,instruction,referenceText=''){
  return `You are the Resume Agent inside a professional resume editor. The user can speak to you naturally, like ChatGPT/Gemini. Your job is to understand the user's instruction and perform the requested resume operation, not merely give advice.

SUPPORTED OPERATIONS (you may combine them):
- Tailor the resume to a job description.
- Analyze a job description against the resume without changing it unless asked.
- Rewrite/improve a summary, bullet points, project descriptions, skills ordering, or another specific section.
- Change the resume template/design.
- Make the resume one page / more compact / more readable / ATS-friendly.
- Reorder or hide sections.
- Change font, page format, or colors when requested.
- Use an uploaded reference resume as a style/layout reference and choose the closest built-in template. Preserve the candidate's own content; do not copy the reference person's facts.
- Perform combinations such as “tailor this to the JD and make it one page using this reference style”.

AVAILABLE EDITABLE TEMPLATES:
${JSON.stringify(TEMPLATE_NAMES)}

FACTUAL INTEGRITY:
1. The candidate resume is the source of truth for candidate facts.
2. Never invent employers, job titles, dates, degrees, grades, certifications, technologies, responsibilities, metrics, clients, achievements, project names, URLs, or experience.
3. For JD tailoring, use JD terminology only when it accurately describes evidence already present in the candidate resume.
4. Never add a missing skill just because the JD asks for it. Put unsupported requirements in analysis.gaps instead.
5. Do not silently change factual personal information.
6. Preserve all existing experience/project/education entries unless the user explicitly asks to remove one.
7. If the instruction is design-only, preserve content exactly and only change design/layout fields.
8. If the instruction is content-only, preserve template/design exactly unless the user also requests design changes.
9. Keep URLs exactly as supplied.
10. The returned resumeData must be complete, valid, and directly usable by the editor. Preserve IDs when supplied. Do not omit fields.

REFERENCE HANDLING:
- The reference is a style/content reference, not permission to copy another person's facts.
- If reference text is supplied, infer useful structural/style clues from it. If the reference appears to contain another person's resume, NEVER replace the candidate's identity, employers, dates, education, projects, or skills with reference facts.
- If the user asks to “make mine like this”, reproduce only the general visual/structural intent using the closest available built-in template, fonts, colors, section ordering, and density. Do not claim to reproduce an unavailable template exactly.

IMPORTANT OUTPUT BEHAVIOR:
- Actually perform the requested changes in resumeData.
- A tailoring request is NOT successful if resumeData is effectively unchanged. For a JD-tailoring request, the professional summary MUST be newly written for the target role, and existing experience/project bullets or descriptions MUST be rewritten wherever their facts can truthfully be connected to the JD. Reorder existing skills by relevance. Do not merely return the source resume.
- Prefer concrete reframing over generic preservation: if the source says an AI project parses unstructured data, emphasize unstructured-data processing and structured reporting when the JD values those concepts; if the source says Python/SQL/data analysis/AWS, foreground those capabilities when relevant. This is rewriting, not invention.
- The professional headline/jobTitle may be changed only as a positioning headline when it is not an employer-held role; never falsify an employment title.
- Return a concise message describing what you changed.
- changes should list concrete changes, not generic advice.
- If the user only asks a question and no resume modification is requested, return the current resume unchanged and explain the answer in message.
- For a JD, provide useful analysis including strengths, genuine gaps, matched and missing keywords.

CURRENT RESUME:
${JSON.stringify({...resumeData,originalTemplate:resumeData.originalTemplate?{sourceFileName:resumeData.originalTemplate.sourceFileName,sourceFormat:resumeData.originalTemplate.sourceFormat}:undefined})}

USER INSTRUCTION:
${instruction}

REFERENCE MATERIAL (may be empty):
${referenceText || '(none)'}

Return JSON only.`;
}
function sanitizeAgentResume(original, candidate){
  const out=structuredClone(original);
  if(!candidate || typeof candidate!=='object') return out;
  const keep=(v,f)=>v===undefined?f:v;
  // AI may change editable content, ordering and design, but immutable factual identity fields
  // are restored from the current resume unless the user explicitly edits them in the editor.
  out.personalInfo={...structuredClone(original.personalInfo),jobTitle:(candidate.personalInfo&&typeof candidate.personalInfo.jobTitle==='string'&&candidate.personalInfo.jobTitle.trim())?candidate.personalInfo.jobTitle.trim():original.personalInfo.jobTitle};
  out.experience=(original.experience||[]).map((o,i)=>{
    const e=Array.isArray(candidate.experience)?candidate.experience[i]:null;
    return {...o,jobTitle:o.jobTitle,company:o.company,location:o.location,startDate:o.startDate,endDate:o.endDate,current:o.current,description:keep(e?.description,o.description),bulletPoints:Array.isArray(e?.bulletPoints)?e.bulletPoints:o.bulletPoints};
  });
  out.education=structuredClone(original.education);
  out.projects=(original.projects||[]).map((o,i)=>{const p=Array.isArray(candidate.projects)?candidate.projects[i]:null;return {...o,title:o.title,technologies:o.technologies,liveUrl:o.liveUrl,githubUrl:o.githubUrl,startDate:o.startDate,endDate:o.endDate,description:keep(p?.description,o.description)};});
  out.summary=typeof candidate.summary==='string'?candidate.summary:original.summary;
  if(candidate.skills&&typeof candidate.skills==='object'){
    const allowed=new Set(collectSkills(original.skills).map(x=>String(x).toLowerCase()));
    const clean=(x)=>Array.isArray(x)?x.filter(v=>allowed.has(String(v).toLowerCase())):[];
    if(original.skills.mode==='simple') out.skills={...original.skills,simple:clean(candidate.skills.simple)};
    else out.skills={...original.skills,categorized:(original.skills.categorized||[]).map((c,i)=>({...c,skills:clean(candidate.skills.categorized?.[i]?.skills)}))};
  } else out.skills=structuredClone(original.skills);
  out.customSections=Array.isArray(candidate.customSections)?candidate.customSections:structuredClone(original.customSections);
  out.sections=Array.isArray(candidate.sections)?candidate.sections:structuredClone(original.sections);
  out.colors=candidate.colors&&typeof candidate.colors==='object'?candidate.colors:structuredClone(original.colors);
  out.template=Object.prototype.hasOwnProperty.call(TEMPLATE_NAMES,candidate.template)?candidate.template:original.template;
  out.pageFormat=['a4','letter'].includes(candidate.pageFormat)?candidate.pageFormat:original.pageFormat;
  out.fontSize=['small','medium','large'].includes(candidate.fontSize)?candidate.fontSize:original.fontSize;
  out.fontFamily=typeof candidate.fontFamily==='string'&&candidate.fontFamily?candidate.fontFamily:original.fontFamily;
  out.originalTemplate=original.originalTemplate;
  return out;
}
async function handleAgent(req,res){
  try{
    const b=await readBody(req,12_000_000);
    if(!b.resumeData||typeof b.resumeData!=='object') return sendJson(res,400,{error:'Resume data is required.'});
    if(typeof b.instruction!=='string'||b.instruction.trim().length<2) return sendJson(res,400,{error:'Please tell the Resume Agent what you want it to do.'});
    let referenceText=typeof b.referenceText==='string'?b.referenceText.trim():'';
    let contents=[{parts:[{text:agentPrompt(b.resumeData,b.instruction.trim(),referenceText)}]}];
    // When a PDF reference is supplied, use Gemini's native PDF input so the agent can reason
    // about the reference document's visual/structural cues instead of only extracted text.
    const hasPdf=typeof b.referencePdfBase64==='string'&&b.referencePdfBase64.length>100;
    if(hasPdf){
      contents=[{parts:[{inlineData:{mimeType:'application/pdf',data:b.referencePdfBase64}},{text:agentPrompt(b.resumeData,b.instruction.trim(),referenceText+'\n[The attached PDF is the visual reference. Inspect its layout/style as well as its text. Use it only as a design reference unless the user explicitly asks for factual extraction.]')}]}];
    }
    const requestedTailor=/tailor|job description|\bjd\b|ats|match (?:this|the) (?:role|job)/i.test(b.instruction);
    const contentFingerprint=x=>JSON.stringify({jobTitle:x?.personalInfo?.jobTitle||'',summary:x?.summary||'',experience:(x?.experience||[]).map(e=>e.bulletPoints||[]),projects:(x?.projects||[]).map(p=>p.description||''),skills:collectSkills(x?.skills)});

    // JD tailoring gets a dedicated resume-writing pass instead of relying on the
    // general-purpose agent schema. This makes the natural-language agent feel
    // like ChatGPT while using a stricter writer internally for the highest-value
    // operation.
    if(requestedTailor){
      const basePrompt=tailorPrompt(b.resumeData,b.instruction.trim());
      const retryPrompt=basePrompt.replace(
        'Return one complete tailored content result, not generic advice.',
        `Return one complete tailored content result, not generic advice.\n\nFORCED REWRITE PASS: The previous attempt may have preserved the source too closely. You must rewrite the professional summary and every experience/project bullet that can be truthfully connected to the JD. Use materially different wording and stronger JD-relevant framing. Do not copy the original sentences verbatim. Reorder the existing skills so the most relevant supported skills appear first. If a requirement is unsupported, state it in gaps rather than adding it.`
      );
      const tryTailor=async(prompt,primary)=>generateWithFallback([{parts:[{text:prompt}]}],tailorSchema,{primary,timeoutMs:45000});
      let tailoredResult=await tryTailor(basePrompt,'groq');
      let tailoredResume;
      try { tailoredResume=applyTailoring(b.resumeData,tailoredResult.data); } catch(e) { tailoredResume=null; }
      if(!tailoredResume || contentFingerprint(tailoredResume)===contentFingerprint(b.resumeData)){
        tailoredResult=await tryTailor(retryPrompt,'mistral');
        try { tailoredResume=applyTailoring(b.resumeData,tailoredResult.data); } catch(e) { tailoredResume=null; }
      }
      if(!tailoredResume || contentFingerprint(tailoredResume)===contentFingerprint(b.resumeData)){
        throw Object.assign(new Error('The AI providers did not produce a materially tailored resume. No unchanged resume was applied.'),{status:502});
      }
      const a=tailoredResult.data?.analysis||{};
      const changes=[
        'Rewrote the professional summary for the target role.',
        'Reframed relevant experience bullets using JD terminology supported by the resume.',
        'Reframed relevant project descriptions using existing facts and technologies.',
        'Reordered existing skills by relevance to the job description.'
      ];
      sendJson(res,200,{resumeData:tailoredResume,intent:'tailor',message:'Resume tailored to the job description using only supported candidate evidence.',analysis:a,changes,provider:tailoredResult.provider,model:tailoredResult.model});
      return;
    }

    const result=hasPdf && geminiKey
      ? await generateWithFallback(contents,agentSchema,{primary:'gemini',timeoutMs:60000})
      : await generateWithFallback(contents,agentSchema,{primary:'groq',timeoutMs:45000});
    const raw=result.data||{};
    const candidate=raw.resumeData||raw.tailoredResume||raw.resume||raw.result?.resumeData||raw.data?.resumeData;
    const safeResume=sanitizeAgentResume(b.resumeData,candidate);
    sendJson(res,200,{resumeData:safeResume,intent:raw.intent||'edit',message:raw.message||'Resume updated.',analysis:raw.analysis||{},changes:Array.isArray(raw.changes)?raw.changes:[],provider:result.provider,model:result.model});
  }catch(e){console.error('Resume agent error:',e);sendJson(res,e.status||500,{error:e.message||'Resume Agent failed.'});}
}

async function handleTailor(req,res){try{const b=await readBody(req,4_000_000);if(!b.resumeData||typeof b.resumeData!=='object')return sendJson(res,400,{error:'Resume data is required.'});if(typeof b.jobDescription!=='string'||b.jobDescription.trim().length<40)return sendJson(res,400,{error:'Please provide a complete job description.'});const result=await generateWithFallback([{parts:[{text:tailorPrompt(b.resumeData,b.jobDescription.trim())}]}],tailorSchema,{primary:'groq',timeoutMs:35000});sendJson(res,200,{resumeData:applyTailoring(b.resumeData,result.data),analysis:result.data.analysis,matchedKeywords:result.data.analysis?.matchedKeywords||extractKeywords(b.jobDescription),provider:result.provider,model:result.model});}catch(e){console.error('AI tailor error:',e);sendJson(res,e.status||500,{error:e.message||'Failed to tailor resume.'});}}
export { handleParseResume, handleTailor, handleAgent };

const mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.ico':'image/x-icon'};
function serveStatic(req,res){let requestPath=decodeURIComponent(new URL(req.url,`http://${req.headers.host}`).pathname);if(requestPath==='/')requestPath='/index.html';const filePath=path.join(distPath,requestPath);if(!filePath.startsWith(distPath)||!fs.existsSync(filePath)||fs.statSync(filePath).isDirectory()){const fallback=path.join(distPath,'index.html');if(fs.existsSync(fallback)){res.writeHead(200,{'Content-Type':'text/html; charset=utf-8'});return fs.createReadStream(fallback).pipe(res);}return sendJson(res,404,{error:'Build not found. Run npm run build first.'});}res.writeHead(200,{'Content-Type':`${mime[path.extname(filePath)]||'application/octet-stream'}; charset=utf-8`});fs.createReadStream(filePath).pipe(res);}
if (process.env.VERCEL !== '1') {
  http.createServer(async(req,res)=>{
    try {
      const route=req.url?.split('?')[0];
      if(req.method==='POST'&&route==='/api/parse-resume') return handleParseResume(req,res);
      if(req.method==='POST'&&route==='/api/tailor') return handleTailor(req,res);
      if(req.method==='POST'&&route==='/api/agent') return handleAgent(req,res);
      if(req.method==='GET'||req.method==='HEAD') return serveStatic(req,res);
      sendJson(res,405,{error:'Method not allowed.'});
    } catch(e) {
      sendJson(res,500,{error:e.message||'Server error.'});
    }
  }).listen(port,()=>console.log(`Resume Creator server: http://localhost:${port} | parser=${geminiParserModel} | tailor=${groqModel} | fallback=${mistralModel}`));
}
