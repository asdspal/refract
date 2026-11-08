import { createHash } from "node:crypto";
import { spawn, spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { Connection, Keypair, Transaction, TransactionInstruction, sendAndConfirmTransaction } from "@solana/web3.js";
const binDir = join(process.env.HOME!, ".local/share/solana/install/active_release/bin");
const RPC = "http://127.0.0.1:18899";
async function sendWithRetry(conn: Connection, ix: TransactionInstruction, payer: Keypair) {
  let last: any;
  for (let i=0;i<8;i++){
    try { return await sendAndConfirmTransaction(conn, new Transaction().add(ix), [payer], {commitment:"confirmed"}); }
    catch(e:any){ last=e; console.log("attempt",i,"failed:", String(e.message).split("\n")[0]); await new Promise(r=>setTimeout(r,1000)); }
  }
  throw last;
}
async function main() {
  const dir = mkdtempSync(join(tmpdir(), "mimic2-"));
  const v = spawn(join(binDir,"solana-test-validator"), ["--reset","--quiet","--ledger",join(dir,"ledger"),"--rpc-port","18899"], { stdio:"ignore", detached:true });
  v.unref();
  const conn = new Connection(RPC, "confirmed");
  for (let i=0;i<60;i++){ try { await conn.getVersion(); break; } catch { await new Promise(r=>setTimeout(r,500)); } }
  const payer = Keypair.generate();
  const payerFile = join(dir,"payer.json");
  writeFileSync(payerFile, JSON.stringify(Array.from(payer.secretKey)));
  const airdrop = await conn.requestAirdrop(payer.publicKey, 10_000_000_000);
  await conn.confirmTransaction(airdrop, "confirmed");
  const prog = resolve("target/deploy/refract_vault-keypair.json");
  const dep = spawnSync(join(binDir,"solana"), ["program","deploy",resolve("target/deploy/refract_vault.so"),"--program-id",prog,"--url",RPC,"--keypair",payerFile], {encoding:"utf8",timeout:120000});
  console.log("deploy status", dep.status);
  const programId = Keypair.fromSecretKey(Uint8Array.from(JSON.parse(readFileSync(prog,"utf8")))).publicKey;
  for (let i=0;i<20;i++){ const info=await conn.getAccountInfo(programId,"confirmed"); if(info?.executable) { console.log("executable at poll",i); break;} await new Promise(r=>setTimeout(r,500)); }
  const disc = createHash("sha256").update("global:ping_vault").digest().subarray(0,8);
  const ix = new TransactionInstruction({ programId, keys:[{pubkey:payer.publicKey,isSigner:true,isWritable:true}], data:disc });
  const sig = await sendWithRetry(conn, ix, payer);
  const tx = await conn.getTransaction(sig,{commitment:"confirmed",maxSupportedTransactionVersion:0});
  console.log("OK", sig, "CU", tx?.meta?.computeUnitsConsumed);
  try { process.kill(-v.pid!, "SIGKILL"); } catch {}
}
main().catch(e=>{console.error("FATAL",e);process.exit(1)});
