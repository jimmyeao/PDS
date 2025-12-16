import * as fs from 'fs';
import * as path from 'path';
import * as stream from 'stream';
import * as http from 'http';
import * as https from 'https';
import { promisify } from 'util';
import { configManager } from './config';
import { logger } from './logger';

const pipeline = promisify(stream.pipeline);

export class ContentCacheManager {
    private cacheDir: string;
    private activeDownloads: Set<string> = new Set();

    constructor() {
        // Use a cache directory in the user's home or app data
        const homeDir = process.env.HOME || process.env.USERPROFILE || '.';
        this.cacheDir = path.join(homeDir, '.pds-cache');
        this.ensureCacheDir();
    }

    private ensureCacheDir() {
        if (!fs.existsSync(this.cacheDir)) {
            fs.mkdirSync(this.cacheDir, { recursive: true });
        }
    }

    public getLocalPath(url: string): string | null {
        const filename = this.getFilenameFromUrl(url);
        if (!filename) return null;
        
        const localPath = path.join(this.cacheDir, filename);
        // Only return path if file exists and is NOT currently being downloaded
        // (Though we download to .tmp, so checking existence of final file is safe)
        if (fs.existsSync(localPath)) {
            return localPath;
        }
        return null;
    }

    public async syncPlaylist(items: any[]): Promise<void> {
        // Run in background to not block playback
        this.syncPlaylistInternal(items).catch(err => {
            logger.error(`Background sync failed: ${err.message}`);
        });
    }

    private async syncPlaylistInternal(items: any[]): Promise<void> {
        logger.info('Starting background sync of playlist content...');
        const config = configManager.get();
        const baseUrl = config.serverUrl.endsWith('/') ? config.serverUrl.slice(0, -1) : config.serverUrl;

        const activeFiles = new Set<string>();

        for (const item of items) {
            if (!item.content || !item.content.url) continue;
            
            let url = item.content.url;
            // We only cache video files for now
            if (!this.isCacheable(url)) continue;

            const filename = this.getFilenameFromUrl(url);
            if (!filename) continue;

            activeFiles.add(filename);
            const localPath = path.join(this.cacheDir, filename);

            // Check if file exists or is already downloading
            if (!fs.existsSync(localPath) && !this.activeDownloads.has(filename)) {
                // Resolve full URL
                const fullUrl = url.startsWith('http') ? url : `${baseUrl}${url.startsWith('/') ? '' : '/'}${url}`;
                
                this.activeDownloads.add(filename);
                try {
                    logger.info(`Downloading ${filename} from ${fullUrl}...`);
                    await this.downloadFile(fullUrl, localPath);
                    logger.info(`✅ Downloaded ${filename}`);
                } catch (err: any) {
                    logger.error(`Failed to download ${fullUrl}: ${err.message}`);
                    // Cleanup is handled in downloadFile (removes tmp file)
                } finally {
                    this.activeDownloads.delete(filename);
                }
            }
        }

        // Cleanup old files
        this.cleanup(activeFiles);
    }

    private cleanup(activeFiles: Set<string>) {
        try {
            const files = fs.readdirSync(this.cacheDir);
            for (const file of files) {
                // Don't delete files that are in the playlist OR are currently downloading (.tmp)
                if (!activeFiles.has(file) && !file.endsWith('.tmp')) {
                    logger.info(`Removing unused cache file: ${file}`);
                    try {
                        fs.unlinkSync(path.join(this.cacheDir, file));
                    } catch (e) {
                        // Ignore errors (e.g. file locked)
                    }
                }
            }
        } catch (e: any) {
            logger.error(`Cache cleanup failed: ${e.message}`);
        }
    }

    private isCacheable(url: string): boolean {
        const ext = path.extname(url).toLowerCase();
        return ['.mp4', '.webm', '.mkv', '.avi', '.mov'].includes(ext);
    }

    private getFilenameFromUrl(url: string): string | null {
        try {
            // Handle /path/to/file.mp4
            const parts = url.split('/');
            return parts[parts.length - 1];
        } catch {
            return null;
        }
    }

    private async downloadFile(url: string, dest: string): Promise<void> {
        const tmpDest = `${dest}.tmp`;
        const file = fs.createWriteStream(tmpDest);
        
        return new Promise((resolve, reject) => {
            const protocol = url.startsWith('https') ? https : http;
            
            const request = protocol.get(url, (response) => {
                if (response.statusCode !== 200) {
                    fs.unlink(tmpDest, () => {}); // Delete tmp file
                    reject(new Error(`HTTP ${response.statusCode} ${response.statusMessage}`));
                    return;
                }

                const totalSize = parseInt(response.headers['content-length'] || '0', 10);
                let downloadedSize = 0;
                let lastLoggedPercent = 0;

                response.on('data', (chunk) => {
                    downloadedSize += chunk.length;
                    if (totalSize > 0) {
                        const percent = Math.floor((downloadedSize / totalSize) * 100);
                        // Log every 10%
                        if (percent >= lastLoggedPercent + 10) {
                            logger.info(`Downloading ${path.basename(dest)}: ${percent}% (${(downloadedSize / 1024 / 1024).toFixed(1)} MB)`);
                            lastLoggedPercent = percent;
                        }
                    }
                });

                response.pipe(file);

                file.on('finish', () => {
                    file.close(() => {
                        // Rename tmp to final
                        fs.rename(tmpDest, dest, (err) => {
                            if (err) reject(err);
                            else resolve();
                        });
                    });
                });
            });

            request.on('error', (err) => {
                fs.unlink(tmpDest, () => {}); // Delete tmp file
                reject(err);
            });

            // Set a long timeout (1 hour)
            request.setTimeout(3600000, () => {
                request.destroy();
                fs.unlink(tmpDest, () => {}); // Delete tmp file
                reject(new Error('Download timeout'));
            });
        });
    }
}

export const contentCacheManager = new ContentCacheManager();
