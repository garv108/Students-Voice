import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { Readable } from 'stream';

// Initialize Supabase client conditionally
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;
const supabase: SupabaseClient | null = supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null;

const BUCKET_NAME = 'notes-files';

export interface UploadResult {
  fullPath: string;
  id: string;
  path: string;
}

/**
 * Upload a file to Supabase storage
 */
export async function uploadFile(
  fileBuffer: Buffer,
  fileName: string,
  categoryId: string
): Promise<UploadResult> {
  if (!supabase) {
    throw new Error('Supabase is not configured. Please set SUPABASE_URL and SUPABASE_ANON_KEY environment variables.');
  }

  try {
    // Create a unique file path
    const timestamp = Date.now();
    const fileExtension = fileName.split('.').pop();
    const uniqueFileName = `${categoryId}/${timestamp}-${Math.random().toString(36).substring(2)}.${fileExtension}`;

    // Upload file to Supabase
    const { data, error } = await supabase.storage
      .from(BUCKET_NAME)
      .upload(uniqueFileName, fileBuffer, {
        contentType: 'application/pdf',
        upsert: false
      });

    if (error) {
      throw new Error(`Failed to upload file: ${error.message}`);
    }

    return {
      fullPath: data.path,
      id: data.id,
      path: data.path
    };
  } catch (error) {
    console.error('Upload file error:', error);
    throw error;
  }
}

/**
 * Generate a signed URL for file download
 */
export async function getSignedUrl(filePath: string): Promise<string> {
  if (!supabase) {
    throw new Error('Supabase is not configured. Please set SUPABASE_URL and SUPABASE_ANON_KEY environment variables.');
  }

  try {
    const { data, error } = await supabase.storage
      .from(BUCKET_NAME)
      .createSignedUrl(filePath, 3600); // 1 hour expiry

    if (error) {
      throw new Error(`Failed to generate signed URL: ${error.message}`);
    }

    return data.signedUrl;
  } catch (error) {
    console.error('Get signed URL error:', error);
    throw error;
  }
}

/**
 * Delete a file from Supabase storage
 */
export async function deleteFile(filePath: string): Promise<void> {
  if (!supabase) {
    throw new Error('Supabase is not configured. Please set SUPABASE_URL and SUPABASE_ANON_KEY environment variables.');
  }

  try {
    const { error } = await supabase.storage
      .from(BUCKET_NAME)
      .remove([filePath]);

    if (error) {
      throw new Error(`Failed to delete file: ${error.message}`);
    }
  } catch (error) {
    console.error('Delete file error:', error);
    throw error;
  }
}

/**
 * Get file metadata from Supabase storage
 */
export async function getFileMetadata(filePath: string): Promise<any> {
  if (!supabase) {
    throw new Error('Supabase is not configured. Please set SUPABASE_URL and SUPABASE_ANON_KEY environment variables.');
  }

  try {
    const { data, error } = await supabase.storage
      .from(BUCKET_NAME)
      .list('', {
        search: filePath
      });

    if (error) {
      throw new Error(`Failed to get file metadata: ${error.message}`);
    }

    return data;
  } catch (error) {
    console.error('Get file metadata error:', error);
    throw error;
  }
}
