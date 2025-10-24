
const userInput = document.getElementById('userInput');
const sendBtn = document.getElementById('sendBtn');
const voiceBtn = document.getElementById('voiceBtn');
const status = document.getElementById('status');
const statusText = document.getElementById('statusText');
const response = document.getElementById('response');
const responseContent = document.getElementById('responseContent');
const actionInfo = document.getElementById('actionInfo');

let recognition;
let isListening = false;
let isProcessing = false;

// Initialize Speech Recognition
if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = 'en-US';

    recognition.onstart = () => {
        isListening = true;
        voiceBtn.classList.add('listening');
        voiceBtn.textContent = '🔴';
        showStatus('Listening... Speak now!', 'loading');
    };

    recognition.onresult = (event) => {
        const transcript = event.results[0][0].transcript;
        userInput.value = transcript;
        showStatus(`You said: "${transcript}"`, 'success');
        
        // Auto-send after voice input
        setTimeout(() => {
            sendMessage();
        }, 500);
    };

    recognition.onerror = (event) => {
        console.error('Speech recognition error:', event.error);
        if (event.error === 'no-speech') {
            showStatus('No speech detected. Please try again.', 'error');
        } else if (event.error === 'not-allowed') {
            showStatus('Microphone access denied. Please allow microphone access.', 'error');
        } else {
            showStatus('Error: ' + event.error, 'error');
        }
    };

    recognition.onend = () => {
        isListening = false;
        voiceBtn.classList.remove('listening');
        voiceBtn.textContent = '🎤';
    };
} else {
    voiceBtn.disabled = true;
    voiceBtn.textContent = '❌';
    voiceBtn.title = 'Speech recognition not supported in this browser. Use Chrome or Edge.';
}

// Voice button click
voiceBtn.addEventListener('click', () => {
    if (!recognition) {
        showStatus('Speech recognition not available. Use Chrome or Edge browser.', 'error');
        return;
    }
    
    if (isListening) {
        recognition.stop();
    } else {
        try {
            recognition.start();
        } catch (error) {
            console.error('Recognition start error:', error);
            showStatus('Could not start voice recognition. Try again.', 'error');
        }
    }
});

// Send button click
sendBtn.addEventListener('click', sendMessage);

// Enter key press
userInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter' && !isProcessing) {
        sendMessage();
    }
});

// Quick command function
function quickCommand(command) {
    userInput.value = command;
    sendMessage();
}
window.quickCommand = quickCommand;

async function sendMessage() {
    const message = userInput.value.trim();
    if (!message || isProcessing) return;

    isProcessing = true;
    sendBtn.disabled = true;
    voiceBtn.disabled = true;
    
    showStatus('🤖 AI is thinking...', 'loading');
    response.classList.remove('show');

    try {
        const res = await fetch('/api/process', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ message })
        });

        const data = await res.json();

        if (data.success) {
            showStatus('✅ Action completed successfully!', 'success');
            responseContent.textContent = data.result;
            actionInfo.textContent = JSON.stringify(data.action, null, 2);
            response.classList.add('show');
            
            // Speak the response if speech synthesis is available
            if ('speechSynthesis' in window && data.result) {
                const utterance = new SpeechSynthesisUtterance(data.result);
                utterance.rate = 1.1;
                utterance.pitch = 1;
                window.speechSynthesis.speak(utterance);
            }
        } else {
            showStatus('❌ Error: ' + data.error, 'error');
            responseContent.textContent = 'Failed to execute: ' + data.error;
            response.classList.add('show');
        }
    } catch (error) {
        showStatus('⚠️ Connection error. Make sure the server is running on port 3000!', 'error');
        console.error('Fetch error:', error);
    } finally {
        isProcessing = false;
        sendBtn.disabled = false;
        voiceBtn.disabled = false;
        userInput.value = '';
        userInput.focus();
    }
}

function showStatus(message, type) {
    statusText.textContent = message;
    status.className = `status show ${type}`;
    
    if (type === 'success' || type === 'error') {
        setTimeout(() => {
            status.classList.remove('show');
        }, 4000);
    }
}

// Focus input on load
window.addEventListener('load', () => {
    userInput.focus();
    
    // Check server health
    fetch('/api/health')
        .then(res => res.json())
        .then(data => {
            console.log('✅ Server is ready:', data);
        })
        .catch(err => {
            console.error('❌ Server not responding:', err);
            showStatus('⚠️ Server not connected. Run "npm start" in your terminal.', 'error');
        });
});

// Keyboard shortcut: Ctrl+Space to activate voice
document.addEventListener('keydown', (e) => {
    if (e.ctrlKey && e.code === 'Space') {
        e.preventDefault();
        voiceBtn.click();
    }
});
