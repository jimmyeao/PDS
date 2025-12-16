const path = require('path');

function isCacheable(url) {
    const lower = url.toLowerCase();
    const ext = path.extname(lower);
    if (['.mp4', '.webm', '.mkv', '.avi', '.mov'].includes(ext)) return true;
    if (lower.includes('/videos/') && lower.endsWith('/index.html')) return true;
    return false;
}

function getRelativePathFromUrl(url) {
    try {
        // Check for new video wrapper format: .../videos/{guid}/index.html
        const videoWrapperMatch = url.match(/\/videos\/([a-f0-9-]+)\/index\.html$/i);
        if (videoWrapperMatch) {
            return path.join(videoWrapperMatch[1], 'index.html');
        }

        // Handle standard /path/to/file.mp4
        const parts = url.split('/');
        return parts[parts.length - 1];
    } catch {
        return null;
    }
}

const url1 = "http://192.168.0.57:5001/videos/4adcd33b-650c-4ec2-a0d1-3f5faf971097/index.html";
const url2 = "http://192.168.0.57:5001/videos/5c48dfa3-e6ef-45fa-95fc-be0d505a8cf7/index.html";

console.log(`Testing URL: ${url1}`);
console.log(`isCacheable: ${isCacheable(url1)}`);
console.log(`getRelativePath: ${getRelativePathFromUrl(url1)}`);

console.log(`Testing URL: ${url2}`);
console.log(`isCacheable: ${isCacheable(url2)}`);
console.log(`getRelativePath: ${getRelativePathFromUrl(url2)}`);
