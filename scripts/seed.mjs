import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { cert, initializeApp, deleteApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { VERSION, canonical, digest, invariant, roster, makePlan, assertUnprotected } from './seed-plan.mjs';
import { rankListEntries, reviewRankingCandidate } from '../features/myList.ts';

export function options(args, env=process.env) {
  const mode=args.shift();
  invariant(['dry-run','seed','verify','cleanup'].includes(mode),'Expected dry-run, seed, verify or cleanup.');
  const flags={};
  while(args.length) { const key=args.shift(); invariant(['--project-id','--confirm-project','--namespace','--places-file','--anchor','--real'].includes(key),`Unknown flag ${key}`); invariant(!(key in flags),`Duplicate flag ${key}`); flags[key]=key==='--real'?true:args.shift(); invariant(flags[key],`Missing value for ${key}`); }
  const real=!!flags['--real'];
  const projectId=flags['--project-id'] || (real ? '' : 'demo-the-list');
  invariant(projectId,'Real mode requires --project-id.');
  if(real) {
    invariant(!env.FIREBASE_AUTH_EMULATOR_HOST && !env.FIRESTORE_EMULATOR_HOST,'Real mode refuses emulator variables.');
    invariant(env.SEED_FIREBASE_PROJECT_ID===projectId,'SEED_FIREBASE_PROJECT_ID must match --project-id.');
    invariant(!projectId.startsWith('demo-'),'Real mode refuses demo project IDs.');
    if(['seed','cleanup'].includes(mode)) invariant(flags['--confirm-project']===projectId && env.SEED_ALLOW_REAL_WRITE===projectId,'Real writes require --confirm-project and SEED_ALLOW_REAL_WRITE matching the verified project ID. Obtain human approval first.');
  } else {
    invariant(projectId.startsWith('demo-'),'Emulator project ID must start with demo-.');
    for(const key of ['FIREBASE_AUTH_EMULATOR_HOST','FIRESTORE_EMULATOR_HOST']) invariant(/^(127\.0\.0\.1|localhost):\d+$/.test(env[key]??''),`Set ${key} to a loopback emulator endpoint. No fallback to live services.`);
  }
  const namespace=flags['--namespace']||'v1seed'; roster(namespace);
  return {mode,real,projectId,namespace,placesFile:flags['--places-file'],anchor:flags['--anchor']};
}

async function optionalUser(auth, field, value) {
  try {return await (field==='email'?auth.getUserByEmail(value):auth.getUser(value));}
  catch(e) {if(e.code==='auth/user-not-found')return null;throw e;}
}
export async function execute(o) {
  let credential;
  if(o.real) {
    // Explicit service account file avoids silently targeting a different ADC project.
    invariant(process.env.GOOGLE_APPLICATION_CREDENTIALS,'Set GOOGLE_APPLICATION_CREDENTIALS to a service-account JSON file outside the repository.');
    const key=JSON.parse(await readFile(process.env.GOOGLE_APPLICATION_CREDENTIALS,'utf8'));
    invariant(key.project_id===o.projectId,'Credential project_id does not match selected project.');
    credential=cert(key);
  }
  const app=initializeApp({projectId:o.projectId,...(credential?{credential}:{})},`seed-${Date.now()}`);
  const auth=getAuth(app), db=getFirestore(app);
  try {
    // Read-only resolution on every invocation, before any plan, account or document mutation.
    const protectedUser=await optionalUser(auth,'email','test@gmail.com');
    invariant(protectedUser,'Protected test@gmail.com is absent. Refusing all operations; import its Auth record into the emulator or create a disposable emulator-only sentinel yourself. Never create/change it using this script.');
    const protectedUid=protectedUser.uid;
    const root=db.doc(`seedRuns/${o.namespace}`);
    const prior=await root.get();
    const metadata=prior.data();
    if(metadata) invariant(metadata.version===VERSION && metadata.projectId===o.projectId && metadata.protectedUid===protectedUid,'Manifest version, project or protected UID mismatch.');
    const protectedReviews=await db.collection('reviews').where('userId','==',protectedUid).get();
    const protectedPlaces=new Set(protectedReviews.docs.map(d=>d.get('placeId')));
    const protectedList=await db.collection(`users/${protectedUid}/list`).get();
    protectedList.docs.forEach(d=>protectedPlaces.add(d.id));
    const safe=(path,data)=>assertUnprotected(path,data,protectedUid);
    const records=await root.collection('documents').get();
    const recorded=new Map(records.docs.map(row=>[row.get('path'),row]));
    if(metadata) {
      const frozen=new Map(makePlan(o.namespace,metadata.googleIds,metadata.anchor).documents.map(d=>[d.path,d]));
      for(const row of records.docs) {
        const expected=frozen.get(row.get('path'));
        invariant(expected && digest(expected.data)===row.get('hash'),'Ownership ledger does not match the frozen seed plan.');
      }
    }
    const accounts=roster(o.namespace);
    for(const account of accounts) invariant(account.uid!==protectedUid,'Seed UID collides with protected user.');
    async function accountCheck(account) {
      const [byUid,byEmail]=await Promise.all([optionalUser(auth,'uid',account.uid),optionalUser(auth,'email',account.email)]);
      if(byUid || byEmail) invariant(byUid?.uid===byEmail?.uid && byUid.email===account.email && byUid.customClaims?.listSeed===o.namespace && metadata?.accountIds?.includes(account.uid),`Auth collision or unowned account ${account.uid}; refusing to adopt/modify it.`);
      return byUid;
    }
    const existingAccounts=[];
    for(const account of accounts) existingAccounts.push(await accountCheck(account));
    async function checkRecord(row) {
      const path=row.get('path'); const snap=await db.doc(path).get();
      safe(path,snap.data());
      if(snap.exists) invariant(digest(snap.data())===row.get('hash'),`Seed document changed since creation: ${path}. No overwrite/delete allowed.`);
      return snap;
    }
    if(o.mode==='cleanup') {
      invariant(metadata || records.empty,'Orphan manifest records.');
      if(!metadata) {console.log('No seed run to clean up.');return;}
      // Preflight EVERYTHING before deleting anything. Cross-boundary relationships halt cleanup.
      const owned=new Set(recorded.keys());
      for(const row of records.docs) await checkRecord(row);
      for(const account of accounts) {
        const [reviews,friends,names]=await Promise.all([
          db.collection('reviews').where('userId','==',account.uid).get(),
          db.collection('friendships').where('userIds','array-contains',account.uid).get(),
          db.collection('usernames').where('uid','==',account.uid).get()]);
        for(const doc of [...reviews.docs,...friends.docs,...names.docs]) {safe(doc.ref.path,doc.data()); invariant(owned.has(doc.ref.path),`Unowned reference blocks cleanup: ${doc.ref.path}`);}
        for(const collection of await db.doc(`users/${account.uid}`).listCollections()) {
          for(const doc of (await collection.get()).docs) invariant(owned.has(doc.ref.path),`Unowned user data blocks cleanup: ${doc.ref.path}`);
        }
      }
      const retainedPlaces=new Set();
      for(const row of records.docs.filter(r=>r.get('path').startsWith('places/'))) {
        const id=row.get('path').split('/')[1];
        const refs=await db.collection('reviews').where('placeId','==',id).get();
        const lists=await db.collectionGroup('list').where('placeId','==',id).get();
        if(protectedPlaces.has(id) || [...refs.docs,...lists.docs].some(d=>!owned.has(d.ref.path))) retainedPlaces.add(row.get('path'));
      }
      // Never recursively delete a collection or Auth user. Only ledger paths, with CAS checks.
      const ordered=records.docs.sort((a,b)=>Number(a.get('path').startsWith('places/'))-Number(b.get('path').startsWith('places/')));
      for(const row of ordered) {
        if(retainedPlaces.has(row.get('path'))) continue;
        await db.runTransaction(async tx=>{
          const ref=db.doc(row.get('path'));const snapshot=await tx.get(ref);safe(ref.path,snapshot.data());
          invariant(!snapshot.exists || digest(snapshot.data())===row.get('hash'),`Concurrent change: ${ref.path}`);
          if(snapshot.exists)tx.delete(ref);tx.delete(row.ref);
        });
      }
      for(const account of accounts) if(await accountCheck(account)) await auth.deleteUser(account.uid);
      // Retained shared places and ownership records remain for future safe cleanup.
      if(!retainedPlaces.size) await root.delete();
      console.log(JSON.stringify({cleaned:true,retainedSharedPlaces:[...retainedPlaces]},null,2));return;
    }
    let sourceFile;
    if(o.placesFile) {
      sourceFile=JSON.parse(await readFile(o.placesFile,'utf8'));
      invariant(Array.isArray(sourceFile) && sourceFile.every(p=>typeof p==='string'),'Places file must be a JSON array of genuine Google Place ID strings.');
      if(metadata) invariant(metadata.sourceFileHash===digest(sourceFile),'Places file differs from the frozen run input.');
    }
    let ids=metadata?.googleIds;
    if(!ids) {
      const places=await db.collection('places').get();
      ids=places.docs.filter(d=>d.id===`pl_${d.get('googlePlaceId')}` && !protectedPlaces.has(d.id)).map(d=>d.get('googlePlaceId'));
      if(sourceFile) ids.push(...sourceFile.filter(id=>!protectedPlaces.has(`pl_${id}`)));
    }
    const anchor=metadata?.anchor || o.anchor || new Date().toISOString().slice(0,10)+'T00:00:00.000Z';
    if(metadata && o.anchor) invariant(o.anchor===metadata.anchor,'Anchor differs from frozen run.');
    const plan=makePlan(o.namespace,ids,anchor);
    for(const doc of plan.documents) {safe(doc.path,doc.data);if(doc.path.startsWith('reviews/')) invariant(!protectedPlaces.has(doc.data.placeId),'A seed venue now belongs to protected user data. Stop without writing.');}
    const pending=[];let reusedPlaces=0;
    for(let offset=0;offset<plan.documents.length;offset+=250) {
      const docs=plan.documents.slice(offset,offset+250);
      const snapshots=await db.getAll(...docs.map(doc=>db.doc(doc.path)));
      for(const [index,doc] of docs.entries()) {
        const snapshot=snapshots[index];const record=recorded.get(doc.path);
        if(snapshot.exists) {
          safe(doc.path,snapshot.data());
          if(doc.path.startsWith('places/') && !record) {invariant(snapshot.get('googlePlaceId')===doc.data.googlePlaceId,'Place ID collision.');reusedPlaces++;continue;}
          invariant(record && record.get('hash')===digest(doc.data) && digest(snapshot.data())===record.get('hash'),`Unowned collision or changed data: ${doc.path}`);
        } else {invariant(o.mode!=='verify',`Missing ${doc.path}`); pending.push(doc);}
      }
    }
    console.log(JSON.stringify({mode:o.mode,projectId:o.projectId,namespace:o.namespace,protectedUid,anchor,...plan.summary,documentsToCreate:pending.length,accountsToCreate:existingAccounts.filter(x=>!x).length,reusedPlaces},null,2));
    if(o.mode==='dry-run')return;
    if(o.mode==='verify') {
      invariant(metadata && existingAccounts.every(Boolean),'Missing manifest or seed accounts.');
      for(const row of records.docs) {const snap=await checkRecord(row);invariant(snap.exists,`Missing recorded document ${snap.ref.path}`);}
      for(const account of accounts) {
        const [reviews,lists]=await Promise.all([db.collection('reviews').where('userId','==',account.uid).get(),db.collection(`users/${account.uid}/list`).get()]);
        const expected=rankListEntries(reviews.docs.map(d=>reviewRankingCandidate({...d.data(),id:d.id,createdAt:d.get('createdAt').toDate(),updatedAt:d.get('updatedAt').toDate()})));
        invariant(expected.length===lists.size,`List count mismatch ${account.uid}`);
        const actual=new Map(lists.docs.map(d=>[d.id,d.data()]));
        for(const row of expected) invariant(digest({...row,ratingScale:5})===digest(actual.get(row.placeId)),`Ranking mismatch ${account.uid}/${row.placeId}`);
        invariant(reviews.size===plan.reviews.filter(r=>r.userId===account.uid).length,`Unexpected reviews for ${account.uid}`);
        const friends=await db.collection('friendships').where('userIds','array-contains',account.uid).get();
        invariant(friends.size===plan.friendships.filter(f=>f.userIds.includes(account.uid)).length,`Unexpected friendships for ${account.uid}`);
      }
      console.log('PASS: exact seed content, Auth ownership, counts, review/List synchronization and shared deterministic rankings.');return;
    }
    invariant(process.env.SEED_USER_PASSWORD?.length>=12,'Set SEED_USER_PASSWORD (12+ characters). It is never stored in the manifest or logged.');
    if(!metadata) await root.create({version:VERSION,projectId:o.projectId,protectedUid,anchor,sourceFileHash:sourceFile?digest(sourceFile):null,googleIds:plan.places.map(p=>p.googlePlaceId),accountIds:accounts.map(a=>a.uid)});
    // Auth has no cross-service transaction; a crash before claims are installed fails closed.
    for(const [i,account] of accounts.entries()) if(!existingAccounts[i]) {
      await auth.createUser({uid:account.uid,email:account.email,displayName:account.displayName,password:process.env.SEED_USER_PASSWORD,emailVerified:true});
      await auth.setCustomUserClaims(account.uid,{listSeed:o.namespace});
    }
    for(let offset=0;offset<pending.length;offset+=150) {
      const rows=pending.slice(offset,offset+150);
      await db.runTransaction(async tx=>{
        const refs=rows.map(d=>db.doc(d.path));
        const snapshots=await tx.getAll(...refs);
        for(const [i,doc] of rows.entries()) {
          safe(doc.path,doc.data);invariant(!snapshots[i].exists,`Concurrent collision ${doc.path}`);
          tx.create(refs[i],doc.data);
          tx.set(root.collection('documents').doc(digest(doc.path)),{path:doc.path,hash:digest(doc.data)});
        }
      });
    }
    console.log('Seed complete. Run npm run seed:verify with identical target/namespace.');
  } finally {await deleteApp(app);}
}
if(process.argv[1] && import.meta.url===pathToFileURL(process.argv[1]).href) {
  Promise.resolve().then(()=>execute(options(process.argv.slice(2)))).catch(error=>{console.error(error.message);process.exitCode=1;});
}
