const os = require('os');
const http = require('http');
const fs = require('fs');
const path = require('path');
const net = require('net');
const crypto = require('crypto');
const { exec, execSync } = require('child_process');

function ensureModule(name) {
    try {
        require.resolve(name);
    } catch (e) {
        console.log(`Module '${name}' not found. Installing...`);
        execSync(`npm install ${name}`, { stdio: 'inherit' });
    }
}

ensureModule('ws');
const { WebSocket, createWebSocketStream } = require('ws');

const NAME = process.env.NAME || os.hostname();

console.log("~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~");
console.log("甬哥Github项目  ：github.com/Hubdarkweb");
console.log("甬哥Blogger博客 ：darkwebforums.topnet7hackers.space");
console.log("甬哥YouTube频道 ：www.youtube.com/@topnet7hackersspace");
console.log("Nodejs一键无交互 Trojan 代理脚本 (自动获取 Cloud Run 域名)");
console.log("当前版本：25.6.11-CustomPath");
console.log("~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~");

// Helper to fetch Cloud Run domain automatically from Metadata Server
function getCloudRunDomain() {
    try {
        const res = execSync('curl -s -H "Metadata-Flavor: Google" http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/identity?audience=https://cloud.google.com', { timeout: 2000 });
        const token = res.toString().trim();
        if (token) {
            const payloadBase64 = token.split('.')[1];
            if (payloadBase64) {
                const payload = JSON.parse(Buffer.from(payloadBase64, 'base64').toString('utf8'));
                if (payload && payload.aud) {
                    return payload.aud.replace(/^https?:\/\//, '');
                }
            }
        }
    } catch (e) {
        // Not running on Cloud Run
    }
    return null;
}

async function getVariableValue(variableName, defaultValue) {
    const envValue = process.env[variableName];
    if (envValue) {
        return envValue; 
    }
    if (defaultValue) {
        return defaultValue; 
    }
    let input = '';
    while (!input) {
        input = await ask(`请输入${variableName}: `);
        if (!input) {
            console.log(`${variableName}不能为空，请重新输入!`);
        }
    }
    return input;
}

function ask(question) {
    const rl = require('readline').createInterface({ input: process.stdin, output: process.stdout });
    return new Promise(resolve => rl.question(question, ans => { rl.close(); resolve(ans.trim()); }));
}

async function main() {
    // Changed default password to 'raen_xlx'
    const PASSWORD = await getVariableValue('PASSWORD', 'raen_xlx'); 
    console.log('你的密码:', PASSWORD);

    const PORT = await getVariableValue('PORT', '443');
    console.log('你的端口:', PORT);

    const detectedDomain = getCloudRunDomain();
    const defaultDomain = detectedDomain || 'anisa-topa-777topnet-435433143277.europe-west1.run.app';
    
    const DOMAIN = await getVariableValue('DOMAIN', defaultDomain);
    console.log('你的域名:', DOMAIN);

    const passwordHash = crypto.createHash('sha224').update(PASSWORD).digest('hex');

    const httpServer = http.createServer((req, res) => {
        if (req.url === '/') {
            res.writeHead(502, { 'Content-Type': 'text/plain' });
            res.end('Hello, World-topnet7hackersspace\n');
        } else if (req.url === `/${PASSWORD}`) {
            let trojanURL;
            // Updated path formatting to use %2Fraen_xlx (URL encoded /raen_xlx)
            if (NAME.includes('server') || NAME.includes('hostypanel')) {
                trojanURL = `trojan://${PASSWORD}@${DOMAIN}:443?security=tls&sni=${DOMAIN}&fp=chrome&type=ws&host=${DOMAIN}&path=%2Fraen_xlx#Tr-ws-tls-${NAME}
trojan://${PASSWORD}@104.16.0.0:443?security=tls&sni=${DOMAIN}&fp=chrome&type=ws&host=${DOMAIN}&path=%2Fraen_xlx#Tr-ws-tls-${NAME}
trojan://${PASSWORD}@104.17.0.0:443?security=tls&sni=${DOMAIN}&fp=chrome&type=ws&host=${DOMAIN}&path=%2Fraen_xlx#Tr-ws-tls-${NAME}
trojan://${PASSWORD}@104.18.0.0:443?security=tls&sni=${DOMAIN}&fp=chrome&type=ws&host=${DOMAIN}&path=%2Fraen_xlx#Tr-ws-tls-${NAME}
trojan://${PASSWORD}@104.19.0.0:443?security=tls&sni=${DOMAIN}&fp=chrome&type=ws&host=${DOMAIN}&path=%2Fraen_xlx#Tr-ws-tls-${NAME}
`;
            } else {
                trojanURL = `trojan://${PASSWORD}@${DOMAIN}:443?security=tls&sni=${DOMAIN}&fp=chrome&type=ws&host=${DOMAIN}&path=%2Fraen_xlx#Tr-ws-tls-${NAME}`;
            }
            res.writeHead(200, { 'Content-Type': 'text/plain' });
            res.end(trojanURL + '\n');
        } else {
            res.writeHead(404, { 'Content-Type': 'text/plain' });
            res.end('Not Found\n');
        }
    });

    httpServer.listen(PORT, () => {
        console.log(`HTTP Server is running on port ${PORT}`);
    });

    // Explicitly binding the WebSocket server instance to listen on the /raen_xlx path
    const wss = new WebSocket.Server({ server: httpServer, path: '/raen_xlx' });

    wss.on('connection', ws => {
        ws.once('message', msg => {
            if (msg.length < 58) return;

            const clientHash = msg.slice(0, 56).toString('utf8');
            if (clientHash !== passwordHash) return; 

            const crlf = msg.slice(56, 58);
            if (crlf[0] !== 0x0d || crlf[1] !== 0x0a) return; 

            const CMD = msg[58]; 
            
            let i = 59;
            const ATYP = msg[i++];
            
            let host = '';
            if (ATYP === 1) { 
                host = msg.slice(i, i += 4).join('.');
            } else if (ATYP === 3) { 
                const len = msg[i++];
                host = msg.slice(i, i += len).toString('utf8');
            } else if (ATYP === 4) { 
                host = msg.slice(i, i += 16).reduce((s, b, idx, a) => (idx % 2 ? s.concat(a.slice(idx - 1, idx + 1)) : s), []).map(b => b.readUInt16BE(0).toString(16)).join(':');
            } else {
                return;
            }

            const port = msg.readUInt16BE(i);
            i += 2;

            if (msg[i] !== 0x0d || msg[i + 1] !== 0x0a) return;
            i += 2; 

            const duplex = createWebSocketStream(ws);
            net.connect({ host, port }, function () {
                this.write(msg.slice(i)); 
                duplex.on('error', () => { }).pipe(this).on('error', () => { }).pipe(duplex);
            }).on('error', () => { });

        }).on('error', () => { });
    });

    console.log(`Trojan-ws-tls节点分享: trojan://${PASSWORD}@${DOMAIN}:443?security=tls&sni=${DOMAIN}&fp=chrome&type=ws&host=${DOMAIN}&path=%2Fraen_xlx#Tr-ws-tls-${NAME}`);
}

main();
