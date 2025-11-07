/**
 * 環境変数の確認スクリプト
 * 
 * 使用方法:
 * npx tsx scripts/check-env.ts
 */

import { config } from 'dotenv';
import { resolve } from 'path';

// .env.local を読み込む
config({ path: resolve(process.cwd(), '.env.local') });

console.log('🔍 環境変数の確認\n');

// 旧Supabase
console.log('📦 旧Supabase設定:');
console.log(`   OLD_SUPABASE_URL: ${process.env.OLD_SUPABASE_URL ? '✅ 設定済み' : '❌ 未設定'}`);
if (!process.env.OLD_SUPABASE_URL) {
  console.log(`   SUPABASE_URL: ${process.env.SUPABASE_URL ? '✅ 設定済み（フォールバック）' : '❌ 未設定'}`);
  console.log(`   NEXT_PUBLIC_SUPABASE_URL: ${process.env.NEXT_PUBLIC_SUPABASE_URL ? '✅ 設定済み（フォールバック）' : '❌ 未設定'}`);
}
console.log(`   OLD_SUPABASE_SERVICE_ROLE_KEY: ${process.env.OLD_SUPABASE_SERVICE_ROLE_KEY ? '✅ 設定済み' : '❌ 未設定'}`);
if (!process.env.OLD_SUPABASE_SERVICE_ROLE_KEY) {
  console.log(`   SUPABASE_SERVICE_ROLE_KEY: ${process.env.SUPABASE_SERVICE_ROLE_KEY ? '✅ 設定済み（フォールバック）' : '❌ 未設定'}`);
}
console.log('');

// 新Supabase
console.log('📦 新Supabase設定:');
console.log(`   NEW_SUPABASE_URL: ${process.env.NEW_SUPABASE_URL ? '✅ 設定済み' : '❌ 未設定'}`);
if (!process.env.NEW_SUPABASE_URL) {
  console.log(`   SUPABASE_URL: ${process.env.SUPABASE_URL ? '✅ 設定済み（フォールバック）' : '❌ 未設定'}`);
  console.log(`   NEXT_PUBLIC_SUPABASE_URL: ${process.env.NEXT_PUBLIC_SUPABASE_URL ? '✅ 設定済み（フォールバック）' : '❌ 未設定'}`);
}
console.log(`   NEW_SUPABASE_SERVICE_ROLE_KEY: ${process.env.NEW_SUPABASE_SERVICE_ROLE_KEY ? '✅ 設定済み' : '❌ 未設定'}`);
if (!process.env.NEW_SUPABASE_SERVICE_ROLE_KEY) {
  console.log(`   SUPABASE_SERVICE_ROLE_KEY: ${process.env.SUPABASE_SERVICE_ROLE_KEY ? '✅ 設定済み（フォールバック）' : '❌ 未設定'}`);
}
console.log('');

// OpenAI
console.log('📦 OpenAI設定:');
console.log(`   OPENAI_API_KEY: ${process.env.OPENAI_API_KEY ? '✅ 設定済み' : '❌ 未設定'}`);
console.log('');

// 推奨設定
console.log('💡 推奨設定:');
console.log('   .env.local に以下の環境変数を明示的に設定することを推奨します:');
console.log('');
console.log('   # 旧Supabase (whisky_diagnosis_ai)');
console.log('   OLD_SUPABASE_URL=https://dqtdddneixhxstrxejxb.supabase.co');
console.log('   OLD_SUPABASE_SERVICE_ROLE_KEY=your-old-service-role-key');
console.log('');
console.log('   # 新Supabase (market-ai-suite)');
console.log('   NEW_SUPABASE_URL=https://jqlhlvruxkcffjvjzxmy.supabase.co');
console.log('   NEW_SUPABASE_SERVICE_ROLE_KEY=your-new-service-role-key');
console.log('');
console.log('   # OpenAI');
console.log('   OPENAI_API_KEY=your-openai-api-key');
console.log('');
