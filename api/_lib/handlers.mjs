const geminiParserModel = process.env.GEMINI_PARSER_MODEL || 'gemini-3.1-flash-lite';
const geminiKey = process.env.GEMINI_API_KEY || '';
const groqModel = process.env.GROQ_MODEL || 'openai/gpt-oss-120b';
const groqKey = process.env.GROQ_API_KEY || '';
const mistralModel = process.env.MISTRAL_MODEL || 'mistral-small-latest';
const mistralKey = process.env.MISTRAL_API_KEY || '';
const geminiTailorModel = process.env.GEMINI_TAILOR_MODEL || geminiParserModel;

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
- If a field is absent, use an empty string or empty array. NEVER write "Not specified", "N/A", "Unknown", or a made-up value for a missing field.
- If the source shows only a year (for example "2024"), preserve exactly "2024"; do not convert it to January or another month.
- Project dates are optional. If a project has no visible date, leave startDate and endDate empty.
- Never infer dates, locations, grades, technologies, metrics, or responsibilities from context.
- If visually separated skill tags appear adjacent in extracted text, keep each visible tag as a separate array item.
- Use the JSON schema exactly.

Resume text/content follows:\n${text}`; }
const tailorSchema={type:'object',properties:{analysis:{type:'object',properties:{summary:{type:'string'},strengths:{type:'array',items:{type:'string'}},gaps:{type:'array',items:{type:'string'}},matchedKeywords:{type:'array',items:{type:'string'}},missingKeywords:{type:'array',items:{type:'string'}},recommendations:{type:'array',items:{type:'string'}}},required:['summary','strengths','gaps','matchedKeywords','missingKeywords','recommendations']},tailoredResume:{type:'object',properties:{summary:{type:'string'},experienceDescriptions:{type:'array',items:{type:'string'}},experienceBulletPoints:{type:'array',items:{type:'array',items:{type:'string'}}},projectDescriptions:{type:'array',items:{type:'string'}},skillsOrder:{type:'array',items:{type:'string'}},customSections:{type:'array',items:{type:'object',properties:{title:{type:'string'},content:{type:'string'}},required:['title','content']}}},required:['summary','experienceDescriptions','experienceBulletPoints','projectDescriptions','skillsOrder','customSections']}},required:['analysis','tailoredResume']};
function compactResume(r){return {summary:r.summary||'',experience:(r.experience||[]).map(e=>({jobTitle:e.jobTitle,company:e.company,location:e.location,startDate:e.startDate,endDate:e.endDate,current:e.current,description:e.description||'',bulletPoints:e.bulletPoints||[]})),projects:(r.projects||[]).map(p=>({title:p.title,description:p.description,technologies:p.technologies||[],liveUrl:p.liveUrl||'',githubUrl:p.githubUrl||''})),skills:collectSkills(r.skills),education:r.education||[],customSections:(r.customSections||[]).filter(s=>s.visible!==false).map(s=>({title:s.title,content:s.content}))};}
function tailorPrompt(resumeData,jd){return `Act as a senior resume analyst and ATS resume writer, working like a conversational resume editor. Analyze the candidate against the job description and then create a genuinely tailored version of the existing resume.

IDENTITY AND HEADER: The candidate's name is ${JSON.stringify(resumeData?.personalInfo?.fullName||'')}. Preserve this exact full name and keep it as the first/top heading of the resume. Never replace it with the target job title, a sample candidate, or a placeholder. Preserve email, phone, location, portfolio and LinkedIn exactly. The target role may be used as the professional headline only; never change an actual employment title.

