import test from "node:test";
import assert from "node:assert/strict";
import Database from "better-sqlite3";
import { ApprovalRepository } from "../../storage/repositories/ApprovalRepository.js";

test("approval can only be consumed once",()=>{
  const db=new Database(":memory:");
  db.exec(`CREATE TABLE approvals (
    approval_id TEXT PRIMARY KEY,user_id TEXT NOT NULL,session_id TEXT NOT NULL,action_id TEXT NOT NULL,
    tool_name TEXT NOT NULL,argument_hash TEXT NOT NULL,created_at INTEGER NOT NULL,expires_at INTEGER NOT NULL,
    used INTEGER NOT NULL DEFAULT 0
  )`);
  const repo=new ApprovalRepository(db);
  repo.create({approvalId:"a1",userId:"u1",sessionId:"s1",actionId:"x1",toolName:"safe_tool",argumentHash:"h1",createdAt:1000,expiresAt:10000});
  const input={approvalId:"a1",userId:"u1",sessionId:"s1",actionId:"x1",toolName:"safe_tool",argumentHash:"h1"};
  assert.equal(repo.consumeIfMatches(input,2000),true);
  assert.equal(repo.consumeIfMatches(input,2000),false);
  db.close();
});

test("approval argument/tool/session mismatch cannot be consumed",()=>{
  const db=new Database(":memory:");
  db.exec(`CREATE TABLE approvals (
    approval_id TEXT PRIMARY KEY,user_id TEXT NOT NULL,session_id TEXT NOT NULL,action_id TEXT NOT NULL,
    tool_name TEXT NOT NULL,argument_hash TEXT NOT NULL,created_at INTEGER NOT NULL,expires_at INTEGER NOT NULL,
    used INTEGER NOT NULL DEFAULT 0
  )`);
  const repo=new ApprovalRepository(db);
  repo.create({approvalId:"a2",userId:"u1",sessionId:"s1",actionId:"x1",toolName:"safe_tool",argumentHash:"h1",createdAt:1000,expiresAt:10000});
  assert.equal(repo.consumeIfMatches({approvalId:"a2",userId:"u1",sessionId:"s1",actionId:"x1",toolName:"other_tool",argumentHash:"h1"},2000),false);
  assert.equal(repo.consumeIfMatches({approvalId:"a2",userId:"u1",sessionId:"s2",actionId:"x1",toolName:"safe_tool",argumentHash:"h1"},2000),false);
  db.close();
});