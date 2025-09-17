/**
 * Simple test for DesktopWhisperService integration
 * Verifies Task 1.2 - Direct test without Electron dependencies
 */

const { WhisperServerService } = require('./dist/main/services/whisperServer');
const path = require('path');

async function testWhisperIntegration() {
    console.log('=== Testing Task 1.2: DesktopWhisperService Integration ===\n');
    
    // Test WhisperServerService directly (core of DesktopWhisperService)
    const whisperServer = new WhisperServerService({
        whisperBinaryPath: '/Users/galahassa/.local/bin/whisper',
        modelsPath: '/tmp/whisper-models',
        tempPath: '/tmp/whisper-temp',
        defaultModel: 'base',
        maxConcurrentJobs: 1,
        cleanupTempFiles: true,
        logLevel: 1
    });
    
    try {
        // Test 1: Health check
        console.log('Test 1: Health Check');
        const health = await whisperServer.getHealthStatus();
        console.log(`✅ Whisper binary: ${health.whisperBinary ? 'Found' : 'Not found'}`);
        console.log(`   Platform: ${health.systemInfo.platform}`);
        console.log(`   Architecture: ${health.systemInfo.arch}`);
        console.log(`   CPUs: ${health.systemInfo.cpus}`);
        console.log(`   Available models: ${health.availableModels.join(', ') || 'none'}\n`);
        
        // Test 2: Model check
        console.log('Test 2: Available Models');
        const models = await whisperServer.getAvailableModels();
        const existingModels = models.filter(m => m.exists);
        console.log(`✅ Models checked: ${models.length} total`);
        console.log(`   Installed: ${existingModels.map(m => m.name).join(', ') || 'none'}\n`);
        
        // Test 3: Transcription
        console.log('Test 3: Transcription Test');
        const testFile = '/tmp/test_speech.wav';
        console.log(`   Input: ${testFile}`);
        console.log('   Starting transcription...');
        
        const startTime = Date.now();
        const result = await whisperServer.transcribeFile(testFile, {
            model: 'base',
            language: 'en',
            task: 'transcribe',
            outputFormat: 'json'
        });
        
        console.log('✅ Transcription completed!');
        console.log(`   Text: "${result.text}"`);
        console.log(`   Model: ${result.model}`);
        console.log(`   Method: ${result.method}`);
        console.log(`   Processing time: ${result.processingTime}ms`);
        console.log(`   Actual time: ${Date.now() - startTime}ms\n`);
        
        // Test 4: Job management
        console.log('Test 4: Job Management');
        const activeJobs = await whisperServer.getActiveJobs();
        console.log(`✅ Active jobs: ${activeJobs.length}`);
        
        console.log('\n=== Task 1.2 Verification Complete ===');
        console.log('✅ WhisperServerService (core of DesktopWhisperService) is working!');
        console.log('✅ Python whisper binary integration confirmed');
        console.log('✅ Transcription pipeline operational');
        
        return true;
        
    } catch (error) {
        console.error('❌ Test failed:', error.message);
        if (error.message.includes('Whisper binary not found')) {
            console.log('\nNote: Python whisper needs to be installed:');
            console.log('  pip install openai-whisper');
        }
        return false;
    }
}

// Run test
console.log('Starting WhisperServerService test...\n');
testWhisperIntegration().then(success => {
    if (success) {
        console.log('\n🎉 SUCCESS: Task 1.2 is fully operational!');
        process.exit(0);
    } else {
        console.log('\n❌ FAILED: Task 1.2 needs fixes');
        process.exit(1);
    }
}).catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
});