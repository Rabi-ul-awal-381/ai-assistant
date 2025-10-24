// server.js - Advanced AI Desktop Assistant
const express = require('express');
const { exec, spawn } = require('child_process');
const axios = require('axios');
const path = require('path');
const os = require('os');

const app = express();
app.use(express.json());
app.use(express.static('public'));

// Configuration
const OLLAMA_URL = 'http://localhost:11434/api/generate';
const MODEL = 'mistral';

// Enhanced system prompt for advanced capabilities
const SYSTEM_PROMPT = `You are an advanced desktop assistant like Google Assistant. Parse user requests intelligently and return JSON actions.

Available actions:

1. open_app - Opens any application instantly
   {"action": "open_app", "app": "microsoft edge"}
   {"action": "open_app", "app": "chrome"}

2. open_gmail - Opens Gmail, optionally with search/filters
   {"action": "open_gmail", "search": "from:github"}
   {"action": "open_gmail", "search": "is:unread from:github"}

3. youtube_search - Searches YouTube for videos
   {"action": "youtube_search", "query": "how to code in python"}

4. youtube_open - Opens a specific YouTube channel or video
   {"action": "youtube_open", "channel": "mkbhd"}

5. open_website - Opens any website with optional search
   {"action": "open_website", "url": "https://twitter.com", "search": "elon musk"}

6. web_search - Searches the web
   {"action": "web_search", "query": "weather today", "engine": "google"}

7. social_media - Opens social media with search
   {"action": "social_media", "platform": "twitter", "search": "AI news"}
   {"action": "social_media", "platform": "instagram", "user": "nasa"}

8. send_email - Opens Gmail compose with pre-filled data
   {"action": "send_email", "to": "example@email.com", "subject": "Hello"}

9. play_music - Plays music on YouTube/Spotify
   {"action": "play_music", "query": "chill lofi beats", "platform": "youtube"}

10. system_info - Gets system information
    {"action": "system_info", "type": "battery"}

11. file_operation - Advanced file operations
    {"action": "file_operation", "operation": "open_folder", "path": "Downloads"}
    {"action": "file_operation", "operation": "search_files", "query": "*.pdf"}

12. smart_action - Complex multi-step actions
    {"action": "smart_action", "steps": ["open_website", "search"], "details": {...}}

13. respond - For questions or conversations
    {"action": "respond", "message": "I'll help you with that"}

Intelligence rules:
- "open gmail show latest email from github" → {"action": "open_gmail", "search": "from:github"}
- "search youtube for python tutorials" → {"action": "youtube_search", "query": "python tutorials"}
- "open microsoft edge" → {"action": "open_app", "app": "microsoft edge"}
- "play some lofi music" → {"action": "play_music", "query": "lofi hip hop", "platform": "youtube"}
- "tweet about AI" → {"action": "social_media", "platform": "twitter", "action": "compose"}

CRITICAL: Return ONLY valid JSON, nothing else. Be smart about understanding context.`;

// Comprehensive app database with common paths
const APP_PATHS = {
    // Browsers
    'chrome': 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'google chrome': 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'firefox': 'C:\\Program Files\\Mozilla Firefox\\firefox.exe',
    'mozilla firefox': 'C:\\Program Files\\Mozilla Firefox\\firefox.exe',
    'edge': 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    'microsoft edge': 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    'brave': 'C:\\Program Files\\BraveSoftware\\Brave-Browser\\Application\\brave.exe',
    'opera': 'C:\\Users\\' + os.userInfo().username + '\\AppData\\Local\\Programs\\Opera\\opera.exe',
    
    // Microsoft Office
    'word': 'C:\\Program Files\\Microsoft Office\\root\\Office16\\WINWORD.EXE',
    'excel': 'C:\\Program Files\\Microsoft Office\\root\\Office16\\EXCEL.EXE',
    'powerpoint': 'C:\\Program Files\\Microsoft Office\\root\\Office16\\POWERPNT.EXE',
    'outlook': 'C:\\Program Files\\Microsoft Office\\root\\Office16\\OUTLOOK.EXE',
    
    // Development Tools
    'vscode': 'C:\\Users\\' + os.userInfo().username + '\\AppData\\Local\\Programs\\Microsoft VS Code\\Code.exe',
    'visual studio code': 'C:\\Users\\' + os.userInfo().username + '\\AppData\\Local\\Programs\\Microsoft VS Code\\Code.exe',
    
    // Media
    'spotify': 'C:\\Users\\' + os.userInfo().username + '\\AppData\\Roaming\\Spotify\\Spotify.exe',
    'vlc': 'C:\\Program Files\\VideoLAN\\VLC\\vlc.exe',
    
    // Communication
    'discord': 'C:\\Users\\' + os.userInfo().username + '\\AppData\\Local\\Discord\\app-1.0.9016\\Discord.exe',
    'slack': 'C:\\Users\\' + os.userInfo().username + '\\AppData\\Local\\slack\\slack.exe',
    'zoom': 'C:\\Users\\' + os.userInfo().username + '\\AppData\\Roaming\\Zoom\\bin\\Zoom.exe',
    
    // System Apps (work with start command)
    'notepad': 'notepad',
    'calculator': 'calc',
    'paint': 'mspaint',
    'file explorer': 'explorer',
    'explorer': 'explorer',
    'cmd': 'cmd',
    'command prompt': 'cmd',
    'powershell': 'powershell',
    'task manager': 'taskmgr',
    'control panel': 'control',
    'settings': 'ms-settings:',
};

