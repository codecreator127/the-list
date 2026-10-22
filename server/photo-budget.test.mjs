import test from 'node:test';
import assert from 'node:assert/strict';
import { createPhotoBudgetGuard } from './photo-budget.mjs';

test('usage is cached briefly and checked again after expiry', async () => {
  let time=0, calls=0;
  const guard=createPhotoBudgetGuard({env:{},now:()=>time,fetcher:async()=>{calls++;return {ok:true,json:async()=>({plan:'Free',credits:{usage:1,limit:25}})};}});
  await Promise.all([guard(),guard(),guard()]); assert.equal(calls,1);
  time=61000; await guard(); assert.equal(calls,2);
});
test('uploads fail closed near 80%, on paid plans, unavailable usage, and malformed usage', async () => {
  for (const usage of [{plan:'Free',credits:{usage:20,limit:25}},{plan:'Plus',credits:{usage:0,limit:25}},{plan:'Free'}]) {
    const guard=createPhotoBudgetGuard({env:{},fetcher:async()=>({ok:true,json:async()=>usage})});
    await assert.rejects(guard());
  }
  await assert.rejects(createPhotoBudgetGuard({env:{},fetcher:async()=>({ok:false})})());
});
test('cached uploads reserve headroom instead of bypassing the threshold',async()=>{
  const guard=createPhotoBudgetGuard({env:{},fetcher:async()=>({ok:true,json:async()=>({plan:'Free',credits:{usage:19.985,limit:25}})})});
  await guard(); await assert.rejects(guard(),/paused/);
});