FACTUAL INTEGRITY IS ABSOLUTE:
- Use ONLY facts supported by the candidate resume. Never invent or imply an employer, title, date, degree, certification, technology, responsibility, metric, project, tool or achievement.
- Do not add a skill merely because it appears in the JD. Only reorder/select skills already present in the candidate resume.
- Preserve company names, job titles, dates, education, project names, technologies and URLs exactly.
- Preserve the number and order of experience entries and projects.
- Treat every original resume entry as a closed evidence boundary: rewrite only facts stated in that entry. Do not add plausible-but-unmentioned implementation details, business impact, users, scale, deployment status, metrics, or outcomes.
- Rewrite existing bullets only when the source supports a clearer, more relevant formulation. Keep each bullet's factual meaning intact. Preserve the exact number and order of experience entries, projects, and bullets within each experience entry.
- Rewrite project descriptions only from the project's own source description and listed technologies. Do not turn an API integration into an autonomous agent, a database-backed app into an analytics dashboard, or a prototype into a production deployment unless the source explicitly says so.
- Do not manufacture financial, ML, Rust, Java, distributed-systems, forecasting, anomaly-detection, optimization, reconciliation, or other JD experience when the resume does not support it. Mention unsupported requirements only in analysis.gaps.
- Make the result meaningfully tailored through prioritization and precise phrasing, not keyword stuffing. Write a concise, role-specific summary grounded in the strongest evidence. Use JD terminology only when it is an accurate description of that evidence.
- Keep all original skills; reorder them by relevance, but never remove skills or add JD-only skills. Do not change candidate identity, job titles, employers, dates, education, project names, technologies, URLs, or template.
- For EACH experience entry, return an experienceDescriptions item in the same order. Rewrite the existing description only when it contains source facts not already expressed in bullets; otherwise return the original description unchanged.
- For each experience entry, return one rewritten bullet for each source bullet in the same order. If a bullet cannot be improved without adding assumptions, preserve its meaning with a conservative rewrite.
- For EACH project, return one rewritten projectDescriptions item in the same order. Make the relevance clear through precise wording, but never turn an existing project into a different type of product or claim unsupported outcomes.
- Return a complete tailored content result plus specific strengths, gaps, and recommendations. Avoid generic claims such as “results-driven”, “proven ability”, “measurable impact”, or “successfully deployed” unless directly supported.

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
  if (opts.primary==='mistral') attempts.push(['mistral',mistralModel,mistralKey]);
  if (opts.includeGeminiFallback && opts.primary!=='gemini') attempts.push(['gemini',geminiTailorModel,geminiKey]);
  if (opts.primary!=='mistral') attempts.push(['mistral',mistralModel,mistralKey]);
  let last;
  for (const [provider,model,key] of attempts) {
    if (!key) continue;
    try { return {data:await providerGenerate(provider,model,key,contents,schema,opts.timeoutMs||45000),provider,model}; }
    catch(e) {
      last=e;
      console.warn(`${provider} failed:`, e.message);
      if (![408,409,429,500,502,503,504].includes(e.status||0)) break;
    }
  }
  if (last?.status === 429) {
    const err = new Error('All configured AI providers are currently rate-limited. Please wait a moment and try again.');
    err.status = 429;
    throw err;
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
  tr.experienceDescriptions = Array.isArray(t.experienceDescriptions) ? t.experienceDescriptions :
    Array.isArray(t.experience) ? t.experience.map(e => typeof e?.description === 'string' ? e.description : '') : [];
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
    tr.experienceDescriptions.some(x => typeof x === 'string' && x.trim()) ||
    tr.experienceBulletPoints.some(x => Array.isArray(x) && x.length) ||
    tr.projectDescriptions.some(x => typeof x === 'string' && x.trim()) ||
    tr.skillsOrder.length ||
    tr.customSections.length
  );
  return usable ? out : null;
}

function localTailorResume(original, jobDescription) {
  const result = structuredClone(original);
  const jd = jobDescription.toLowerCase();
  const supported = collectSkills(original.skills);
  const matched = supported.filter((skill) => jd.includes(String(skill).toLowerCase()));
  const keywordSet = [...new Set([...matched, ...extractKeywords(jobDescription).filter(k => supported.some(s => s.toLowerCase() === k.toLowerCase()))])];

  const originalSummary = original.summary || '';
  const focus = keywordSet.slice(0, 6).join(', ');
  result.summary = focus
    ? `${originalSummary.replace(/\s+/g, ' ').trim()} Brings hands-on experience relevant to ${focus}, with a focus on technical problem solving, data handling, and clear delivery of practical solutions.`
    : `${originalSummary.replace(/\s+/g, ' ').trim()} Brings hands-on technical problem-solving experience and a strong ability to translate existing technical work into practical, role-relevant outcomes.`;

  result.experience = (original.experience || []).map((entry) => ({
    ...entry,
    bulletPoints: (entry.bulletPoints || []).map((bullet) => {
      const text = String(bullet).trim();
      if (!text) return text;
      if (/\bdata|monitor|technical|system|documentation|python|sql|aws|api|troubleshoot|debug/i.test(text)) {
        return text.replace(/^([A-Z][^.!?]*?)(?:\.|$)/, (m) => m).trim();
      }
      return text;
    })
  }));

  if (keywordSet.length) {
    const lookup = new Map(supported.map((x) => [x.toLowerCase(), x]));
    const ordered = [...new Set([...keywordSet.map(x => lookup.get(x.toLowerCase())).filter(Boolean), ...supported])];
    if (original.skills?.mode === 'simple') result.skills = { ...original.skills, simple: ordered };
  }
  return result;
}

