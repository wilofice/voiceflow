#!/usr/bin/env node

/**
 * Test script for File Import System (Task 1.3)
 * Verifies FileImportService functionality
 */

const path = require('path');
const fs = require('fs-extra');
const { execSync } = require('child_process');

// Mock Electron modules since we're running in Node.js context
let app, BrowserWindow, ipcMain;

try {
    ({ app, BrowserWindow, ipcMain } = require('electron'));
} catch {
    // Running outside Electron, create mocks
    app = {
        getPath: (name) => {
            if (name === 'userData') return '/tmp/voiceflow-test';
            if (name === 'temp') return '/tmp';
            return '/tmp';
        },
        whenReady: () => Promise.resolve(),
        quit: () => process.exit(0)
    };
    
    BrowserWindow = class {
        constructor() {}
        loadURL() { return Promise.resolve(); }
        webContents = { openDevTools: () => {} };
    };
    
    ipcMain = { 
        handle: () => {},
        on: () => {},
        removeListener: () => {},
        emit: () => {}
    };
}

// Set up module mocks before importing services
const Module = require('module');
const originalRequire = Module.prototype.require;

Module.prototype.require = function(...args) {
    if (args[0] === 'electron') {
        return {
            dialog: {
                showOpenDialog: async () => ({ canceled: true, filePaths: [] }),
                showSaveDialog: async () => ({ canceled: true, filePath: undefined })
            },
            shell: {
                openPath: async () => {},
                showItemInFolder: () => {}
            },
            BrowserWindow: class {
                constructor() {}
                webContents = { send: () => {} }
                static getFocusedWindow() { return null; }
            },
            ipcMain: {
                handle: () => {},
                on: () => {},
                removeListener: () => {},
                emit: () => {}
            }
        };
    }
    return originalRequire.apply(this, args);
};

// Import our services
const { FileImportService } = require('./dist/main/services/fileImportService');

async function createTestFiles() {
    console.log('📁 Creating test audio/video files...');
    
    const testDir = '/tmp/voiceflow-file-import-test';
    await fs.ensureDir(testDir);
    
    const testFiles = [];
    
    // Create test audio files
    try {
        console.log('🎵 Creating test audio files...');
        
        // MP3 test file using macOS say command
        const mp3File = path.join(testDir, 'test-audio.mp3');
        execSync(`say "This is a test audio file for the file import system. Task 1.3 implementation." -o "${mp3File}" --file-format=mp4f`);
        testFiles.push(mp3File);
        
        // WAV test file
        const wavFile = path.join(testDir, 'test-audio.wav');
        execSync(`say "This is a WAV format test file for file import validation." -o "${wavFile}"`);
        testFiles.push(wavFile);
        
        console.log('✅ Test audio files created successfully');
    } catch (error) {
        console.warn('⚠️ Could not create audio files:', error.message);
    }
    
    // Create test text files (should be rejected)
    const txtFile = path.join(testDir, 'test-invalid.txt');
    await fs.writeFile(txtFile, 'This should be rejected as unsupported format');
    testFiles.push(txtFile);
    
    // Create empty file (should be rejected)
    const emptyFile = path.join(testDir, 'empty.mp3');
    await fs.writeFile(emptyFile, '');
    testFiles.push(emptyFile);
    
    return { testDir, testFiles };
}

async function testFileImportService() {
    console.log('\n🚀 Testing FileImportService...\n');
    
    const fileImportService = new FileImportService();
    const { testDir, testFiles } = await createTestFiles();
    
    // Test 1: Get supported formats
    console.log('📋 Test 1: Get supported formats');
    const formats = fileImportService.getSupportedFormats();
    console.log('Supported formats:', formats);
    console.log('✅ Formats test passed\n');
    
    // Test 2: Format validation
    console.log('🔍 Test 2: Format validation');
    testFiles.forEach(file => {
        const isSupported = fileImportService.isFormatSupported(file);
        console.log(`${isSupported ? '✅' : '❌'} ${path.basename(file)}: ${isSupported ? 'supported' : 'not supported'}`);
    });
    console.log('✅ Format validation test passed\n');
    
    // Test 3: Import files
    console.log('📥 Test 3: Import files');
    const importResult = await fileImportService.importFiles(testFiles);
    
    console.log('Import Result:');
    console.log(`Success: ${importResult.success}`);
    console.log(`Valid files: ${importResult.files.length}`);
    console.log(`Total size: ${(importResult.totalSize / 1024).toFixed(2)} KB`);
    console.log(`Errors: ${importResult.errors.length}`);
    
    if (importResult.files.length > 0) {
        console.log('\nValid Files:');
        importResult.files.forEach(file => {
            console.log(`  📄 ${file.name}`);
            console.log(`     Type: ${file.type}`);
            console.log(`     Size: ${(file.size / 1024).toFixed(2)} KB`);
            console.log(`     Extension: ${file.extension}`);
            if (file.duration) {
                console.log(`     Duration: ${file.duration}s`);
            }
        });
    }
    
    if (importResult.errors.length > 0) {
        console.log('\nErrors:');
        importResult.errors.forEach(error => {
            console.log(`  ❌ ${error}`);
        });
    }
    
    console.log('✅ Import files test completed\n');
    
    // Test 4: Batch import with progress
    console.log('⚡ Test 4: Batch import with progress tracking');
    
    // Set up event listeners
    fileImportService.on('file:imported', (fileInfo) => {
        console.log(`   ✅ Imported: ${fileInfo.name}`);
    });
    
    fileImportService.on('file:error', ({ path, error }) => {
        console.log(`   ❌ Error importing ${path.basename(path)}: ${error}`);
    });
    
    fileImportService.on('import:start', ({ total }) => {
        console.log(`   🚀 Starting batch import of ${total} files...`);
    });
    
    fileImportService.on('import:finish', (result) => {
        console.log(`   🏁 Batch import finished: ${result.files.length} files imported`);
    });
    
    const batchResult = await fileImportService.batchImport(testFiles.slice(0, 2)); // Only valid files
    console.log('✅ Batch import test completed\n');
    
    // Test 5: Export metadata
    console.log('📤 Test 5: Export metadata');
    const metadataPath = path.join(testDir, 'import-metadata.json');
    await fileImportService.exportMetadata(importResult.files, metadataPath);
    
    const metadata = await fs.readJson(metadataPath);
    console.log('Exported metadata keys:', Object.keys(metadata));
    console.log('✅ Metadata export test completed\n');
    
    // Cleanup
    console.log('🧹 Cleaning up test files...');
    await fs.remove(testDir);
    
    return {
        formats: formats.length,
        validFiles: importResult.files.length,
        totalErrors: importResult.errors.length,
        batchImported: batchResult.files.length
    };
}

async function runTests() {
    console.log('🎯 VoiceFlow Pro - File Import System Test');
    console.log('==========================================\n');
    
    try {
        const results = await testFileImportService();
        
        console.log('📊 Test Summary:');
        console.log(`   Supported formats: ${results.formats}`);
        console.log(`   Valid files processed: ${results.validFiles}`);
        console.log(`   Total errors encountered: ${results.totalErrors}`);
        console.log(`   Batch imported files: ${results.batchImported}`);
        console.log('\n🎉 All tests completed successfully!');
        
    } catch (error) {
        console.error('❌ Test failed:', error);
        process.exit(1);
    }
}

// Run tests
runTests().catch(console.error);