import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import fs from 'fs/promises';
import path from 'path';

interface FileItem {
  path: string;
  content: string;
  encoding?: 'utf-8' | 'base64';
}

/**
 * Recursively get all files from a directory
 */
async function getAllFiles(dir: string, baseDir: string = dir): Promise<FileItem[]> {
  const files: FileItem[] = [];
  
  try {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      const relativePath = path.relative(baseDir, fullPath);
      
      // Skip node_modules, .next, .git, and other build/cache directories
      if (
        relativePath.includes('node_modules') ||
        relativePath.includes('.next') ||
        relativePath.includes('.git') ||
        relativePath.includes('dist') ||
        relativePath.includes('build') ||
        relativePath.startsWith('.')
      ) {
        continue;
      }
      
      if (entry.isDirectory()) {
        // Recursively get files from subdirectory
        const subFiles = await getAllFiles(fullPath, baseDir);
        files.push(...subFiles);
      } else if (entry.isFile()) {
        try {
          // Normalize path separators to forward slashes for cross-platform compatibility
          const normalizedPath = relativePath.replace(/\\/g, '/');
          
          // Detect binary files by extension
          const binaryExtensions = [
            '.woff', '.woff2', '.ttf', '.otf', '.eot',  // Fonts
            '.ico', '.png', '.jpg', '.jpeg', '.gif', '.svg', '.webp',  // Images
            '.pdf', '.zip', '.gz', '.tar',  // Archives/Documents
            '.mp3', '.mp4', '.wav', '.avi',  // Media
            '.exe', '.dll', '.so', '.dylib'  // Binaries
          ];
          
          const ext = path.extname(entry.name).toLowerCase();
          const isBinary = binaryExtensions.includes(ext);
          
          if (isBinary) {
            // Read binary files as base64
            const buffer = await fs.readFile(fullPath);
            const content = buffer.toString('base64');
            files.push({
              path: normalizedPath,
              content,
              encoding: 'base64'
            });
          } else {
            // Read text files as UTF-8
            const content = await fs.readFile(fullPath, 'utf-8');
            files.push({
              path: normalizedPath,
              content,
              encoding: 'utf-8'
            });
          }
        } catch (error) {
          console.error(`Failed to read file ${fullPath}:`, error);
        }
      }
    }
  } catch (error) {
    console.error(`Failed to read directory ${dir}:`, error);
  }
  
  return files;
}

/**
 * GET /api/files/get-all
 * Returns all project files
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    console.log('📦 Fetching all project files...');
    
    // Get the project root directory (go up from /src/app/api/files/get-all to project root)
    const projectRoot = path.join(process.cwd());
    
    console.log('📁 Project root:', projectRoot);
    
    // Get files from src directory
    const srcFiles = await getAllFiles(path.join(projectRoot, 'src'), projectRoot);
    
    // Get files from public directory
    const publicFiles = await getAllFiles(path.join(projectRoot, 'public'), projectRoot);
    
    // Get root config files
    const rootFiles: FileItem[] = [];
    const rootConfigFiles = [
      'package.json',
      'tsconfig.json',
      'next.config.ts',
      'next.config.js',
      'tailwind.config.ts',
      'tailwind.config.js',
      'postcss.config.js',
      'postcss.config.mjs',
      '.eslintrc.json',
      '.gitignore',
      'README.md',
      'components.json'
    ];
    
    for (const fileName of rootConfigFiles) {
      try {
        const filePath = path.join(projectRoot, fileName);
        const content = await fs.readFile(filePath, 'utf-8');
        rootFiles.push({
          path: fileName,
          content,
          encoding: 'utf-8'
        });
      } catch (error) {
        // File doesn't exist, skip it
      }
    }
    
    // Combine all files
    const allFiles = [...rootFiles, ...srcFiles, ...publicFiles];
    
    console.log(`✅ Found ${allFiles.length} files`);
    console.log('📄 Sample files:', allFiles.slice(0, 5).map(f => f.path));
    
    return NextResponse.json({
      success: true,
      files: allFiles,
      total: allFiles.length
    });
  } catch (error) {
    console.error('❌ Error fetching files:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch files',
        files: []
      },
      { status: 500 }
    );
  }
}