// Function to call Ollama with better JSON extraction
async function callOllama(userMessage) {
    try {
        const response = await axios.post(OLLAMA_URL, {
            model: MODEL,
            prompt: `${SYSTEM_PROMPT}\n\nUser request: "${userMessage}"\n\nJSON response:`,
            stream: false,
            temperature: 0.2,
            format: "json"
        });

        let aiResponse = response.data.response.trim();
        
        // Clean up response
        aiResponse = aiResponse.replace(/```json\n?/g, '').replace(/```\n?/g, '');
        
        // Extract JSON
        const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
            return JSON.parse(jsonMatch[0]);
        }
        
        return JSON.parse(aiResponse);
    } catch (error) {
        console.error('Ollama Error:', error.message);
        return {
            action: 'respond',
            message: 'I had trouble understanding that. Can you rephrase?'
        };
    }
}

// Enhanced action executor
async function executeAction(actionData) {
    return new Promise((resolve, reject) => {
        const { action } = actionData;
        const platform = process.platform;
        const openCmd = platform === 'win32' ? 'start' : platform === 'darwin' ? 'open' : 'xdg-open';

        switch (action) {
            case 'open_app':
                const appName = actionData.app.toLowerCase();
                const appPath = APP_PATHS[appName];
                
                if (appPath) {
                    // Try exact path first
                    exec(`"${appPath}"`, (error) => {
                        if (error) {
                            // Fallback to start command
                            exec(`${openCmd} "${appPath}"`, (err) => {
                                if (err) {
                                    // Last resort: try just the name
                                    exec(`${openCmd} ${appName}`, (finalErr) => {
                                        if (finalErr) reject(new Error(`Could not open ${appName}`));
                                        else resolve(`Opened ${actionData.app}`);
                                    });
                                } else {
                                    resolve(`Opened ${actionData.app}`);
                                }
                            });
                        } else {
                            resolve(`Opened ${actionData.app}`);
                        }
                    });
                } else {
                    // Try to open by name directly
                    exec(`${openCmd} ${appName}`, (error) => {
                        if (error) reject(new Error(`Could not find app: ${appName}`));
                        else resolve(`Opened ${actionData.app}`);
                    });
                }
                break;

            case 'open_gmail':
                let gmailUrl = 'https://mail.google.com/mail/u/0/';
                if (actionData.search) {
                    // Gmail search syntax
                    gmailUrl += `#search/${encodeURIComponent(actionData.search)}`;
                } else {
                    gmailUrl += '#inbox';
                }
                exec(`${openCmd} "${gmailUrl}"`, (error) => {
                    if (error) reject(error);
                    else {
                        let msg = 'Opened Gmail';
                        if (actionData.search) msg += ` with search: ${actionData.search}`;
                        resolve(msg);
                    }
                });
                break;

            case 'youtube_search':
                const ytQuery = encodeURIComponent(actionData.query);
                const ytUrl = `https://www.youtube.com/results?search_query=${ytQuery}`;
                exec(`${openCmd} "${ytUrl}"`, (error) => {
                    if (error) reject(error);
                    else resolve(`Searching YouTube for: ${actionData.query}`);
                });
                break;

            case 'youtube_open':
                let youtubeUrl = 'https://www.youtube.com/';
                if (actionData.channel) {
                    youtubeUrl += `@${actionData.channel}`;
                } else if (actionData.video) {
                    youtubeUrl += `watch?v=${actionData.video}`;
                }
                exec(`${openCmd} "${youtubeUrl}"`, (error) => {
                    if (error) reject(error);
                    else resolve(`Opened YouTube: ${actionData.channel || actionData.video}`);
                });
                break;

            case 'play_music':
                const musicQuery = encodeURIComponent(actionData.query);
                let musicUrl;
                
                if (actionData.platform === 'spotify') {
                    musicUrl = `https://open.spotify.com/search/${musicQuery}`;
                } else {
                    // Default to YouTube
                    musicUrl = `https://www.youtube.com/results?search_query=${musicQuery}`;
                }
                
                exec(`${openCmd} "${musicUrl}"`, (error) => {
                    if (error) reject(error);
                    else resolve(`Playing: ${actionData.query}`);
                });
                break;

            case 'social_media':
                const socialUrls = {
                    'twitter': 'https://twitter.com',
                    'x': 'https://twitter.com',
                    'instagram': 'https://instagram.com',
                    'facebook': 'https://facebook.com',
                    'linkedin': 'https://linkedin.com',
                    'tiktok': 'https://tiktok.com',
                    'reddit': 'https://reddit.com'
                };
                
                let socialUrl = socialUrls[actionData.platform.toLowerCase()] || 'https://twitter.com';
                
                if (actionData.search) {
                    socialUrl += `/search?q=${encodeURIComponent(actionData.search)}`;
                } else if (actionData.user) {
                    socialUrl += `/${actionData.user}`;
                }
                
                exec(`${openCmd} "${socialUrl}"`, (error) => {
                    if (error) reject(error);
                    else resolve(`Opened ${actionData.platform}`);
                });
                break;

            case 'send_email':
                let mailtoUrl = 'https://mail.google.com/mail/?view=cm&fs=1';
                if (actionData.to) mailtoUrl += `&to=${encodeURIComponent(actionData.to)}`;
                if (actionData.subject) mailtoUrl += `&su=${encodeURIComponent(actionData.subject)}`;
                if (actionData.body) mailtoUrl += `&body=${encodeURIComponent(actionData.body)}`;
                
                exec(`${openCmd} "${mailtoUrl}"`, (error) => {
                    if (error) reject(error);
                    else resolve('Opened Gmail compose');
                });
                break;

            case 'web_search':
                const searchEngines = {
                    'google': 'https://www.google.com/search?q=',
                    'bing': 'https://www.bing.com/search?q=',
                    'duckduckgo': 'https://duckduckgo.com/?q='
                };
                
                const engine = searchEngines[actionData.engine?.toLowerCase()] || searchEngines.google;
                const searchUrl = engine + encodeURIComponent(actionData.query);
                
                exec(`${openCmd} "${searchUrl}"`, (error) => {
                    if (error) reject(error);
                    else resolve(`Searching for: ${actionData.query}`);
                });
                break;

            case 'open_website':
                let url = actionData.url;
                if (!url.startsWith('http')) url = 'https://' + url;
                
                if (actionData.search) {
                    url += `/search?q=${encodeURIComponent(actionData.search)}`;
                }
                
                exec(`${openCmd} "${url}"`, (error) => {
                    if (error) reject(error);
                    else resolve(`Opened ${url}`);
                });
                break;

            case 'file_operation':
                if (actionData.operation === 'open_folder') {
                    const userPath = os.userInfo().username;
                    const commonFolders = {
                        'downloads': `C:\\Users\\${userPath}\\Downloads`,
                        'documents': `C:\\Users\\${userPath}\\Documents`,
                        'desktop': `C:\\Users\\${userPath}\\Desktop`,
                        'pictures': `C:\\Users\\${userPath}\\Pictures`,
                        'videos': `C:\\Users\\${userPath}\\Videos`,
                        'music': `C:\\Users\\${userPath}\\Music`
                    };
                    
                    const folderPath = commonFolders[actionData.path?.toLowerCase()] || actionData.path;
                    exec(`explorer "${folderPath}"`, (error) => {
                        if (error) reject(error);
                        else resolve(`Opened folder: ${actionData.path}`);
                    });
                }
                break;

            case 'system_info':
                if (actionData.type === 'battery') {
                    exec('WMIC Path Win32_Battery Get EstimatedChargeRemaining', (error, stdout) => {
                        if (error) reject(error);
                        else resolve(`Battery: ${stdout.trim()}`);
                    });
                }
                break;

            case 'respond':
                resolve(actionData.message);
                break;

            default:
                reject(new Error('Unknown action'));
        }
    });
}

// Main API endpoint
app.post('/api/process', async (req, res) => {
    try {
        const { message } = req.body;
        console.log('📝 User:', message);
        
        const actionData = await callOllama(message);
        console.log('🤖 AI Action:', JSON.stringify(actionData, null, 2));
        
        const result = await executeAction(actionData);
        console.log('✅ Result:', result);
        
        res.json({
            success: true,
            action: actionData,
            result: result
        });
    } catch (error) {
        console.error('❌ Error:', error.message);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

app.get('/api/health', (req, res) => {
    res.json({ 
        status: 'ok',
        model: MODEL,
        platform: process.platform
    });
});

const PORT = 3000;
app.listen(PORT, () => {
    console.log(`
╔════════════════════════════════════════╗
║  🤖 AI Desktop Assistant is RUNNING!  ║
╚════════════════════════════════════════╝

🌐 Open: http://localhost:${PORT}
📡 Model: ${MODEL}
💻 Platform: ${process.platform}
    `);
});