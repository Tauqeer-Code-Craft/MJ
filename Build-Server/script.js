const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const express = require('express');

const APP_TYPE = process.env.APP_TYPE || 'static';
const PORT = process.env.PORT || 3000;

function publishLog(log) {
    console.log(log);
}

async function buildProject() {
    publishLog('Installing dependencies and building project...');
    const buildProcess = exec('npm install && npm run build', { env: process.env });

    buildProcess.stdout.on('data', (data) => publishLog(data.toString()));
    buildProcess.stderr.on('data', (data) => publishLog(`Error: ${data.toString()}`));

    return new Promise((resolve, reject) => {
        buildProcess.on('close', (code) => {
            if (code !== 0) return reject(new Error(`Build failed with code ${code}`));
            publishLog('Build complete!');
            resolve();
        });
    });
}

function serveStatic() {
    const distPath = path.join(process.cwd(), 'dist' || 'build');
    if (!fs.existsSync(distPath)) {
        console.error('No dist folder found to serve!');
        process.exit(1);
    }

    const app = express();
    app.use(express.static(distPath));
    app.listen(PORT, () => console.log(`Serving static site at http://localhost:${PORT}`));
}

function runServerApp() {
    const startProcess = exec('npm install && npm start', { env: process.env });

    startProcess.stdout.on('data', (data) => publishLog(data.toString()));
    startProcess.stderr.on('data', (data) => publishLog(`Error: ${data.toString()}`));

    startProcess.on('close', (code) => {
        publishLog(`Server exited with code ${code}`);
        process.exit(code);
    });
}

async function main() {
    if (APP_TYPE === 'static') {
        await buildProject();
        serveStatic();
    } else if (APP_TYPE === 'server') {
        runServerApp();
    } else {
        console.error(`Unknown APP_TYPE: ${APP_TYPE}`);
        process.exit(1);
    }
}

main();
