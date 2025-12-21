import { useState, useEffect } from 'react';
import { SpeakerWaveIcon, XMarkIcon } from '@heroicons/react/24/outline';
import api from '../services/api';

export const BroadcastControl = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [broadcastType, setBroadcastType] = useState<'url' | 'message'>('message');
  const [url, setUrl] = useState('');
  const [message, setMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [activeBroadcast, setActiveBroadcast] = useState<any>(null);

  useEffect(() => {
    checkActiveBroadcast();
    const interval = setInterval(checkActiveBroadcast, 5000);
    return () => clearInterval(interval);
  }, []);

  const checkActiveBroadcast = async () => {
    try {
      const response = await api.get('/broadcast/active');
      setActiveBroadcast(response.data);
    } catch (err: any) {
      if (err.response?.status !== 404) {
        console.error('Failed to check active broadcast:', err);
      } else {
        setActiveBroadcast(null);
      }
    }
  };

  const handleStartBroadcast = async () => {
    if (broadcastType === 'url' && !url.trim()) {
      alert('Please enter a URL');
      return;
    }
    if (broadcastType === 'message' && !message.trim()) {
      alert('Please enter a message');
      return;
    }

    setIsLoading(true);
    try {
      await api.post('/broadcast/start', {
        type: broadcastType,
        url: broadcastType === 'url' ? url : undefined,
        message: broadcastType === 'message' ? message : undefined,
      });
      setIsOpen(false);
      setUrl('');
      setMessage('');
      await checkActiveBroadcast();
    } catch (err) {
      console.error('Failed to start broadcast:', err);
      alert('Failed to start broadcast. Check console for details.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleEndBroadcast = async () => {
    if (!confirm('Are you sure you want to end the active broadcast?')) return;

    setIsLoading(true);
    try {
      await api.post('/broadcast/end');
      await checkActiveBroadcast();
    } catch (err) {
      console.error('Failed to end broadcast:', err);
      alert('Failed to end broadcast. Check console for details.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="mb-6">
      {/* Active Broadcast Banner */}
      {activeBroadcast && (
        <div className="bg-gradient-to-r from-purple-500 to-pink-500 text-white p-4 rounded-lg mb-4 flex items-center justify-between shadow-lg">
          <div className="flex items-center gap-3">
            <SpeakerWaveIcon className="w-6 h-6 animate-pulse" />
            <div>
              <p className="font-bold">Active Broadcast</p>
              <p className="text-sm opacity-90">
                {activeBroadcast.type === 'url' ? `URL: ${activeBroadcast.url}` : `Message: "${activeBroadcast.message}"`}
              </p>
            </div>
          </div>
          <button
            onClick={handleEndBroadcast}
            disabled={isLoading}
            className="btn-secondary bg-white/20 hover:bg-white/30 text-white border-white/30"
          >
            {isLoading ? 'Ending...' : 'End Broadcast'}
          </button>
        </div>
      )}

      {/* Broadcast Control Button */}
      {!activeBroadcast && (
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="w-full btn-primary bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 flex items-center justify-center gap-2 text-lg py-4 shadow-lg"
        >
          <SpeakerWaveIcon className="w-6 h-6" />
          Start Broadcast to All Devices
        </button>
      )}

      {/* Broadcast Form Modal */}
      {isOpen && !activeBroadcast && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Start Broadcast</h2>
              <button
                onClick={() => setIsOpen(false)}
                className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
              >
                <XMarkIcon className="w-6 h-6" />
              </button>
            </div>

            <div className="space-y-6">
              {/* Broadcast Type Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Broadcast Type
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => setBroadcastType('message')}
                    className={`p-4 rounded-lg border-2 transition-all ${
                      broadcastType === 'message'
                        ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/20'
                        : 'border-gray-300 dark:border-gray-600 hover:border-purple-300'
                    }`}
                  >
                    <div className="font-semibold text-gray-900 dark:text-white">Message</div>
                    <div className="text-sm text-gray-600 dark:text-gray-400">Display a text message</div>
                  </button>
                  <button
                    onClick={() => setBroadcastType('url')}
                    className={`p-4 rounded-lg border-2 transition-all ${
                      broadcastType === 'url'
                        ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/20'
                        : 'border-gray-300 dark:border-gray-600 hover:border-purple-300'
                    }`}
                  >
                    <div className="font-semibold text-gray-900 dark:text-white">URL</div>
                    <div className="text-sm text-gray-600 dark:text-gray-400">Navigate to a website</div>
                  </button>
                </div>
              </div>

              {/* Message Input */}
              {broadcastType === 'message' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Broadcast Message
                  </label>
                  <textarea
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    className="input w-full h-32 resize-none"
                    placeholder="Enter your message here..."
                  />
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
                    This message will be displayed on all connected devices
                  </p>
                </div>
              )}

              {/* URL Input */}
              {broadcastType === 'url' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    URL
                  </label>
                  <input
                    type="url"
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    className="input w-full"
                    placeholder="https://example.com"
                  />
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
                    All devices will navigate to this URL
                  </p>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex gap-3 justify-end pt-4 border-t dark:border-gray-700">
                <button
                  onClick={() => setIsOpen(false)}
                  className="btn-secondary"
                  disabled={isLoading}
                >
                  Cancel
                </button>
                <button
                  onClick={handleStartBroadcast}
                  disabled={isLoading}
                  className="btn-primary bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700"
                >
                  {isLoading ? 'Starting...' : 'Start Broadcast'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
