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
  const [isConnected, setIsConnected] = useState(false);
  const [fps, setFps] = useState(0);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [dimensions, setDimensions] = useState({ width: 1280, height: 720 });
  const [isCanvasFocused, setIsCanvasFocused] = useState(false);

  // FPS counter
  const lastFpsUpdateRef = useRef(Date.now());
  const lastFrameAtRef = useRef<number>(0);
  const lastResizeRef = useRef<{w:number;h:number}>({ w: 1280, h: 720 });

  // Start/stop screencast when component mounts/unmounts
  useEffect(() => {
    // Start screencast when admin opens live remote
    deviceService.startScreencast(deviceId).catch(err => {
      console.error('Failed to start screencast:', err);
    });

    return () => {
      // Stop screencast when admin closes live remote
      deviceService.stopScreencast(deviceId).catch(err => {
        console.error('Failed to stop screencast:', err);
      });
    };
  }, [deviceId]);

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
        if (metadata) {
          const newW = metadata.width || 1280;
          const newH = metadata.height || 720;
          if (newW !== lastResizeRef.current.w || newH !== lastResizeRef.current.h) {
            // Debounce rapid resize to reduce flicker
            lastResizeRef.current = { w: newW, h: newH };
            setDimensions({ width: newW, height: newH });
            canvas.width = newW;
            canvas.height = newH;
          }
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

        if (!isConnected) {
          setIsConnected(true);
        }
        // Always clear connecting banner once we receive any frame
        setMessage('');
        lastFrameAtRef.current = Date.now();
      } catch (error) {
        console.error('Error rendering frame:', error);
      }
    };

    websocketService.onScreencastFrame(handleFrame);
    setMessage('Connecting to live stream...');
      websocketService.onScreencastFrame(handleFrame);
      // Show connecting only when truly not connected; clear on first frame
      setMessage(isConnected ? '' : 'Connecting to live stream...');
    const timeout = setTimeout(() => {
      // Only show if we truly haven't received any frames recently
      if (!isConnected && (Date.now() - lastFrameAtRef.current > 4500)) {
        setMessage('No live stream received. Make sure the device is running.');
      }
    }, 5000);

    return () => {
      websocketService.offScreencastFrame(handleFrame);
      clearTimeout(timeout);
    };
  }, [deviceId]);

  // Handle keyboard input directly on canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const handleKeyDown = async (e: KeyboardEvent) => {
      // Prevent ALL default browser behaviors to keep focus on canvas
      e.preventDefault();
      e.stopPropagation();

      try {
        // Handle printable characters
        if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
          await deviceService.remoteType(deviceId, e.key);
        }
        // Handle special keys
        else {
          const modifiers: string[] = [];
          if (e.ctrlKey) modifiers.push('Control');
          if (e.shiftKey) modifiers.push('Shift');
          if (e.altKey) modifiers.push('Alt');
          if (e.metaKey) modifiers.push('Meta');

          await deviceService.remoteKey(deviceId, e.key, modifiers.length > 0 ? modifiers : undefined);
        }
      } catch (error) {
        console.error('Error sending keystroke:', error);
      }
    };

    const handleFocus = () => setIsCanvasFocused(true);
    const handleBlur = () => setIsCanvasFocused(false);

    canvas.addEventListener('keydown', handleKeyDown);
    canvas.addEventListener('focus', handleFocus);
    canvas.addEventListener('blur', handleBlur);

    return () => {
      canvas.removeEventListener('keydown', handleKeyDown);
      canvas.removeEventListener('focus', handleFocus);
      canvas.removeEventListener('blur', handleBlur);
    };
  }, [deviceId]);

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
    } catch (error) {
      console.error('Error: Failed to send click', error);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in">
      <div className="card-glass w-full max-w-7xl max-h-[95vh] overflow-hidden flex flex-col animate-scale-in">
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

        {/* Status Message: only for connection status */}
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
                tabIndex={0}
                className={`max-w-full h-auto rounded shadow-2xl cursor-crosshair border-2 ${
                  isCanvasFocused
                    ? 'border-brand-orange-500 dark:border-brand-orange-400 ring-4 ring-brand-orange-500/50'
                    : 'border-gray-300 dark:border-gray-700'
                }`}
                style={{ imageRendering: 'auto', outline: 'none' }}
                title="Click to focus, then type directly"
              />
              <div className="absolute top-2 right-2 bg-red-600 text-white px-3 py-1 rounded text-xs font-bold flex items-center gap-2">
                <span className="w-2 h-2 bg-white rounded-full animate-pulse"></span>
                LIVE
              </div>
              {/* Keyboard active badge removed */}
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

          {/* Control Panel Sidebar removed as typing is supported directly */}
        </div>
      </div>
    </div>
  );
};
