import axios from 'axios';
import FormData from 'form-data';

async function run() {
    try {
        // 1. Login with test user
        console.log('Logging in...');
        const loginRes = await axios.post('http://localhost:3002/api/auth/login', {
            email: 'user@flow.com',
            password: 'azerty123'
        });
        const token = loginRes.data.tokens.accessToken;
        console.log('Got token:', token.substring(0, 15) + '...');

        // 2. Upload fake mp3 file via API route
        console.log('Uploading file...');
        const form = new FormData();
        const fakeBuffer = Buffer.alloc(10 * 1024, 'A');
        form.append('file', fakeBuffer, {
            filename: 'sample.mp3',
            contentType: 'audio/mpeg'
        });
        form.append('title', 'Test API Upload');

        const uploadRes = await axios.post('http://localhost:3002/api/upload/audio', form, {
            headers: {
                ...form.getHeaders(),
                Authorization: `Bearer ${token}`
            }
        });

        console.log('Upload SUCCESS:', uploadRes.data);
    } catch (error: any) {
        console.error('API Error:', error.response?.data || error.message);
    }
}

run();
