import Layout from '../../components/Layout';
import Link from 'next/link';
import Image from 'next/image';

export default function GettingStarted() {
  return (
    <Layout>
      <section className="bg-gradient-to-br from-orange-900 via-orange-800 to-red-800 dark:from-gray-900 dark:to-gray-800 py-20">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h1 className="text-5xl font-bold text-white mb-6">Getting Started with TheiaCast</h1>
          <p className="text-xl text-gray-200 dark:text-gray-300">
            Learn how to set up and configure TheiaCast for your digital signage needs
          </p>
        </div>
      </section>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12 bg-white dark:bg-gray-900">
        <nav className="mb-8 text-sm text-gray-600 dark:text-gray-400">
          <Link href="/" className="hover:text-orange-600 dark:hover:text-orange-400">Home</Link>
          <span className="mx-2">/</span>
          <Link href="/docs/getting-started" className="hover:text-orange-600 dark:hover:text-orange-400">Docs</Link>
          <span className="mx-2">/</span>
          <span className="text-gray-900 dark:text-white">Getting Started</span>
        </nav>

        <div className="prose prose-lg max-w-none">

          <section className="mb-12">
            <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">Overview</h2>
            <p className="text-gray-600 dark:text-gray-300 mb-4">
              TheiaCast is a professional digital signage management system that allows you to:
            </p>
            <ul className="list-disc pl-6 space-y-2 text-gray-600 dark:text-gray-300">
              <li>Create and manage playlists for your displays</li>
              <li>Upload videos and web content to devices</li>
              <li>Control displays remotely with live streaming</li>
              <li>Monitor device online/offline status and capture screenshots</li>
              <li>Automate content rotation with duration-based scheduling</li>
              <li>Support Windows PCs, Intel NUCs, and Raspberry Pi devices</li>
            </ul>
          </section>

          <section className="mb-12">
            <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">Architecture</h2>
            <div className="bg-gray-50 dark:bg-gray-800 p-6 rounded-lg mb-4">
              <div className="space-y-4 text-gray-600 dark:text-gray-300">
                <div className="flex items-start gap-4">
                  <div className="flex-shrink-0 w-32 font-semibold text-gray-900 dark:text-white">Backend:</div>
                  <div>ASP.NET Core 10 (C#) with PostgreSQL database</div>
                </div>
                <div className="flex items-start gap-4">
                  <div className="flex-shrink-0 w-32 font-semibold text-gray-900 dark:text-white">Frontend:</div>
                  <div>React 19 + TypeScript with Vite and Tailwind CSS</div>
                </div>
                <div className="flex items-start gap-4">
                  <div className="flex-shrink-0 w-32 font-semibold text-gray-900 dark:text-white">Pi Client:</div>
                  <div>Node.js 18+ with Puppeteer and Chromium</div>
                </div>
                <div className="flex items-start gap-4">
                  <div className="flex-shrink-0 w-32 font-semibold text-gray-900 dark:text-white">Windows Client:</div>
                  <div>.NET 10 with Playwright and bundled Chromium</div>
                </div>
                <div className="flex items-start gap-4">
                  <div className="flex-shrink-0 w-32 font-semibold text-gray-900 dark:text-white">Real-time:</div>
                  <div>Native WebSockets for live streaming and device control</div>
                </div>
              </div>
            </div>
          </section>

          <section className="mb-12">
            <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">Quick Start</h2>

            <div className="space-y-6">
              <div className="border-l-4 border-orange-600 pl-4">
                <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">1. Install the Server</h3>
                <p className="text-gray-600 dark:text-gray-300 mb-3">
                  Choose your deployment method:
                </p>
                <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg space-y-3">
                  <div>
                    <h4 className="font-semibold text-gray-900 dark:text-white mb-2">Docker (Recommended):</h4>
                    <div className="bg-gray-900 dark:bg-gray-950 text-gray-100 p-3 rounded font-mono text-sm overflow-x-auto">
                      <pre>{`git clone https://github.com/jimmyeao/TheiaCast.git
cd TheiaCast
docker-compose -f docker-compose.prod.yml up -d`}</pre>
                    </div>
                  </div>
                  <div>
                    <h4 className="font-semibold text-gray-900 dark:text-white mb-2">Or use pre-built images:</h4>
                    <div className="bg-gray-900 dark:bg-gray-950 text-gray-100 p-3 rounded font-mono text-sm overflow-x-auto">
                      <pre>{`docker pull ghcr.io/jimmyeao/theiacast-backend:latest
docker pull ghcr.io/jimmyeao/theiacast-frontend:latest`}</pre>
                    </div>
                  </div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    See our <Link href="/install" className="text-orange-600 hover:underline">installation guide</Link> for manual installation options.
                  </p>
                </div>
              </div>

              <div className="border-l-4 border-orange-600 pl-4">
                <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">2. Access the Dashboard</h3>
                <p className="text-gray-600 dark:text-gray-300 mb-4">
                  After installation, access the admin dashboard at <code className="bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded">http://localhost:5173</code>
                </p>
                <div className="bg-blue-50 dark:bg-blue-900/20 border-l-4 border-blue-500 p-4 rounded mb-4">
                  <p className="text-sm text-blue-800 dark:text-blue-200">
                    <strong>Default Credentials:</strong><br/>
                    Username: admin<br/>
                    Password: admin123<br/>
                    <em className="text-blue-700 dark:text-blue-300">⚠️ Change these immediately in production!</em>
                  </p>
                </div>
                <div className="my-6 rounded-lg overflow-hidden shadow-xl border-2 border-orange-500 dark:border-orange-600">
                  <Image
                    src="/login.png"
                    alt="TheiaCast Login Screen"
                    width={1200}
                    height={800}
                    className="w-full h-auto"
                  />
                  <div className="bg-gray-50 dark:bg-gray-800 px-4 py-2">
                    <p className="text-sm text-gray-600 dark:text-gray-400">Secure login interface with modern authentication</p>
                  </div>
                </div>
              </div>

              <div className="border-l-4 border-orange-600 pl-4">
                <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">3. Two-Factor Authentication (Optional)</h3>
                <p className="text-gray-600 dark:text-gray-300 mb-4">
                  For enhanced security, enable two-factor authentication. TheiaCast supports TOTP-based 2FA for an additional layer of protection.
                </p>
                <div className="my-6 rounded-lg overflow-hidden shadow-xl border-2 border-orange-500 dark:border-orange-600">
                  <Image
                    src="/2fa.png"
                    alt="TheiaCast 2FA Screen"
                    width={1200}
                    height={800}
                    className="w-full h-auto"
                  />
                  <div className="bg-gray-50 dark:bg-gray-800 px-4 py-2">
                    <p className="text-sm text-gray-600 dark:text-gray-400">Two-factor authentication for enhanced account security</p>
                  </div>
                </div>
              </div>

              <div className="border-l-4 border-orange-600 pl-4">
                <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">4. Install Client Devices</h3>
                <p className="text-gray-600 dark:text-gray-300 mb-3">
                  Install the client software on your display devices:
                </p>
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg">
                    <h4 className="font-semibold text-gray-900 dark:text-white mb-2 flex items-center gap-2">
                      <svg className="w-5 h-5 text-blue-600" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M0 12h11V0H0v12zm0 12h11V12H0v12zm13 0h11V12H13v12zM13 0v12h11V0H13z"/>
                      </svg>
                      Windows Client
                    </h4>
                    <p className="text-sm text-gray-600 dark:text-gray-300 mb-2">
                      Download and run the installer:
                    </p>
                    <code className="text-xs bg-gray-900 text-gray-100 p-2 rounded block">
                      TheiaCast-Client-Windows-v1.0.0-Setup.exe
                    </code>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                      Auto-starts via Task Scheduler
                    </p>
                  </div>
                  <div className="bg-gray-100 dark:bg-gray-800 p-4 rounded-lg">
                    <h4 className="font-semibold text-gray-900 dark:text-white mb-2 flex items-center gap-2">
                      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M12.504 0c-.155 0-.315.008-.48.021-4.226.333-3.105 4.807-3.17 6.298-.076 1.092-.3 1.953-1.05 3.02-.885 1.051-2.127 2.75-2.716 4.521-.278.84-.41 1.738-.127 2.717.283.979.76 1.948 1.31 2.716 1.097 1.536 2.794 2.917 4.454 3.563.83.323 1.669.488 2.477.488.808 0 1.647-.165 2.477-.488 1.66-.646 3.357-2.027 4.454-3.563.55-.768 1.027-1.737 1.31-2.716.283-.979.151-1.877-.127-2.717-.589-1.771-1.831-3.47-2.716-4.521-.75-1.067-.974-1.928-1.05-3.02-.065-1.491 1.056-5.965-3.17-6.298-.165-.013-.325-.021-.48-.021z"/>
                      </svg>
                      Linux / Raspberry Pi
                    </h4>
                    <p className="text-sm text-gray-600 dark:text-gray-300 mb-2">
                      Download and extract tarball:
                    </p>
                    <code className="text-xs bg-gray-900 text-gray-100 p-2 rounded block break-all">
                      sudo ./scripts/install.sh
                    </code>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                      Systemd service auto-start
                    </p>
                  </div>
                </div>
                <p className="text-sm text-gray-600 dark:text-gray-300 mt-3">
                  See <Link href="/install" className="text-orange-600 hover:underline">installation guide</Link> for detailed instructions.
                </p>
              </div>

              <div className="border-l-4 border-orange-600 pl-4">
                <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">5. Register Your Devices</h3>
                <p className="text-gray-600 dark:text-gray-300 mb-3">
                  In the admin dashboard, navigate to the Devices page and add your display devices:
                </p>
                <ol className="list-decimal pl-6 space-y-2 text-gray-600 dark:text-gray-300">
                  <li>Click "Add Device" button</li>
                  <li>Enter a unique Device ID (e.g., "lobby-display-1")</li>
                  <li>Enter a friendly name for the device</li>
                  <li>Copy the generated device token</li>
                  <li>Configure the token on your client device</li>
                </ol>
                <div className="bg-yellow-50 dark:bg-yellow-900/20 border-l-4 border-yellow-500 p-4 rounded mt-4">
                  <p className="text-sm text-yellow-800 dark:text-yellow-200">
                    <strong>Important:</strong> Keep device tokens secure! They provide full access to device control.
                  </p>
                </div>
              </div>

              <div className="border-l-4 border-orange-600 pl-4">
                <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">6. Create Content</h3>
                <p className="text-gray-600 dark:text-gray-300 mb-3">
                  Add content that will be displayed on your devices:
                </p>
                <ul className="list-disc pl-6 space-y-2 text-gray-600 dark:text-gray-300">
                  <li><strong>URLs:</strong> Any website or web application</li>
                  <li><strong>Videos:</strong> Video URLs (YouTube, Vimeo, direct video files)</li>
                  <li><strong>Login Required Sites:</strong> Use live remote control to log in to websites that require authentication</li>
                </ul>
                <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg mt-3">
                  <h4 className="font-semibold text-gray-900 dark:text-white mb-2">Auto-Authentication Example:</h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex gap-4">
                      <span className="font-mono text-gray-600 dark:text-gray-400 w-40">Username Selector:</span>
                      <code className="bg-gray-900 text-gray-100 px-2 py-1 rounded">#username</code>
                    </div>
                    <div className="flex gap-4">
                      <span className="font-mono text-gray-600 dark:text-gray-400 w-40">Password Selector:</span>
                      <code className="bg-gray-900 text-gray-100 px-2 py-1 rounded">input[type="password"]</code>
                    </div>
                    <div className="flex gap-4">
                      <span className="font-mono text-gray-600 dark:text-gray-400 w-40">Submit Selector:</span>
                      <code className="bg-gray-900 text-gray-100 px-2 py-1 rounded">button[type="submit"]</code>
                    </div>
                  </div>
                </div>
              </div>

              <div className="border-l-4 border-orange-600 pl-4">
                <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">7. Build Playlists</h3>
                <p className="text-gray-600 dark:text-gray-300 mb-3">
                  Create playlists to organize and schedule your content:
                </p>
                <ol className="list-decimal pl-6 space-y-2 text-gray-600 dark:text-gray-300">
                  <li>Go to Playlists page and click "Create Playlist"</li>
                  <li>Add content items to the playlist</li>
                  <li>Set display duration for each item (seconds, or 0 for permanent)</li>
                  <li>Configure optional time windows (e.g., 9:00 AM - 5:00 PM)</li>
                  <li>Set day-of-week filters if needed</li>
                  <li>Arrange items in the desired order</li>
                </ol>
                <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg mt-3">
                  <h4 className="font-semibold text-gray-900 dark:text-white mb-2">Duration Control:</h4>
                  <ul className="list-disc pl-6 space-y-1 text-sm text-gray-600 dark:text-gray-300">
                    <li><strong>0 seconds:</strong> Static display (no rotation)</li>
                    <li><strong>&gt;0 seconds:</strong> Display for specified duration, then move to next item</li>
                  </ul>
                </div>
              </div>

              <div className="border-l-4 border-orange-600 pl-4">
                <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">8. Assign and Go Live</h3>
                <p className="text-gray-600 dark:text-gray-300 mb-3">
                  Assign playlists to devices and start displaying content:
                </p>
                <ol className="list-decimal pl-6 space-y-2 text-gray-600 dark:text-gray-300">
                  <li>Go to Devices page</li>
                  <li>Flip the device card to see controls</li>
                  <li>Click "Assign Playlist"</li>
                  <li>Select the playlist to display</li>
                  <li>Content automatically pushed to device in real-time</li>
                </ol>
                <div className="bg-green-50 dark:bg-green-900/20 border-l-4 border-green-500 p-4 rounded mt-4">
                  <p className="text-sm text-green-800 dark:text-green-200">
                    ✓ <strong>Real-time Updates:</strong> Changes to playlists are instantly pushed to connected devices via WebSocket.
                  </p>
                </div>
              </div>
            </div>
          </section>

          <section className="mb-12">
            <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">Key Features</h2>
            <div className="grid md:grid-cols-2 gap-6">
              <div className="p-6 bg-gray-50 dark:bg-gray-800 rounded-lg">
                <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">🎥 Live Remote Control</h3>
                <p className="text-gray-600 dark:text-gray-300">Stream live video from devices and interact remotely with click, type, and keyboard commands using Chrome DevTools Protocol</p>
              </div>
              <div className="p-6 bg-gray-50 dark:bg-gray-800 rounded-lg">
                <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">📋 Playlist Scheduling</h3>
                <p className="text-gray-600 dark:text-gray-300">Control when content displays with duration-based rotation, time windows, and day-of-week filtering</p>
              </div>
              <div className="p-6 bg-gray-50 dark:bg-gray-800 rounded-lg">
                <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">💊 Health Monitoring</h3>
                <p className="text-gray-600 dark:text-gray-300">Monitor device status (CPU, memory, disk) and capture screenshots remotely in real-time</p>
              </div>
              <div className="p-6 bg-gray-50 dark:bg-gray-800 rounded-lg">
                <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">🔐 Auto-Authentication</h3>
                <p className="text-gray-600 dark:text-gray-300">Configure CSS selectors to automatically fill login forms and maintain persistent browser sessions</p>
              </div>
              <div className="p-6 bg-gray-50 dark:bg-gray-800 rounded-lg">
                <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">🔄 Real-time Updates</h3>
                <p className="text-gray-600 dark:text-gray-300">Instant playlist and content updates via WebSocket connections - no device restart required</p>
              </div>
              <div className="p-6 bg-gray-50 dark:bg-gray-800 rounded-lg">
                <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">📱 Cross-Platform</h3>
                <p className="text-gray-600 dark:text-gray-300">Support for Windows PCs, Intel NUCs, and Raspberry Pi devices with unified management</p>
              </div>
            </div>
          </section>

          <section className="mb-12">
            <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">Advanced Features</h2>
            <div className="space-y-4">
              <div className="bg-white dark:bg-gray-800 border-2 border-gray-200 dark:border-gray-700 p-4 rounded-lg">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Remote Browser Control</h3>
                <p className="text-sm text-gray-600 dark:text-gray-300">
                  Full remote interaction with device browsers via Puppeteer/Playwright automation. Click at specific coordinates,
                  type text into fields, send keyboard commands, and scroll programmatically.
                </p>
              </div>
              <div className="bg-white dark:bg-gray-800 border-2 border-gray-200 dark:border-gray-700 p-4 rounded-lg">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">CDP Screencast Streaming</h3>
                <p className="text-sm text-gray-600 dark:text-gray-300">
                  Real-time video streaming at 10-30 FPS using Chrome DevTools Protocol. See exactly what's on each device
                  with low latency and interact directly with the live stream.
                </p>
              </div>
              <div className="bg-white dark:bg-gray-800 border-2 border-gray-200 dark:border-gray-700 p-4 rounded-lg">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Persistent Browser Profiles</h3>
                <p className="text-sm text-gray-600 dark:text-gray-300">
                  Chromium profiles persist sessions and cookies across device restarts. Once authenticated,
                  websites remain logged in without repeated credential entry.
                </p>
              </div>
            </div>
          </section>

          <section className="mb-12">
            <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">Need Help?</h2>
            <p className="text-gray-600 dark:text-gray-300 mb-4">
              Check out our additional documentation, GitHub repository, or reach out to the community for support.
            </p>
            <div className="flex flex-wrap gap-4">
              <Link href="/install" className="inline-block bg-gradient-to-r from-orange-600 to-orange-500 text-white font-semibold px-6 py-3 rounded-lg hover:shadow-lg transition-all">
                Installation Guide
              </Link>
              <a href="https://github.com/jimmyeao/TheiaCast" className="inline-block bg-white dark:bg-gray-800 text-orange-600 font-semibold px-6 py-3 rounded-lg border-2 border-orange-600 hover:bg-orange-50 dark:hover:bg-gray-700 transition-all">
                View on GitHub
              </a>
              <Link href="/download" className="inline-block bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-white font-semibold px-6 py-3 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-all">
                Download Now
              </Link>
            </div>
          </section>
        </div>
      </div>
    </Layout>
  );
}