function applyTailoring(original,ai,jobDescription=''){ 
  const normalized=normalizeTailoring(ai);
  if(!normalized) throw new Error('AI returned JSON, but no usable tailored resume was found.');
  const result=structuredClone(original); const t=normalized.tailoredResume;
  // Identity is immutable during tailoring; the candidate's name remains the resume's top heading.
  result.personalInfo=structuredClone(original.personalInfo);
  const targetTitle=String(jobDescription).match(/(?:^|[\n\r])\s*[*_#\s]*job\s*title\s*[:：-]\s*([^\n\r*]+)/i)?.[1]?.replace(/[*_]+/g,'').trim();
  if(targetTitle && targetTitle.length<=100) result.personalInfo.jobTitle=targetTitle;
  if(typeof t.summary==='string'&&t.summary.trim()) result.summary=t.summary.trim();
  if(Array.isArray(t.experienceBulletPoints) && t.experienceBulletPoints.length === (original.experience||[]).length) {
    result.experience=(original.experience||[]).map((x,i)=>{
      const proposed=t.experienceBulletPoints[i];
      // A model must not silently delete, add, or merge a source bullet.
      const valid=Array.isArray(proposed) && proposed.length === (x.bulletPoints||[]).length && proposed.every(v=>typeof v==='string'&&v.trim());
      const proposedDescription=Array.isArray(t.experienceDescriptions)?t.experienceDescriptions[i]:'';
      return {...x,description:typeof proposedDescription==='string'&&proposedDescription.trim()?proposedDescription.trim():x.description,bulletPoints:valid?proposed.map(v=>v.trim()):x.bulletPoints};
    });
  } else if(Array.isArray(t.experienceDescriptions) && t.experienceDescriptions.length === (original.experience||[]).length) {
    result.experience=(original.experience||[]).map((x,i)=>({...x,description:typeof t.experienceDescriptions[i]==='string'&&t.experienceDescriptions[i].trim()?t.experienceDescriptions[i].trim():x.description}));
  }
  if(Array.isArray(t.projectDescriptions)) {
    result.projects=(original.projects||[]).map((x,i)=>({...x,description:typeof t.projectDescriptions[i]==='string'&&t.projectDescriptions[i].trim()?t.projectDescriptions[i].trim():x.description}));
  }
  if(Array.isArray(t.skillsOrder)){
    const originalSkills=collectSkills(original.skills);
    const lookup=new Map(originalSkills.map(s=>[s.toLowerCase(),s]));
    const requested=[...new Set(t.skillsOrder.map(s=>typeof s==='string'?lookup.get(s.trim().toLowerCase()):'').filter(Boolean))];
    // Reordering must never drop an original skill, even if the model returns a
    // partial list. Keep every source skill and append omitted items in source order.
    const ordered=[...requested,...originalSkills.filter(s=>!requested.some(x=>x.toLowerCase()===s.toLowerCase()))];
    if(original.skills.mode==='simple') result.skills={...original.skills,simple:ordered};
    else {
      const remaining=[...ordered];
      result.skills={...original.skills,categorized:(original.skills.categorized||[]).map(c=>({...c,skills:[...c.skills].sort((a,b)=>remaining.findIndex(x=>x.toLowerCase()===a.toLowerCase())-remaining.findIndex(x=>x.toLowerCase()===b.toLowerCase()))}))};
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
function agentPrompt(resumeData,instruction,referenceText='',conversation=[]){
  return `You are an advanced conversational Resume Agent inside a professional resume editor. Behave like a careful ChatGPT-style resume assistant: understand natural-language requests, inspect the current resume and relevant context, perform the requested operation, and return a complete usable resumeData object.

CORE RULE: DO THE REQUEST, DO NOT JUST GIVE ADVICE.

SUPPORTED OPERATIONS (may be combined):
- analyze resume
- analyze job description
- compare resume with JD
- tailor resume to JD
- generate/create a resume
- rewrite/improve resume content
- add/remove/reorder resume items
- ATS optimization
- rewrite summary, experience, bullets, projects, skills
- one-page/compact optimization
- template/design/layout/font/color changes
- use a reference resume for style/layout
- answer questions about the current resume
- follow-up instructions such as “that project”, “undo that”, “make it shorter”, “keep everything else unchanged”

INTENT RULES:
1. ANALYZE means inspect and report; do NOT modify resumeData unless the user explicitly asks to modify it.
2. TAILOR means actually rewrite relevant content for the supplied JD; it is not a synonym for “analyze”.
3. GENERATE means construct a complete resume from supplied facts. Never invent missing facts.
4. EDIT means apply the requested edit and preserve everything else.
5. DESIGN means change only design/layout fields unless content changes were also requested.
6. If multiple operations are requested, perform all of them in logical order.

FACTUAL INTEGRITY IS ABSOLUTE:
- The current resume is the source of truth for candidate facts.
- Never invent employers, job titles, dates, degrees, grades, certifications, technologies, responsibilities, metrics, clients, achievements, projects, URLs, or experience.
- A Job Description is NOT evidence that the candidate has a skill or experience.
- Never add a JD-only skill to the candidate's skills.
- Unsupported JD requirements belong in analysis.gaps/missingKeywords, not in resume content.
- Rewriting is allowed; fabrication is forbidden.
- Preserve candidate identity, contact details, employers, titles, dates, education, project names, technologies and URLs unless the user explicitly asks to change a specific factual field and supplies the new value.
- Do not silently change employment titles. A target role may be used as a positioning headline only when the UI supports it and it is clearly not an employer-held title.
- Never manufacture metrics or outcomes. If a metric is absent, do not create one.
- Preserve each existing experience/project unless the user explicitly requests removal.

TAILORING RULES:
When tailoring to a JD:
- Analyze the JD first.
- Identify required/preferred skills, responsibilities, keywords and experience expectations.
- Compare each important requirement against the resume.
- Classify evidence as supported, partially supported, or unsupported.
- Rewrite the professional summary for the target role using only supported evidence.
- Rewrite relevant experience bullets using only facts from the corresponding source entry.
- Rewrite relevant project descriptions using only facts from that project and its listed technologies.
- Reorder existing skills by relevance, but retain every original skill.
- Use JD terminology only when it accurately describes existing evidence.
- Do not keyword-stuff.
- Do not merely copy the original resume.
- Do not merely return recommendations when the user asked for tailoring.
- A successful tailoring response must contain meaningful truthful content changes whenever such changes are possible.

ANALYSIS RULES:
When asked to analyze a resume or JD:
- Give specific evidence-based strengths, weaknesses, gaps, matches and recommendations.
- Do not alter resumeData unless modification was requested.
- Distinguish “JD requires X” from “candidate has X”.
- Never claim an ATS score as an objective fact unless it is explicitly produced by the application's scoring logic; describe it as an estimate when applicable.

ADD/REMOVE/REORDER RULES:
- For ADD, use only information supplied by the user or already present in the resume.
- If essential facts for a new item are missing, do not invent them; explain what is needed.
- For REMOVE, remove only the named item.
- For REORDER, preserve all items and only change their order unless the user says otherwise.
- “Keep everything else unchanged” means preserve all unrelated fields exactly.

REFERENCE RESUME RULES:
- Use a reference document as a style/layout/structure reference unless the user explicitly asks to extract facts.
- Never copy another person's identity, contact information, employers, education, dates, projects, skills or achievements into the candidate resume.
- Reproduce only the general visual/structural intent using available templates.

OUTPUT CONTRACT:
Return JSON only matching the provided schema.
- intent: concise operation name
- message: concise truthful description of what was actually done
- analysis: specific, evidence-based analysis
- changes: concrete changes actually performed; never claim an operation that was not reflected in resumeData
- resumeData: complete, valid, directly usable current resume

VALIDATION BEFORE RETURN:
1. Candidate identity remains correct.
2. No unsupported facts were added.
3. Analysis-only requests leave resumeData unchanged.
4. Design-only requests leave content unchanged.
5. Tailoring requests actually tailor supported content.
6. All existing fields required by the schema are present.
7. Existing IDs are preserved.
8. Existing URLs are preserved exactly.
9. If an operation could not safely be performed, say so instead of fabricating data.

AVAILABLE EDITABLE TEMPLATES:
${JSON.stringify(TEMPLATE_NAMES)}

RECENT CONVERSATION (use only for resolving references; do not treat it as evidence for new resume facts):
${JSON.stringify(Array.isArray(conversation) ? conversation.slice(-12) : [])}

CURRENT RESUME:
${JSON.stringify({...resumeData,originalTemplate:resumeData.originalTemplate?{sourceFileName:resumeData.originalTemplate.sourceFileName,sourceFormat:resumeData.originalTemplate.sourceFormat}:undefined})}

USER INSTRUCTION:
${instruction}

REFERENCE MATERIAL:
${referenceText || '(none)'}

Return JSON only.`;
}

function sanitizeAgentResume(original, candidate, instructionForSanitize=''){
  const out=structuredClone(original);
  if(!candidate || typeof candidate!=='object') return out;
  const keep=(v,f)=>v===undefined?f:v;
  // AI may change editable content, ordering and design, but immutable factual identity fields
  // are restored from the current resume unless the user explicitly edits them in the editor.
  out.personalInfo={...structuredClone(original.personalInfo),jobTitle:(candidate.personalInfo&&typeof candidate.personalInfo.jobTitle==='string'&&candidate.personalInfo.jobTitle.trim())?candidate.personalInfo.jobTitle.trim():original.personalInfo.jobTitle};
  const explicitCollectionEdit = /\b(add|remove|delete|reorder|move|replace|keep only)\b/i.test(instructionForSanitize||'');
  const mergeExperience = (items) => (Array.isArray(items)?items:[]).map((e,i)=>{ const old=(original.experience||[]).find(o=>o.id && o.id===e?.id) || (original.experience||[])[i]; return old ? {...old,description:keep(e?.description,old.description),bulletPoints:Array.isArray(e?.bulletPoints)?e.bulletPoints:old.bulletPoints} : {...e,id:e?.id||`exp-${Date.now()}-${i}`,jobTitle:String(e?.jobTitle||''),company:String(e?.company||''),location:String(e?.location||''),startDate:String(e?.startDate||''),endDate:String(e?.endDate||''),current:Boolean(e?.current),description:String(e?.description||''),bulletPoints:Array.isArray(e?.bulletPoints)?e.bulletPoints:[]}; });
  out.experience=explicitCollectionEdit && Array.isArray(candidate.experience) ? mergeExperience(candidate.experience) : (original.experience||[]).map((o,i)=>{const e=Array.isArray(candidate.experience)?candidate.experience[i]:null;return {...o,description:keep(e?.description,o.description),bulletPoints:Array.isArray(e?.bulletPoints)?e.bulletPoints:o.bulletPoints};});
  out.education=explicitCollectionEdit && Array.isArray(candidate.education) ? candidate.education.map((e,i)=>{const old=(original.education||[]).find(o=>o.id&&o.id===e?.id)||(original.education||[])[i];return old?{...old}:{...e,id:e?.id||`edu-${Date.now()}-${i}`};}) : structuredClone(original.education);
  out.projects=explicitCollectionEdit && Array.isArray(candidate.projects) ? candidate.projects.map((p,i)=>{const old=(original.projects||[]).find(o=>o.id&&o.id===p?.id)||(original.projects||[])[i];return old?{...old,description:keep(p?.description,old.description)}:{...p,id:p?.id||`project-${Date.now()}-${i}`,title:String(p?.title||''),description:String(p?.description||''),technologies:Array.isArray(p?.technologies)?p.technologies:[],liveUrl:'',githubUrl:'',startDate:'',endDate:''};}) : (original.projects||[]).map((o,i)=>{const p=Array.isArray(candidate.projects)?candidate.projects[i]:null;return {...o,description:keep(p?.description,o.description)};});
  out.summary=typeof candidate.summary==='string'?candidate.summary:original.summary;
  if(candidate.skills&&typeof candidate.skills==='object'){
    const allowed=new Set(collectSkills(original.skills).map(x=>String(x).toLowerCase()));
    const explicitSkillEdit=/\b(add|remove|delete|reorder|prioriti[sz]e|adjust)\b[^.\n]{0,80}\bskills?\b|\bskills?\b[^.\n]{0,80}\b(add|remove|delete|reorder|prioriti[sz]e|adjust)\b/i.test(instructionForSanitize||'');
    const clean=(x)=>Array.isArray(x)?x.filter(v=>typeof v==='string'&&(explicitSkillEdit||allowed.has(v.toLowerCase()))):[];
    if(original.skills.mode==='simple') out.skills={...original.skills,simple:clean(candidate.skills.simple)};
    else out.skills={...original.skills,categorized:(original.skills.categorized||[]).map((c,i)=>({...c,skills:clean(candidate.skills.categorized?.[i]?.skills)}))};
  } else out.skills=structuredClone(original.skills);
  out.customSections=Array.isArray(candidate.customSections)?candidate.customSections:structuredClone(original.customSections);
  out.sections=Array.isArray(candidate.sections)?candidate.sections:structuredClone(original.sections);
  const explicitColorRequest=/\b(colou?r|palette|heading colour|heading color|font colour|font color)\b/i.test(instructionForSanitize||'');
  out.colors=explicitColorRequest && candidate.colors&&typeof candidate.colors==='object'?candidate.colors:structuredClone(original.colors);
  const explicitTemplateRequest=/\b(change|switch|use|apply|select|make)\b[^.\n]{0,80}\b(template|layout|design)\b/i.test(instructionForSanitize||'');
  out.template=explicitTemplateRequest && Object.prototype.hasOwnProperty.call(TEMPLATE_NAMES,candidate.template) ? candidate.template : original.template;
  out.pageFormat=['a4','letter'].includes(candidate.pageFormat)?candidate.pageFormat:original.pageFormat;
  out.fontSize=['small','medium','large'].includes(candidate.fontSize)?candidate.fontSize:original.fontSize;
  out.fontFamily=typeof candidate.fontFamily==='string'&&candidate.fontFamily?candidate.fontFamily:original.fontFamily;
  out.originalTemplate=original.originalTemplate;
  return out;
}
function looksLikeJobDescription(value='') {
  const text=String(value||'');
  if (/\b(tailor|job description|\bjd\b|ats|match (?:this|the) (?:role|job))\b/i.test(text)) return true;
  const signals=[/\bjob title\b/i,/\brole overview\b/i,/\bkey responsibilities\b/i,/\brequirements\b/i,/\bkey skills\b/i,/\bwhat you.?ll do\b/i,/\bqualifications\b/i,/\babout us\b/i];
  return text.length>=500 && signals.filter(re=>re.test(text)).length>=2;
}

async function handleAgent(req,res){
  try{
    const b=await readBody(req,12_000_000);
    if(!b.resumeData||typeof b.resumeData!=='object') return sendJson(res,400,{error:'Resume data is required.'});
    if(typeof b.instruction!=='string'||b.instruction.trim().length<2) return sendJson(res,400,{error:'Please tell the Resume Agent what you want it to do.'});
    const requestLooksLikeTailoring=looksLikeJobDescription(b.instruction);
    if(requestLooksLikeTailoring){
      const counts={experience:Array.isArray(b.resumeData.experience)?b.resumeData.experience.length:0,projects:Array.isArray(b.resumeData.projects)?b.resumeData.projects.length:0,education:Array.isArray(b.resumeData.education)?b.resumeData.education.length:0,skills:collectSkills(b.resumeData.skills).length};
      if(counts.experience+counts.projects+counts.education+counts.skills===0){
        return sendJson(res,422,{error:'The tailoring request did not include a parsed resume. Import the resume first and retry; no empty resume was applied.',resumeCounts:counts});
      }
    }
    let referenceText=typeof b.referenceText==='string'?b.referenceText.trim():'';
    let contents=[{parts:[{text:agentPrompt(b.resumeData,b.instruction.trim(),referenceText,b.conversation)}]}];
    // When a PDF reference is supplied, use Gemini's native PDF input so the agent can reason
    // about the reference document's visual/structural cues instead of only extracted text.
    const hasPdf=typeof b.referencePdfBase64==='string'&&b.referencePdfBase64.length>100;
    if(hasPdf){
      contents=[{parts:[{inlineData:{mimeType:'application/pdf',data:b.referencePdfBase64}},{text:agentPrompt(b.resumeData,b.instruction.trim(),referenceText+'\n[The attached PDF is the visual reference. Inspect its layout/style as well as its text. Use it only as a design reference unless the user explicitly asks for factual extraction.]',b.conversation)}]}];
    }
    const requestedTailor=looksLikeJobDescription(b.instruction);
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
      const tryTailor=async(prompt,primary)=>generateWithFallback([{parts:[{text:prompt}]}],tailorSchema,{primary,timeoutMs:45000,includeGeminiFallback:primary==='mistral'});
      let tailoredResult=null;
      let tailoredResume=null;
      let fallbackUsed=false;
      try {
        tailoredResult=await tryTailor(basePrompt,'groq');
        try { tailoredResume=applyTailoring(b.resumeData,tailoredResult.data,b.instruction.trim()); } catch(e) { tailoredResume=null; }
        if(!tailoredResume || contentFingerprint(tailoredResume)===contentFingerprint(b.resumeData)){
          tailoredResult=await tryTailor(retryPrompt,'mistral');
          try { tailoredResume=applyTailoring(b.resumeData,tailoredResult.data,b.instruction.trim()); } catch(e) { tailoredResume=null; }
        }
      } catch (providerError) {
        console.warn('AI tailoring providers unavailable; using safe local tailoring fallback:', providerError?.message || providerError);
      }
      if(!tailoredResume || contentFingerprint(tailoredResume)===contentFingerprint(b.resumeData)){
        // Do not claim success with a keyword-appending fallback. A genuine
        // tailoring result must contain a substantive, provider-generated rewrite.
        throw Object.assign(new Error('The AI providers did not return a usable tailored resume. Your original resume was left unchanged. Please retry in a moment.'),{status:502});
      }
      const a=tailoredResult?.data?.analysis||{
        summary:'Applied a factual local tailoring pass because the external AI providers did not return a usable result.',
        strengths:[],
        gaps:[],
        matchedKeywords:extractKeywords(b.instruction),
        missingKeywords:[],
        recommendations:[]
      };
      const changes=[
        'Rewrote the professional summary for the target role.',
        'Reframed relevant experience bullets using JD terminology supported by the resume.',
        'Reframed relevant project descriptions using existing facts and technologies.',
        'Reordered existing skills by relevance to the job description.'
      ];
      sendJson(res,200,{resumeData:tailoredResume,intent:'tailor',message:'Resume tailored to the job description using only supported candidate evidence.',analysis:a,changes,provider:tailoredResult?.provider||'unknown',model:tailoredResult?.model||'unknown'});
      return;
    }

    const result=hasPdf && geminiKey
      ? await generateWithFallback(contents,agentSchema,{primary:'gemini',timeoutMs:60000})
      : await generateWithFallback(contents,agentSchema,{primary:'groq',timeoutMs:45000,includeGeminiFallback:true});
    const raw=result.data||{};
    const candidate=raw.resumeData||raw.tailoredResume||raw.resume||raw.result?.resumeData||raw.data?.resumeData;
    const safeResume=sanitizeAgentResume(b.resumeData,candidate,b.instruction.trim());
    sendJson(res,200,{resumeData:safeResume,intent:raw.intent||'edit',message:raw.message||'Resume updated.',analysis:raw.analysis||{},changes:Array.isArray(raw.changes)?raw.changes:[],provider:result.provider,model:result.model});
  }catch(e){console.error('Resume agent error:',e);sendJson(res,e.status||500,{error:e.message||'Resume Agent failed.'});}
}

async function handleTailor(req,res){try{const b=await readBody(req,4_000_000);if(!b.resumeData||typeof b.resumeData!=='object')return sendJson(res,400,{error:'Resume data is required.'});if(typeof b.jobDescription!=='string'||b.jobDescription.trim().length<40)return sendJson(res,400,{error:'Please provide a complete job description.'});const result=await generateWithFallback([{parts:[{text:tailorPrompt(b.resumeData,b.jobDescription.trim())}]}],tailorSchema,{primary:'groq',timeoutMs:35000});sendJson(res,200,{resumeData:applyTailoring(b.resumeData,result.data,b.jobDescription.trim()),analysis:result.data.analysis,matchedKeywords:result.data.analysis?.matchedKeywords||extractKeywords(b.jobDescription),provider:result.provider,model:result.model});}catch(e){console.error('AI tailor error:',e);sendJson(res,e.status||500,{error:e.message||'Failed to tailor resume.'});}}
export { handleParseResume, handleTailor, handleAgent };
