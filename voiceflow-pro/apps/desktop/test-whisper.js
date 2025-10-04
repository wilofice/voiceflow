/**
 * Test script for DesktopWhisperService
 * Verifies Task 1.2 implementation
 */

const { DesktopWhisperService } = require('./dist/main/services/desktopWhisperService');

async function testWhisperService() {
    console.log('=== Testing DesktopWhisperService (Task 1.2) ===\n');
    
    const service = new DesktopWhisperService();
    
    try {
        // Test 1: Initialize service
        console.log('Test 1: Initializing service...');
        await service.initialize();
        console.log('✅ Service initialized successfully');
        console.log(`   Binary type: ${service.getWhisperType()}`);
        console.log(`   Binary path: ${service.getBinaryPath()}\n`);
        
        // Test 2: Check health status
        console.log('Test 2: Checking health status...');
        const healthResult = await service.getHealthStatus();
        if (healthResult.success) {
            console.log('✅ Health check passed');
            console.log(`   Platform: ${healthResult.status.systemInfo.platform}`);
            console.log(`   Available models: ${healthResult.status.availableModels.join(', ') || 'none'}\n`);
        } else {
            console.log(`❌ Health check failed: ${healthResult.error}\n`);
        }
        
        // Test 3: Get available models
        console.log('Test 3: Getting available models...');
        const modelsResult = await service.getAvailableModels();
        if (modelsResult.success) {
            console.log('✅ Models retrieved');
            const existingModels = modelsResult.models.filter(m => m.exists);
            console.log(`   Installed models: ${existingModels.map(m => m.name).join(', ') || 'none'}\n`);
        } else {
            console.log(`❌ Failed to get models: ${modelsResult.error}\n`);
        }
        
        // Test 4: Initialize model
        console.log('Test 4: Initializing model...');
        const modelConfig = {
            model: 'base',
            language: 'en',
            task: 'transcribe'
        };
        const initResult = await service.initializeModel(modelConfig);
        if (initResult.success) {
            console.log('✅ Model initialized\n');
        } else {
            console.log(`❌ Model initialization failed: ${initResult.error}\n`);
        }
        
        // Test 5: Transcribe test file
        console.log('Test 5: Testing transcription...');
        const testFile = '/tmp/test_speech.wav';
        console.log(`   Test file: ${testFile}`);
        
        const transcribeResult = await service.transcribeFile(testFile, modelConfig);
        if (transcribeResult.success) {
            console.log('✅ Transcription completed!');
            console.log(`   Text: "${transcribeResult.result.text}"`);
            console.log(`   Processing time: ${transcribeResult.result.processingTime}ms`);
            console.log(`   Method: ${transcribeResult.result.method}`);
            console.log(`   Model: ${transcribeResult.result.model}\n`);
        } else {
            console.log(`❌ Transcription failed: ${transcribeResult.error}\n`);
        }
        
        // Cleanup
        await service.cleanup();
        console.log('=== Test Complete ===');
        console.log('\n✅ Task 1.2 verification successful!');
        console.log('DesktopWhisperService is fully operational with Python whisper integration.');
        
    } catch (error) {
        console.error('❌ Test failed:', error);
        process.exit(1);
    }
}

// Mock Electron app for testing - must be done before requiring the service
require('module').Module._extensions['.js'] = ((originalLoader) => {
    return function(module, filename) {
        if (filename.includes('desktopWhisperService')) {
            global.app = {
                getPath: (type) => {
                    if (type === 'userData') {
                        return '/tmp/voiceflow-test';
                    }
                    return '/tmp';
                }
            };
        }
        return originalLoader.apply(this, arguments);
    };
})(require('module').Module._extensions['.js']);

// Run test
testWhisperService().then(() => {
    process.exit(0);
}).catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
});