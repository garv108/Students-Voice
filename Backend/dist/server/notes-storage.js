"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.uploadFile = uploadFile;
exports.getSignedUrl = getSignedUrl;
exports.deleteFile = deleteFile;
exports.getFileMetadata = getFileMetadata;
const supabase_js_1 = require("@supabase/supabase-js");
// Initialize Supabase client conditionally
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;
const supabase = supabaseUrl && supabaseKey ? (0, supabase_js_1.createClient)(supabaseUrl, supabaseKey) : null;
const BUCKET_NAME = 'notes-files';
/**
 * Upload a file to Supabase storage
 */
async function uploadFile(fileBuffer, fileName, categoryId) {
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
    }
    catch (error) {
        console.error('Upload file error:', error);
        throw error;
    }
}
/**
 * Generate a signed URL for file download
 */
async function getSignedUrl(filePath) {
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
    }
    catch (error) {
        console.error('Get signed URL error:', error);
        throw error;
    }
}
/**
 * Delete a file from Supabase storage
 */
async function deleteFile(filePath) {
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
    }
    catch (error) {
        console.error('Delete file error:', error);
        throw error;
    }
}
/**
 * Get file metadata from Supabase storage
 */
async function getFileMetadata(filePath) {
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
    }
    catch (error) {
        console.error('Get file metadata error:', error);
        throw error;
    }
}
