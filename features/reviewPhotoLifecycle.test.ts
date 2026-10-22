import test from 'node:test';
import assert from 'node:assert/strict';
import { persistThenCleanup } from './reviewPhotoLifecycle';
const oldPhoto={path:'old',url:'old'}, newPhoto={path:'new',url:'new'};
test('replacement and review deletion clean up only after persistence succeeds',async()=>{
  for(const next of [newPhoto,null]) {
    const calls:string[]=[];
    assert.deepEqual(await persistThenCleanup(oldPhoto,next,async()=>{calls.push('save');},async photo=>{calls.push(photo.path);}),{});
    assert.deepEqual(calls,['save','old']);
  }
});
test('a failed transaction preserves the previous photo; unchanged photos are retained',async()=>{
  let deletes=0;
  await assert.rejects(persistThenCleanup(oldPhoto,newPhoto,async()=>{throw Error('save failed');},async()=>{deletes++;}));
  await persistThenCleanup(oldPhoto,undefined,async()=>{},async()=>{deletes++;});
  await persistThenCleanup(oldPhoto,oldPhoto,async()=>{},async()=>{deletes++;});
  assert.equal(deletes,0);
});
test('post-save cleanup failure returns a retry reference without rolling back the saved photo',async()=>{
  let saved=false;
  const result=await persistThenCleanup(oldPhoto,newPhoto,async()=>{saved=true;},async()=>{throw Error('offline');});
  assert.ok(saved); assert.deepEqual(result,{cleanupPending:oldPhoto});
});
