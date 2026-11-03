#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import {createHash,randomUUID} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import {getDb,REPO_ROOT} from './lib/db.mjs';
import {parseCsv} from './lib/csv.mjs';
import {table} from './lib/format.mjs';
const specs={
 help:[],practices:[],cases:[],orders:[],'due-board':[],'bench-load':[],'approval-chase':[],lots:[],
 'lot-trace':['lot'],remakes:[],compliance:[],activity:[],order:['order'],
 'add-practice':['code','name','owner','review','purpose','actor'],
 'add-case':['code','practice','patient-ref','prescription','jurisdiction','actor'],
 'add-order':['code','case','product','units','technician','received','due','remake-of','reason','actor'],
 'add-task':['order','label','technician','due','actor'],
 'finish-task':['task','date','evidence','actor'],
 'move-order':['order','to','evidence','actor'],
 'add-lot':['code','material','supplier','expires','evidence','actor'],
 'use-lot':['order','lot','quantity','unit','date','actor'],
 'record-qc':['order','result','date','manufactured','evidence','actor'],
 dispatch:['order','date','reference','actor'],
 'review-case':['case','jurisdiction','kind','classification-evidence','implantable','prescription','statement','conformity','actor'],
 retention:['order','until','actor'],
 'review-practice':['practice','review','purpose','actor'],
 import:['file','mapping','dry-run','actor'],export:['file'],
 'weekly-review':[],'draft-chase':['order']
};
export const commands=Object.keys(specs);
const readQueries={
 practices:'SELECT code,name,owner,review_on,purpose FROM practices ORDER BY code',
 cases:'SELECT c.code,p.name AS practice,c.patient_ref,c.prescription_ref,c.jurisdiction,c.device_kind FROM cases c JOIN practices p ON p.id=c.practice_id ORDER BY c.code',
 orders:'SELECT * FROM order_desk ORDER BY due_on,code',
 'due-board':'SELECT * FROM due_board ORDER BY due_on,code',
 'bench-load':'SELECT * FROM bench_load ORDER BY overdue_tasks DESC,technician',
 'approval-chase':"SELECT code,practice,product,due_on,CURRENT_DATE-stage_since AS waiting_days FROM order_desk WHERE stage='approval' ORDER BY stage_since,code",
 lots:'SELECT code,material,supplier,expires_on,evidence FROM lots ORDER BY expires_on,code',
 remakes:'SELECT o.code,p.code AS original,c.code AS case_code,o.remake_reason,o.stage,o.due_on FROM orders o JOIN orders p ON p.id=o.remake_of JOIN cases c ON c.id=o.case_id ORDER BY o.due_on',
 compliance:'SELECT * FROM compliance_findings ORDER BY rule,record',
 activity:'SELECT * FROM activity ORDER BY created_at,id'
};
const tables=['practices','cases','orders','tasks','lots','lot_usage','qc_reviews','imports','activity'];
const today=()=>new Date().toISOString().slice(0,10);
export function date(value,label='date'){
 if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value)||!Number.isFinite(Date.parse(value+'T00:00:00Z'))||new Date(value+'T00:00:00Z').toISOString().slice(0,10)!==value)throw Error(`${label} must be a real YYYY-MM-DD date`);
 return value;
}
function required(f,k){const s=f[k];if(typeof s!=='string'||!s.trim())throw Error(`--${k} is required`);return s.trim();}
function num(v,label,integer=false){if(!/^(?:0|[1-9]\d*)(?:\.\d{1,4})?$/.test(String(v))||!Number.isFinite(Number(v))||Number(v)<=0||Number(v)>1e8||(integer&&!Number.isInteger(Number(v))))throw Error(`${label} must be a positive ${integer?'integer':'number (up to four decimal places)'}`);return Number(v);}
function historic(v,label){const d=date(v,label);if(d>today())throw Error(`${label} cannot be in the future`);return d;}
export function parse(args){
 const [command='help',...rest]=args;const f={};let vendor;
 for(const s of rest){if(command==='import'&&s==='labtrac'&&!vendor){vendor=s;continue;}if(!s.startsWith('--'))throw Error(`Unexpected argument: ${s}`);
 const at=s.indexOf('=');const k=s.slice(2,at<0?undefined:at),v=at<0?true:s.slice(at+1);if(k in f)throw Error(`Duplicate flag: ${k}`);f[k]=v;}
 if(command==='import'&&vendor!=='labtrac')throw Error('Use import labtrac --file=...');
 return {command,flags:f};
}
function validate(command,f){if(!specs[command])throw Error(`Unknown command ${command}. Use help.`);for(const k of Object.keys(f)){if(![...specs[command],'json'].includes(k))throw Error(`Unknown --${k} for ${command}`);if(['json','dry-run'].includes(k)){if(f[k]!==true)throw Error(`--${k} is a switch`);}else required(f,k);}}
async function resolve(db,kind,value){
 if(!tables.includes(kind))throw Error('Invalid record type');const field=kind==='tasks'?'label':'code';
 const rows=await db.query(`SELECT * FROM ${kind} WHERE lower(${field})=lower($1) OR id::text=$1 ORDER BY id`,[value]);
 if(rows.length===1)return rows[0];
 const found=rows.length?rows:await db.query(`SELECT * FROM ${kind} WHERE starts_with(lower(${field}),lower($1)) OR starts_with(id::text,lower($1)) ${kind==='practices'?'OR starts_with(lower(name),lower($1))':''} ORDER BY ${field},id`,[value]);
 if(found.length!==1)throw Error(found.length?`Ambiguous ${kind}:\n${found.map(r=>`${r.id}  ${r[field]}${r.name?'  '+r.name:''}`).join('\n')}`:`No match for ${kind}: ${value}`);
 return found[0];
}
async function audit(db,kind,record,actor,detail){await db.query('INSERT INTO activity(kind,record_id,actor,detail) VALUES($1,$2,$3,$4)',[kind,record?.id||null,actor,JSON.stringify(detail)]);}
async function lockedOrder(db,value){const o=await resolve(db,'orders',value);return (await db.query('SELECT * FROM orders WHERE id=$1 FOR UPDATE',[o.id]))[0];}
function editable(o){if(['ready','dispatched','cancelled'].includes(o.stage))throw Error(`Order is ${o.stage}; production edits are closed`);}
async function insert(db,kind,obj){const keys=Object.keys(obj);return (await db.query(`INSERT INTO ${kind}(${keys.join(',')}) VALUES(${keys.map((_,i)=>'$'+(i+1)).join(',')}) RETURNING *`,Object.values(obj)))[0];}
function privateFile(folder,label,body){const base=path.resolve(process.env.OUTPUT_DIR||REPO_ROOT,folder);fs.mkdirSync(base,{recursive:true,mode:0o700});const file=path.join(base,`${label}-${randomUUID()}.md`);fs.writeFileSync(file,body,{flag:'wx',mode:0o600});return {file};}
const humanColumns={
 'due-board':['code','practice','stage','due_on','open_tasks','recorded_lots'],
 'lot-trace':['order_code','practice','lot_code','quantity','unit','delivery_ref'],
 orders:['code','practice','product','technician','stage','due_on'],
 activity:['kind','record_id','actor','created_at','detail']
};
function readable(rows,columns){if(!rows.length)return 'No records.';return table(rows,(columns||Object.keys(rows[0])).map(k=>({key:k,label:k})));}
function human(result,command){
 if(Array.isArray(result))return readable(result,humanColumns[command]);
 if(command==='order')return Object.entries(result).map(([name,value])=>`${name.toUpperCase()}\n${Array.isArray(value)?readable(value):Object.entries(value).map(([k,v])=>`${k}: ${v??''}`).join('\n')}`).join('\n\n');
 return Object.entries(result).map(([k,v])=>`${k}: ${v&&typeof v==='object'?JSON.stringify(v):v??''}`).join('\n');
}
async function importCsv(db,f){
 const file=required(f,'file'),raw=fs.readFileSync(file,'utf8');const rows=parseCsv(raw);if(!rows.length)throw Error('No data rows in CSV');
 const mapping=f.mapping?JSON.parse(fs.readFileSync(f.mapping,'utf8')):{};
 const fields=['practice_code','practice_name','case_code','patient_ref','order_code','product','units','technician','received_on','due_on','prescription_ref','jurisdiction'];
 for(const [k,v] of Object.entries(mapping))if(!fields.includes(k)||typeof v!=='string'||!Object.keys(rows[0]).includes(v))throw Error(`Invalid mapping ${k}`);
 const mapped=rows.map((row,i)=>{
  const r={};for(const k of fields)r[k]=String(row[mapping[k]||k]??'').trim();
  for(const k of fields.filter(k=>!['prescription_ref','jurisdiction'].includes(k)))if(!r[k])throw Error(`CSV row ${i+2}: missing ${k}; provide --mapping if headings differ`);
  r.units=num(r.units,'units',true);date(r.received_on,'received_on');date(r.due_on,'due_on');historic(r.received_on,'received_on');
  if(r.due_on<r.received_on)throw Error(`CSV row ${i+2}: due_on precedes received_on`);
  r.jurisdiction=r.jurisdiction||'unknown';if(!['AU','NZ','other','unknown'].includes(r.jurisdiction))throw Error('Unknown jurisdiction');
  return {...r,source_row:row};
 });
 if(new Set(mapped.map(r=>r.order_code.toLowerCase())).size!==mapped.length)throw Error('Duplicate order code in file');
 const digest=createHash('sha256').update(raw+'\n'+JSON.stringify(mapping)).digest('hex');
 if((await db.query('SELECT id FROM imports WHERE digest=$1',[digest])).length)return {already_imported:true,imported:0};
 for(const r of mapped){
  if((await db.query('SELECT id FROM orders WHERE lower(code)=lower($1)',[r.order_code])).length)throw Error(`Existing order ${r.order_code} will not be overwritten`);
  let p=(await db.query('SELECT * FROM practices WHERE lower(code)=lower($1)',[r.practice_code]))[0];
  if(p&&p.name!==r.practice_name)throw Error(`Conflicting practice ${r.practice_code}`);
  if(!p)p=await insert(db,'practices',{code:r.practice_code,name:r.practice_name,owner:required(f,'actor'),review_on:today(),purpose:'Imported lab contact; purpose requires operator review'});
  let c=(await db.query('SELECT * FROM cases WHERE lower(code)=lower($1)',[r.case_code]))[0];
  if(c&&(c.practice_id!==p.id||c.patient_ref!==r.patient_ref||c.jurisdiction!==r.jurisdiction||c.prescription_ref!==(r.prescription_ref||null)))throw Error(`Conflicting case ${r.case_code}`);
  if(!c)c=await insert(db,'cases',{code:r.case_code,practice_id:p.id,patient_ref:r.patient_ref,prescription_ref:r.prescription_ref||null,jurisdiction:r.jurisdiction});
  await insert(db,'orders',{code:r.order_code,case_id:c.id,product:r.product,units:r.units,technician:r.technician,received_on:r.received_on,due_on:r.due_on,source_row:JSON.stringify(r.source_row)});
 }
 const entry=await insert(db,'imports',{digest,original_csv:raw,mapping:JSON.stringify(mapping),actor:required(f,'actor'),row_count:mapped.length});
 return {id:entry.id,imported:mapped.length,dry_run:Boolean(f['dry-run']),note:'Imported as received for reconciliation; source fields preserved, no production approval inferred'};
}
export async function run(db,command,f={}){
 validate(command,f);
 if(command==='help')return commands.map(name=>({command:name,flags:specs[name].map(k=>'--'+k).join(' ')}));
 if(readQueries[command])return db.query(readQueries[command]);
 if(command==='order'){
  const o=await resolve(db,'orders',required(f,'order'));
  return {order:(await db.query('SELECT * FROM order_desk WHERE id=$1',[o.id]))[0],tasks:await db.query('SELECT * FROM tasks WHERE order_id=$1 ORDER BY due_on,id',[o.id]),materials:await db.query('SELECT * FROM traceability WHERE order_code=$1 ORDER BY lot_code',[o.code]),quality:await db.query('SELECT * FROM qc_reviews WHERE order_id=$1 ORDER BY created_at,id',[o.id]),history:await db.query('SELECT * FROM activity WHERE record_id=$1 ORDER BY created_at,id',[o.id])};
 }
 if(command==='lot-trace'){const l=await resolve(db,'lots',required(f,'lot'));return db.query('SELECT * FROM traceability WHERE lot_code=$1 ORDER BY order_code',[l.code]);}
 if(command==='weekly-review'){
  const sections=[];for(const k of ['due-board','bench-load','approval-chase'])sections.push(`## ${k}\n\n${readable(await run(db,k))}`);
  return privateFile('drafts','weekly-review',`# Lab weekly review\n\nGenerated ${today()} from recorded work. Review with the lab manager. Nothing sent.\n\n${sections.join('\n\n')}\n`);
 }
 if(command==='draft-chase'){const {order:o}=await run(db,'order',f);if(o.stage!=='approval')throw Error('Order is not awaiting dentist approval');return privateFile('drafts','approval-chase',`# Draft only: ${o.code}\n\nTo: ${o.practice}\n\nOur lab record shows ${o.code}, ${o.product}, awaiting your review since ${o.stage_since}. The current due date is ${o.due_on}. Please confirm the return or approval through your usual secure channel.\n\nOperator: check the case and recipient before sending.\n`);}
 if(command==='export'){
  const file=path.resolve(required(f,'file'));await db.exec('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
  try{const data={format:'dental-lab-snapshot-v1',exported_at:new Date().toISOString(),tables:{}};for(const t of [...tables,'schema_migrations'])data.tables[t]=await db.query(`SELECT * FROM ${t} ORDER BY ${t==='schema_migrations'?'name':'id'}`);fs.mkdirSync(path.dirname(file),{recursive:true,mode:0o700});fs.writeFileSync(file,JSON.stringify(data,null,2)+'\n',{flag:'wx',mode:0o600});return {file,records:tables.reduce((n,t)=>n+data.tables[t].length,0)};}finally{await db.exec('ROLLBACK');}
 }
 const actor=required(f,'actor');await db.exec('BEGIN');
 try{
  let result;
  if(command==='add-practice')result=await insert(db,'practices',{code:required(f,'code'),name:required(f,'name'),owner:required(f,'owner'),review_on:date(required(f,'review')),purpose:required(f,'purpose')});
  else if(command==='add-case'){
   const p=await resolve(db,'practices',required(f,'practice'));
   result=await insert(db,'cases',{code:required(f,'code'),practice_id:p.id,patient_ref:required(f,'patient-ref'),prescription_ref:f.prescription||null,jurisdiction:f.jurisdiction||'unknown'});
  }else if(command==='add-order'){
   const c=await resolve(db,'cases',required(f,'case'));let original;
   if(f['remake-of']){original=await resolve(db,'orders',f['remake-of']);if(original.case_id!==c.id)throw Error('Remake must belong to the same case');required(f,'reason');}
   if(f.reason&&!original)throw Error('--reason requires --remake-of');
   result=await insert(db,'orders',{code:required(f,'code'),case_id:c.id,product:required(f,'product'),units:num(required(f,'units'),'units',true),technician:required(f,'technician'),received_on:historic(required(f,'received'),'received'),due_on:date(required(f,'due')),remake_of:original?.id||null,remake_reason:f.reason||null});
  }else if(command==='add-task'){
   const o=await lockedOrder(db,required(f,'order'));editable(o);
   result=await insert(db,'tasks',{order_id:o.id,label:required(f,'label'),technician:required(f,'technician'),due_on:date(required(f,'due'))});
  }else if(command==='finish-task'){
   let t=await resolve(db,'tasks',required(f,'task'));const o=await lockedOrder(db,t.order_id);editable(o);t=(await db.query('SELECT * FROM tasks WHERE id=$1 FOR UPDATE',[t.id]))[0];
   if(t.done_on)throw Error('Task already complete');const done=historic(required(f,'date'),'date');if(done<o.received_on)throw Error('Task completion precedes receipt');
   result=(await db.query('UPDATE tasks SET done_on=$2,evidence=$3 WHERE id=$1 RETURNING *',[t.id,done,required(f,'evidence')]))[0];
  }else if(command==='move-order'){
   const o=await lockedOrder(db,required(f,'order')),to=required(f,'to');
   const allowed={received:['production','cancelled'],production:['approval','qc','cancelled'],approval:['production','cancelled'],qc:['production','cancelled']};
   if(!allowed[o.stage]?.includes(to))throw Error(`Invalid transition ${o.stage} -> ${to}`);required(f,'evidence');
   result=(await db.query('UPDATE orders SET stage=$2,stage_since=CURRENT_DATE WHERE id=$1 RETURNING *',[o.id,to]))[0];
  }else if(command==='add-lot')result=await insert(db,'lots',{code:required(f,'code'),material:required(f,'material'),supplier:required(f,'supplier'),expires_on:date(required(f,'expires')),evidence:required(f,'evidence')});
  else if(command==='use-lot'){
   const o=await lockedOrder(db,required(f,'order'));editable(o);if(o.stage!=='production')throw Error('Material use requires production stage');
   const l=await resolve(db,'lots',required(f,'lot')),d=historic(required(f,'date'),'date');if(d<o.received_on||d>l.expires_on)throw Error('Material date precedes receipt or is after lot expiry');
   result=await insert(db,'lot_usage',{order_id:o.id,lot_id:l.id,quantity:num(required(f,'quantity'),'quantity'),unit:required(f,'unit'),used_on:d,actor});
  }else if(command==='record-qc'){
   const o=await lockedOrder(db,required(f,'order'));if(o.stage!=='qc')throw Error('Quality review requires qc stage');
   const outcome=required(f,'result');if(!['pass','fail'].includes(outcome))throw Error('result must be pass or fail');
   const reviewed=historic(required(f,'date'),'date');if(reviewed<o.stage_since)throw Error('Review date precedes current quality stage');
   if(outcome==='pass'){
    const made=historic(required(f,'manufactured'),'manufactured');if(made<o.received_on||made>reviewed)throw Error('Invalid manufactured date');
    const c=(await db.query('SELECT * FROM cases WHERE id=$1',[o.case_id]))[0];if(!c.prescription_ref)throw Error('Prescription reference required before release');
    if((await db.query('SELECT id FROM tasks WHERE order_id=$1 AND done_on IS NULL',[o.id])).length)throw Error('Unfinished tasks block release');
    const usage=await db.query('SELECT * FROM lot_usage WHERE order_id=$1',[o.id]);if(!usage.length)throw Error('Record material lots before release');if(usage.some(u=>u.used_on>made))throw Error('Material use after manufactured date');
    if((await db.query('SELECT * FROM compliance_findings WHERE record_id=$1 AND rule IN ($2,$3,$4)',[c.id,'classification review','prescription reference','custom-made evidence'])).length)throw Error('Case evidence review required');
    await db.query("UPDATE orders SET stage='ready',stage_since=CURRENT_DATE,manufactured_on=$2 WHERE id=$1",[o.id,made]);
   }else{await db.query("UPDATE orders SET stage='production',stage_since=CURRENT_DATE WHERE id=$1",[o.id]);}
   result=await insert(db,'qc_reviews',{order_id:o.id,passed:outcome==='pass',evidence:required(f,'evidence'),actor,reviewed_on:reviewed});
  }else if(command==='dispatch'){
   const o=await lockedOrder(db,required(f,'order'));if(o.stage!=='ready')throw Error('Dispatch requires ready stage and a recorded quality pass');
   const last=(await db.query('SELECT * FROM qc_reviews WHERE order_id=$1 ORDER BY created_at DESC,id DESC LIMIT 1',[o.id]))[0];if(!last?.passed)throw Error('Quality pass missing');
   const d=historic(required(f,'date'),'date');if(d<o.manufactured_on||d<last.reviewed_on)throw Error('Dispatch precedes manufacture or quality review');
   const c=(await db.query('SELECT * FROM cases WHERE id=$1',[o.case_id]))[0];if(c.jurisdiction==='unknown')throw Error('Jurisdiction review required before dispatch');
   if((await db.query('SELECT * FROM compliance_findings WHERE record_id IN ($1,$2)',[o.id,c.id])).length)throw Error('Compliance evidence review required before dispatch');
   result=(await db.query("UPDATE orders SET stage='dispatched',stage_since=CURRENT_DATE,dispatched_on=$2,delivery_ref=$3 WHERE id=$1 RETURNING *",[o.id,d,required(f,'reference')]))[0];
  }else if(command==='review-case'){
   const c=await resolve(db,'cases',required(f,'case'));const implant=required(f,'implantable');if(!['yes','no'].includes(implant))throw Error('implantable must be yes or no');
   if(!['custom-made','patient-matched','other'].includes(required(f,'kind')))throw Error('Unsupported device kind');
   result=(await db.query('UPDATE cases SET device_kind=$2,classification_evidence=$3,implantable=$4,prescription_ref=$5,statement_ref=$6,conformity_ref=$7,jurisdiction=$8 WHERE id=$1 RETURNING *',[c.id,f.kind,required(f,'classification-evidence'),implant==='yes',f.prescription||c.prescription_ref,f.statement||c.statement_ref,f.conformity||c.conformity_ref,f.jurisdiction||c.jurisdiction]))[0];
  }else if(command==='retention'){
   const o=await lockedOrder(db,required(f,'order'));result=(await db.query('UPDATE orders SET retain_until=$2 WHERE id=$1 RETURNING *',[o.id,date(required(f,'until'))]))[0];
  }else if(command==='review-practice'){
   const p=await resolve(db,'practices',required(f,'practice'));result=(await db.query('UPDATE practices SET review_on=$2,purpose=$3 WHERE id=$1 RETURNING *',[p.id,date(required(f,'review')),required(f,'purpose')]))[0];
  }else if(command==='import')result=await importCsv(db,f);
  if(!result)throw Error('Command has no implementation');
  if(!result.already_imported)await audit(db,command,{id:result.order_id||result.id},actor,Object.fromEntries(Object.entries(f).filter(([k])=>!['json','file'].includes(k))));
  await db.exec(f['dry-run']?'ROLLBACK':'COMMIT');return result;
 }catch(e){await db.exec('ROLLBACK');throw e;}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href){
 let db;let json=process.argv.includes('--json');
 try{const {command,flags}=parse(process.argv.slice(2));validate(command,flags);db=await getDb();const result=await run(db,command,flags);console.log(json?JSON.stringify(result,null,2):human(result,command));}
 catch(e){console.error(json?JSON.stringify({error:e.message}):e.message);process.exitCode=1;}finally{if(db)await db.close();}
}
