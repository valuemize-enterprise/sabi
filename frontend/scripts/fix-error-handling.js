#!/usr/bin/env node

/**
 * Script to help identify files with error handling issues
 * Run: node scripts/fix-error-handling.js
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('🔍 Scanning for error handling patterns...\n');

// Find all throw new Error instances
console.log('📋 Files with "throw new Error":');
console.log('─'.repeat(80));

try {
  const result = execSync(
    'grep -r "throw new Error" src --include="*.tsx" --include="*.ts" -n',
    { encoding: 'utf-8' }
  );
  
  const lines = result.trim().split('\n');
  const fileMap = new Map();
  
  lines.forEach(line => {
    const [filePath, lineNum, ...rest] = line.split(':');
    const content = rest.join(':').trim();
    
    if (!fileMap.has(filePath)) {
      fileMap.set(filePath, []);
    }
    fileMap.get(filePath).push({ lineNum, content });
  });
  
  let totalCount = 0;
  fileMap.forEach((errors, filePath) => {
    console.log(`\n📄 ${filePath} (${errors.length} occurrences)`);
    errors.forEach(({ lineNum, content }) => {
      console.log(`   Line ${lineNum}: ${content.substring(0, 80)}...`);
      totalCount++;
    });
  });
  
  console.log('\n' + '─'.repeat(80));
  console.log(`\n📊 Total: ${totalCount} instances in ${fileMap.size} files\n`);
  
  // Priority files
  console.log('🎯 Priority Files to Update:');
  console.log('─'.repeat(80));
  const priorities = [
    'src/app/(internal)/dashboard/staff-dashboard.tsx',
    'src/app/accept-invite/page.tsx',
    'src/components/goals/types.ts',
    'src/components/people/types.ts',
    'src/app/(internal)/my-profile/page.tsx',
    'src/app/(internal)/settings/users/page.tsx'
  ];
  
  priorities.forEach((file, i) => {
    const exists = fileMap.has(file);
    const status = exists ? '❌ Needs fix' : '✅ Done';
    console.log(`${i + 1}. ${status} - ${file}`);
  });
  
} catch (error) {
  if (error.status === 1) {
    console.log('✅ No "throw new Error" instances found!');
  } else {
    console.error('Error running grep:', error.message);
  }
}

console.log('\n📖 See ERROR_HANDLING_GUIDE.md for migration instructions\n');
