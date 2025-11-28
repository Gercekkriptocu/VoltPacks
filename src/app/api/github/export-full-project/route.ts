import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

interface FileItem {
  path: string;
  content: string;
  encoding?: 'utf-8' | 'base64';
}

interface ExportRequestBody {
  token: string;
  repoName: string;
  repoDescription?: string;
}

interface UploadResult {
  success: boolean;
  path: string;
  error?: string;
  attempt?: number;
}

/**
 * Check if a repository exists
 */
async function checkRepoExists(token: string, username: string, repoName: string): Promise<boolean> {
  const response = await fetch(`https://api.github.com/repos/${username}/${repoName}`, {
    headers: {
      'Authorization': `Bearer ${token}`,
      'Accept': 'application/vnd.github.v3+json'
    }
  });

  return response.ok;
}

/**
 * Delete all files in a repository
 */
async function clearRepo(token: string, repoFullName: string): Promise<void> {
  // Get all files in the repo
  const response = await fetch(`https://api.github.com/repos/${repoFullName}/git/trees/main?recursive=1`, {
    headers: {
      'Authorization': `Bearer ${token}`,
      'Accept': 'application/vnd.github.v3+json'
    }
  });

  if (!response.ok) {
    return; // Repo might be empty or main branch doesn't exist yet
  }

  const data = await response.json();
  const files = data.tree?.filter((item: { type: string }) => item.type === 'blob') || [];

  // Delete each file
  for (const file of files) {
    try {
      // Get file SHA
      const fileResponse = await fetch(
        `https://api.github.com/repos/${repoFullName}/contents/${file.path}`,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Accept': 'application/vnd.github.v3+json'
          }
        }
      );

      if (fileResponse.ok) {
        const fileData = await fileResponse.json();
        
        // Delete the file
        await fetch(
          `https://api.github.com/repos/${repoFullName}/contents/${file.path}`,
          {
            method: 'DELETE',
            headers: {
              'Authorization': `Bearer ${token}`,
              'Accept': 'application/vnd.github.v3+json',
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              message: `Remove ${file.path}`,
              sha: fileData.sha
            })
          }
        );
      }
    } catch (error) {
      console.error(`Failed to delete ${file.path}:`, error);
    }
  }
}

/**
 * Create a new GitHub repository or use existing one
 */
async function createRepo(token: string, repoName: string, description: string, username: string): Promise<string> {
  const repoFullName = `${username}/${repoName}`;
  
  // Check if repository already exists
  const exists = await checkRepoExists(token, username, repoName);
  
  if (exists) {
    console.log(`📦 Repository ${repoFullName} already exists, clearing it...`);
    await clearRepo(token, repoFullName);
    return repoFullName;
  }

  // Create new repository
  const response = await fetch('https://api.github.com/user/repos', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Accept': 'application/vnd.github.v3+json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name: repoName,
      description,
      private: false,
      auto_init: false
    })
  });

  if (!response.ok) {
    const error = await response.json();
    const errorMessage = error.message || 'Failed to create repository';
    
    // Provide more specific error messages
    if (error.errors) {
      const detailedErrors = error.errors.map((e: { message: string }) => e.message).join(', ');
      throw new Error(`${errorMessage}: ${detailedErrors}`);
    }
    
    throw new Error(errorMessage);
  }

  const data = await response.json();
  return data.full_name;
}

/**
 * Get GitHub username
 */
async function getGitHubUser(token: string): Promise<string> {
  const response = await fetch('https://api.github.com/user', {
    headers: {
      'Authorization': `Bearer ${token}`,
      'Accept': 'application/vnd.github.v3+json'
    }
  });

  if (!response.ok) {
    throw new Error('Failed to get GitHub user info');
  }

  const data = await response.json();
  return data.login;
}

/**
 * Upload a file to GitHub with retry logic
 */
async function uploadFile(
  token: string,
  repoFullName: string,
  filePath: string,
  content: string,
  encoding: 'utf-8' | 'base64' = 'utf-8',
  maxRetries: number = 3
): Promise<UploadResult> {
  let lastError: string = '';

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      // Convert content to base64 if it's not already
      const base64Content = encoding === 'base64' 
        ? content 
        : Buffer.from(content, 'utf-8').toString('base64');
      
      // Check file size (GitHub has a 100MB limit, but we'll be conservative)
      const sizeInBytes = Buffer.byteLength(base64Content, 'utf-8');
      const sizeInMB = sizeInBytes / (1024 * 1024);
      
      if (sizeInMB > 50) {
        return {
          success: false,
          path: filePath,
          error: `File too large: ${sizeInMB.toFixed(2)}MB (max 50MB)`,
          attempt
        };
      }

      const response = await fetch(
        `https://api.github.com/repos/${repoFullName}/contents/${filePath}`,
        {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Accept': 'application/vnd.github.v3+json',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            message: `Add ${filePath}`,
            content: base64Content
          })
        }
      );

      if (response.ok) {
        return {
          success: true,
          path: filePath,
          attempt
        };
      }

      // Get error details
      const errorData = await response.json().catch(() => ({ message: 'Unknown error' }));
      lastError = errorData.message || `HTTP ${response.status}: ${response.statusText}`;

      // Don't retry on certain errors
      if (response.status === 401 || response.status === 403 || response.status === 404) {
        return {
          success: false,
          path: filePath,
          error: lastError,
          attempt
        };
      }

      // Wait before retrying (exponential backoff)
      if (attempt < maxRetries) {
        await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
      }

    } catch (error) {
      lastError = error instanceof Error ? error.message : 'Unknown error';
      
      // Wait before retrying
      if (attempt < maxRetries) {
        await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
      }
    }
  }

  return {
    success: false,
    path: filePath,
    error: lastError,
    attempt: maxRetries
  };
}

