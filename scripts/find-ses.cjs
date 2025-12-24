/**
 * SES Detector Script
 * 
 * Scans dist/public/assets for SES/lockdown code that could cause
 * "createContext" undefined errors if executed before React mounts.
 * 
 * Looks for:
 * - "lockdown-install"
 * - "SES Removing unpermitted intrinsics"
 * - Other SES-related patterns
 */

const fs = require('fs');
const path = require('path');

const DIST_DIR = path.join(process.cwd(), 'dist', 'public', 'assets');
const SEARCH_PATTERNS = [
  'lockdown-install',
  'SES Removing unpermitted intrinsics',
  'SES lockdown',
  'ses/lockdown',
  'secure-ecmascript',
  'hardened',
  'lockdown()',
];

function scanFile(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    const matches = [];
    
    for (const pattern of SEARCH_PATTERNS) {
      if (content.includes(pattern)) {
        matches.push(pattern);
      }
    }
    
    return matches;
  } catch (error) {
    // Skip binary files or files that can't be read
    return [];
  }
}

function scanDirectory(dirPath) {
  const results = [];
  
  if (!fs.existsSync(dirPath)) {
    console.log(`❌ Directory does not exist: ${dirPath}`);
    console.log('   Run "npm run build" first to generate dist/public');
    return results;
  }
  
  function walkDir(currentPath) {
    const entries = fs.readdirSync(currentPath, { withFileTypes: true });
    
    for (const entry of entries) {
      const fullPath = path.join(currentPath, entry.name);
      
      if (entry.isDirectory()) {
        walkDir(fullPath);
      } else if (entry.isFile()) {
        // Only scan JS files
        if (entry.name.endsWith('.js') || entry.name.endsWith('.mjs')) {
          const matches = scanFile(fullPath);
          if (matches.length > 0) {
            results.push({
              file: path.relative(process.cwd(), fullPath),
              matches,
            });
          }
        }
      }
    }
  }
  
  walkDir(dirPath);
  return results;
}

console.log('🔍 Scanning for SES/lockdown code in dist/public/assets...\n');

const results = scanDirectory(DIST_DIR);

if (results.length === 0) {
  console.log('✅ No SES/lockdown code detected in built assets!');
  console.log('   This is good - wallet code should only load on wallet routes.\n');
  process.exit(0);
} else {
  console.log(`⚠️  Found ${results.length} file(s) containing SES/lockdown patterns:\n`);
  
  for (const result of results) {
    console.log(`📄 ${result.file}`);
    console.log(`   Patterns found: ${result.matches.join(', ')}\n`);
  }
  
  console.log('⚠️  WARNING: SES/lockdown code detected in build output!');
  console.log('   This could cause "createContext" undefined errors if executed before React mounts.');
  console.log('   Ensure wallet vendor bundle only loads on wallet-required routes.\n');
  process.exit(1);
}

