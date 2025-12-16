import * as fs from 'fs';
import * as path from 'path';
import * as stream from 'stream';
import { promisify } from 'util';
import { configManager } from './config';
import { logger } from './logger';

const pipeline = promisify(stream.pipeline);

export class ContentCacheManager {
    private cacheDir: string;

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
        if (fs.existsSync(localPath)) {
            return localPath;
        }
        return null;
    }

    public async syncPlaylist(items: any[]): Promise<void> {
        logger.info('Syncing playlist content to local cache...');
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

            if (!fs.existsSync(localPath)) {
                // Resolve full URL
                const fullUrl = url.startsWith('http') ? url : `${baseUrl}${url.startsWith('/') ? '' : '/'}${url}`;
                
                try {
                    logger.info(`Downloading ${filename} from ${fullUrl}...`);
                    await this.downloadFile(fullUrl, localPath);
                    logger.info(`Downloaded ${filename}`);
                } catch (err: any) {
                    logger.error(`Failed to download ${fullUrl}: ${err.message}`);
                    // Delete partial file if exists
                    if (fs.existsSync(localPath)) {
                        fs.unlinkSync(localPath);
                    }
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
                if (!activeFiles.has(file)) {
                    logger.info(`Removing unused cache file: ${file}`);
                    fs.unlinkSync(path.join(this.cacheDir, file));
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
        const response = await fetch(url);
        if (!response.ok) throw new Error(`HTTP ${response.status} ${response.statusText}`);
        if (!response.body) throw new Error('No response body');
        
        // @ts-ignore - fetch types for node might be missing stream compatibility in some versions
        await pipeline(stream.Readable.fromWeb(response.body), fs.createWriteStream(dest));
    }
}

export const contentCacheManager = new ContentCacheManager();
