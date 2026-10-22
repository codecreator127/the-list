import assert from 'node:assert/strict';
import { initializeApp, deleteApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { execute, options } from './seed.mjs';

// Read-only safety smoke test on a separate, empty demo project. No sentinel,
// protected-user documents, fake Place IDs or seed data are created by this test.
const target=options(['dry-run','--project-id','demo-list-seed-guards']);
const app=initializeApp({projectId:target.projectId},'seed-guard-test');
try {
  const auth=getAuth(app), db=getFirestore(app);
  const beforeUsers=await auth.listUsers(1000);
  assert.equal(beforeUsers.users.length,0,'Use a fresh demo-list-seed-guards emulator project.');
  const beforeCollections=await db.listCollections();
  assert.equal(beforeCollections.length,0,'Safety test requires empty Firestore.');
  for(const mode of ['dry-run','seed','verify','cleanup']) {
    await assert.rejects(()=>execute({...target,mode}),/Protected test@gmail.com is absent/);
  }
  assert.equal((await auth.listUsers(1000)).users.length,0);
  assert.equal((await db.listCollections()).length,0);
  console.log('PASS: all four commands reject unresolved protected UID without creating Auth users or Firestore documents.');
} finally {await deleteApp(app);}
