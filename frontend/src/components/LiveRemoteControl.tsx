import { useEffect, useState, useRef } from 'react';
import { websocketService } from '../services/websocket.service';
import { deviceService } from '../services/device.service';

interface LiveRemoteControlProps {
  deviceId: string;
  deviceName: string;
  onClose: () => void;
}

export const LiveRemoteControl = ({ deviceId, deviceName, onClose }: LiveRemoteControlProps) => {
  const [message, setMessage] = useState('');
  const [textInput, setTextInput] = useState('');
  const [showKeyboard, setShowKeyboard] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [fps, setFps] = useState(0);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [dimensions, setDimensions] = useState({ width: 1280, height: 720 });

  // FPS counter
  const lastFpsUpdateRef = useRef(Date.now());

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let frameCount = 0;

    const handleFrame = (payload: any) => {
      if (payload.deviceId !== deviceId) return;

      try {
        // Update dimensions if they changed
        const metadata = payload.metadata;
        if (metadata && (metadata.width !== dimensions.width || metadata.height !== dimensions.height)) {
          setDimensions({ width: metadata.width || 1280, height: metadata.height || 720 });
          canvas.width = metadata.width || 1280;
          canvas.height = metadata.height || 720;
        }

        // Decode and draw frame
        const img = new Image();
        img.onload = () => {
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

          // Update FPS counter
          frameCount++;
          const now = Date.now();
          if (now - lastFpsUpdateRef.current >= 1000) {
            setFps(frameCount);
            frameCount = 0;
            lastFpsUpdateRef.current = now;
          }
        };
        img.src = `data:image/jpeg;base64,${payload.data}`;

        if (!isConnected) setIsConnected(true);
      } catch (error) {
        console.error('Error rendering frame:', error);
      }
    };

    websocketService.onScreencastFrame(handleFrame);
    setMessage('Connecting to live stream...');

    // Timeout to show error if no frames received
    const timeout = setTimeout(() => {
      if (!isConnected) {
        setMessage('No live stream received. Make sure the device is running.');
      }
    }, 5000);

    return () => {
      websocketService.offScreencastFrame(handleFrame);
      clearTimeout(timeout);
    };
  }, [deviceId, isConnected, dimensions]);

  const showMsg = (msg: string) => {
    setMessage(msg);
    setTimeout(() => setMessage(''), 3000);
  };

  const handleCanvasClick = async (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const scaleX = dimensions.width / rect.width;
    const scaleY = dimensions.height / rect.height;

    const x = Math.round((e.clientX - rect.left) * scaleX);
    const y = Math.round((e.clientY - rect.top) * scaleY);

    try {
      await deviceService.remoteClick(deviceId, x, y);
      showMsg(`Clicked at (${x}, ${y})`);
    } catch (error) {
      showMsg('Error: Failed to send click');
      console.error(error);
    }
  };

  const handleTypeText = async () => {
    if (!textInput) return;

    try {
      await deviceService.remoteType(deviceId, textInput);
      showMsg(`Typed: "${textInput.substring(0, 20)}${textInput.length > 20 ? '...' : ''}"`);
      setTextInput('');
    } catch (error) {
      showMsg('Error: Failed to type text');
      console.error(error);
    }
  };

  const handleKeyPress = async (key: string, modifiers?: string[]) => {
    try {
      await deviceService.remoteKey(deviceId, key, modifiers);
      showMsg(`Pressed: ${key}${modifiers ? ` (${modifiers.join('+')})` : ''}`);
    } catch (error) {
      showMsg('Error: Failed to send key');
      console.error(error);
    }
  };

  const handleScroll = async (deltaY: number) => {
    try {
      await deviceService.remoteScroll(deviceId, undefined, undefined, undefined, deltaY);
      showMsg(`Scrolled ${deltaY > 0 ? 'down' : 'up'}`);
    } catch (error) {
      showMsg('Error: Failed to scroll');
      console.error(error);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-7xl max-h-[95vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-4 border-b dark:border-gray-700 flex justify-between items-center bg-gray-50 dark:bg-gray-900">
          <div>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
              🔴 Live Remote Control: {deviceName}
            </h2>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              {isConnected ? (
                <span className="text-green-600 dark:text-green-400">● Live • {fps} FPS</span>
              ) : (
                <span className="text-yellow-600 dark:text-yellow-400">● Connecting...</span>
              )}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Status Message */}
        {message && (
          <div className="mx-4 mt-4 p-3 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800">
            <p className="text-sm text-blue-800 dark:text-blue-200">{message}</p>
          </div>
        )}

        {/* Main Content Area */}
        <div className="flex-1 overflow-hidden flex">
          {/* Live Stream Display */}
          <div className="flex-1 overflow-auto p-4 bg-gray-100 dark:bg-gray-900 flex items-center justify-center">
            <div className="relative inline-block">
              <canvas
                ref={canvasRef}
                width={dimensions.width}
                height={dimensions.height}
                onClick={handleCanvasClick}
                className="max-w-full h-auto rounded shadow-2xl cursor-crosshair border-2 border-gray-300 dark:border-gray-700"
                style={{ imageRendering: 'auto' }}
                title="Click anywhere to interact"
              />
              <div className="absolute top-2 right-2 bg-red-600 text-white px-3 py-1 rounded text-xs font-bold flex items-center gap-2">
                <span className="w-2 h-2 bg-white rounded-full animate-pulse"></span>
                LIVE
              </div>
              {!isConnected && (
                <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-50 rounded">
                  <div className="text-white text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>
                    <p>Waiting for stream...</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Control Panel Sidebar */}
          <div className="w-80 border-l dark:border-gray-700 bg-white dark:bg-gray-800 overflow-auto">
            <div className="p-4 space-y-4">
              {/* Keyboard Input */}
              <div>
                <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2 flex items-center justify-between">
                  <span>Keyboard</span>
                  <button
                    onClick={() => setShowKeyboard(!showKeyboard)}
                    className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
                  >
                    {showKeyboard ? 'Hide' : 'Show'}
                  </button>
                </h3>

                <div className="space-y-2">
                  <input
                    type="text"
                    value={textInput}
                    onChange={(e) => setTextInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleTypeText()}
                    placeholder="Type text here..."
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                  />
                  <button
                    onClick={handleTypeText}
                    disabled={!textInput}
                    className="w-full px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                  >
                    Type Text
                  </button>
                </div>

                {showKeyboard && (
                  <div className="mt-3 grid grid-cols-3 gap-1">
                    <button onClick={() => handleKeyPress('Enter')} className="px-2 py-1.5 bg-gray-200 dark:bg-gray-700 rounded text-xs hover:bg-gray-300 dark:hover:bg-gray-600">Enter</button>
                    <button onClick={() => handleKeyPress('Tab')} className="px-2 py-1.5 bg-gray-200 dark:bg-gray-700 rounded text-xs hover:bg-gray-300 dark:hover:bg-gray-600">Tab</button>
                    <button onClick={() => handleKeyPress('Escape')} className="px-2 py-1.5 bg-gray-200 dark:bg-gray-700 rounded text-xs hover:bg-gray-300 dark:hover:bg-gray-600">ESC</button>
                    <button onClick={() => handleKeyPress('Backspace')} className="px-2 py-1.5 bg-gray-200 dark:bg-gray-700 rounded text-xs hover:bg-gray-300 dark:hover:bg-gray-600">⌫ Back</button>
                    <button onClick={() => handleKeyPress('Delete')} className="px-2 py-1.5 bg-gray-200 dark:bg-gray-700 rounded text-xs hover:bg-gray-300 dark:hover:bg-gray-600">Delete</button>
                    <button onClick={() => handleKeyPress('KeyA', ['Control'])} className="px-2 py-1.5 bg-gray-200 dark:bg-gray-700 rounded text-xs hover:bg-gray-300 dark:hover:bg-gray-600">Ctrl+A</button>
                    <button onClick={() => handleKeyPress('ArrowUp')} className="px-2 py-1.5 bg-gray-200 dark:bg-gray-700 rounded text-xs hover:bg-gray-300 dark:hover:bg-gray-600">↑</button>
                    <button onClick={() => handleKeyPress('ArrowDown')} className="px-2 py-1.5 bg-gray-200 dark:bg-gray-700 rounded text-xs hover:bg-gray-300 dark:hover:bg-gray-600">↓</button>
                    <button onClick={() => handleKeyPress('ArrowLeft')} className="px-2 py-1.5 bg-gray-200 dark:bg-gray-700 rounded text-xs hover:bg-gray-300 dark:hover:bg-gray-600">←</button>
                  </div>
                )}
              </div>

              {/* Scroll Controls */}
              <div>
                <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Scroll</h3>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => handleScroll(-300)}
                    className="px-3 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 text-sm"
                  >
                    ↑ Up
                  </button>
                  <button
                    onClick={() => handleScroll(300)}
                    className="px-3 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 text-sm"
                  >
                    ↓ Down
                  </button>
                </div>
              </div>

              {/* Quick Actions */}
              <div>
                <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Quick Actions</h3>
                <div className="space-y-2">
                  <button
                    onClick={() => handleKeyPress('F5')}
                    className="w-full px-3 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 text-sm"
                  >
                    Refresh Page (F5)
                  </button>
                </div>
              </div>

              {/* Instructions */}
              <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                <h4 className="text-xs font-semibold text-blue-900 dark:text-blue-200 mb-1">Live Streaming:</h4>
                <ul className="text-xs text-blue-800 dark:text-blue-300 space-y-1">
                  <li>• Real-time video feed from device</li>
                  <li>• Click anywhere to interact</li>
                  <li>• Type and use keyboard shortcuts</li>
                  <li>• VNC-like remote control experience</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
