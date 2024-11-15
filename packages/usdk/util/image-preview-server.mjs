import https from 'https';
import { getServerOpts } from './server-utils.mjs';

class ImagePreviewServer {
    constructor(port = 3000) {
        this.port = port;
        this.server = null;
        this.images = {};
    }

    updateImage(type, buffer) {
        const normalizedType = type.trim().toLowerCase().replace(/\s+/g, '-');
        this.images[normalizedType] = buffer;
    }

    getImageUrl(type) {
        const normalizedType = type.trim().toLowerCase().replace(/\s+/g, '-');
        return `https://local.upstreet.ai:${this.port}/${normalizedType}`;
    }

    start() {
        const serverOpts = getServerOpts();
        this.server = https.createServer(serverOpts, (req, res) => {
            // Set CORS headers
            res.setHeader('Access-Control-Allow-Origin', '*');
            res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
            res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

            if (req.method === 'OPTIONS') {
                res.writeHead(200);
                res.end();
                return;
            }

            // Normalize the path
            const rawPath = req.url.split('?')[0].substring(1).toLowerCase();
            const path = rawPath.replace(/\s+/g, '-');

            // Handle image file requests first
            if (path.includes('/image')) {
                const type = path.split('/')[0];
                const imageBuffer = this.images[type];

                if (imageBuffer) {
                    res.writeHead(200, {
                        'Content-Type': 'image/png',
                        'Content-Length': imageBuffer.length
                    });
                    res.end(imageBuffer);
                    return;
                }
            }

            // Handle HTML page requests
            const pageType = path.replace('/image', '');
            if (this.images.hasOwnProperty(pageType)) {
                const html = `
                    <!DOCTYPE html>
                    <html>
                        <head>
                            <style>
                                body {
                                    margin: 0;
                                    display: flex;
                                    justify-content: center;
                                    align-items: center;
                                    min-height: 100vh;
                                    background: #f0f0f0;
                                }
                                .container {
                                    display: flex;
                                    flex-direction: column;
                                    align-items: center;
                                    padding: 20px;
                                }
                                h1 {
                                    margin-bottom: 20px;
                                    color: #333;
                                }
                                img {
                                    max-width: 90vw;
                                    max-height: 80vh;
                                    object-fit: contain;
                                    border-radius: 8px;
                                    box-shadow: 0 2px 10px rgba(0,0,0,0.1);
                                }
                            </style>
                        </head>
                        <body>
                            <div class="container">
                                <img src="/${pageType}/image" id="image">
                                <script>
                                    setInterval(() => {
                                        document.getElementById('image').src = '/${pageType}/image?' + Date.now();
                                    }, 1000);
                                </script>
                            </div>
                        </body>
                    </html>
                `;
                res.writeHead(200, { 'Content-Type': 'text/html' });
                res.end(html);
                return;
            }

            // Handle root path
            if (path === '') {
                const firstType = Object.keys(this.images)[0];
                if (firstType) {
                    res.writeHead(302, { Location: `/${firstType}` });
                    res.end();
                    return;
                }
            }

            // If nothing matched, return 404
            res.writeHead(404);
            res.end('Not found');
        });

        this.server.listen(this.port, '0.0.0.0', () => {
            // console.log(`Image preview server running at https://local.upstreet.ai:${this.port}`);
        });
    }

    stop() {
        if (this.server) {
            this.server.close();
            this.server = null;
        }
    }
}

export default ImagePreviewServer;