/**
 * Filter out GitHubExporter component from files
 */
function filterGitHubExporter(files: FileItem[]): FileItem[] {
  return files
    .filter(file => {
      // Remove GitHubExporter.tsx
      if (file.path === 'src/components/GitHubExporter.tsx') {
        return false;
      }
      return true;
    })
    .map(file => {
      // Clean page.tsx from GitHubExporter references
      if (file.path === 'src/app/page.tsx') {
        let cleanedContent = file.content;
        
        // Remove import statement
        cleanedContent = cleanedContent.replace(
          /import\s+GitHubExporter\s+from\s+['"]@\/components\/GitHubExporter['"];?\s*/g,
          ''
        );
        
        // Remove component usage
        cleanedContent = cleanedContent.replace(
          /<GitHubExporter\s*\/>/g,
          ''
        );
        
        return {
          ...file,
          content: cleanedContent
        };
      }
      
      return file;
    });
}

/**
 * POST /api/github/export-full-project
 * Export entire project to GitHub
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const body = await request.json() as ExportRequestBody;
    const { token, repoName, repoDescription = 'Stranger Things NFT Pack Opening Experience' } = body;

    if (!token || !repoName) {
      return NextResponse.json(
        { success: false, error: 'Token and repository name are required' },
        { status: 400 }
      );
    }

    console.log('🚀 Starting GitHub export...');
    console.log(`📦 Repository: ${repoName}`);

    // Step 1: Get all project files
    console.log('📂 Fetching project files...');
    const filesResponse = await fetch(`${request.nextUrl.origin}/api/files/get-all`);
    
    if (!filesResponse.ok) {
      throw new Error('Failed to fetch project files');
    }

    const filesData = await filesResponse.json();
    let allFiles: FileItem[] = filesData.files || [];
    
    console.log(`✅ Got ${allFiles.length} files`);

    // Step 2: Filter out GitHubExporter
    console.log('🧹 Filtering out GitHubExporter component...');
    allFiles = filterGitHubExporter(allFiles);
    console.log(`✅ Cleaned to ${allFiles.length} files`);

    // Step 3: Get GitHub username
    console.log('👤 Getting GitHub username...');
    const username = await getGitHubUser(token);
    console.log(`✅ Username: ${username}`);

    // Step 4: Create repository
    console.log('📦 Creating GitHub repository...');
    const repoFullName = await createRepo(token, repoName, repoDescription, username);
    console.log(`✅ Created: ${repoFullName}`);

    // Step 5: Upload files
    console.log('📤 Uploading files...');
    const results: UploadResult[] = [];
    
    // Upload files sequentially to avoid rate limiting
    for (let i = 0; i < allFiles.length; i++) {
      const file = allFiles[i];
      const progress = `[${i + 1}/${allFiles.length}]`;
      
      console.log(`${progress} Uploading: ${file.path}`);
      
      const result = await uploadFile(
        token,
        repoFullName,
        file.path,
        file.content,
        file.encoding || 'utf-8'
      );
      
      results.push(result);
      
      if (result.success) {
        console.log(`${progress} ✅ ${file.path}`);
      } else {
        console.error(`${progress} ❌ ${file.path}: ${result.error}`);
      }
      
      // Small delay between uploads to respect rate limits
      if (i < allFiles.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }

    const stats = {
      total: allFiles.length,
      uploaded: results.filter(r => r.success).length,
      failed: results.filter(r => !r.success).length,
      failedFiles: results.filter(r => !r.success).map(r => ({
        path: r.path,
        error: r.error
      }))
    };

    console.log('✅ Upload complete!');
    console.log(`📊 Stats: ${stats.uploaded}/${stats.total} files uploaded, ${stats.failed} failed`);

    if (stats.failed > 0) {
      console.log('❌ Failed files:', stats.failedFiles);
    }

    const repoUrl = `https://github.com/${repoFullName}`;

    return NextResponse.json({
      success: stats.uploaded > 0,
      message: `Successfully exported ${stats.uploaded} files to GitHub`,
      repoUrl,
      stats
    });

  } catch (error) {
    console.error('❌ GitHub export error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to export to GitHub'
      },
      { status: 500 }
    );
  }
}
