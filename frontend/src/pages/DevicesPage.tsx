import { useEffect, useState } from 'react';
import { useDeviceStore } from '../store/deviceStore';
import { useWebSocketStore } from '../store/websocketStore';
import { usePlaylistStore } from '../store/playlistStore';
import { playlistService } from '../services/playlist.service';
import { ScreenshotViewer } from '../components/ScreenshotViewer';
import type { Playlist } from '@kiosk/shared';

export const DevicesPage = () => {
  const { devices, fetchDevices, createDevice, updateDevice, deleteDevice, isLoading } = useDeviceStore();
  const { connectedDevices } = useWebSocketStore();
  const { playlists, fetchPlaylists, assignPlaylistToDevice, unassignPlaylistFromDevice } = usePlaylistStore();
  const [showModal, setShowModal] = useState(false);
  const [showTokenModal, setShowTokenModal] = useState(false);
  const [showPlaylistModal, setShowPlaylistModal] = useState(false);
  const [editingDevice, setEditingDevice] = useState<number | null>(null);
  const [selectedDeviceForPlaylist, setSelectedDeviceForPlaylist] = useState<number | null>(null);
  const [devicePlaylists, setDevicePlaylists] = useState<Map<number, Playlist[]>>(new Map());
  const [deviceToken, setDeviceToken] = useState('');
  const [copiedToken, setCopiedToken] = useState(false);
  const [screenshotDeviceId, setScreenshotDeviceId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    deviceId: '',
    name: '',
    description: '',
    location: '',
  });

  const isDeviceOnline = (deviceId: string) => {
    return connectedDevices.has(deviceId);
  };

  useEffect(() => {
    fetchDevices();
    fetchPlaylists();
  }, [fetchDevices, fetchPlaylists]);

  useEffect(() => {
    // Fetch playlists for all devices when devices change
    const loadDevicePlaylists = async () => {
      const playlistMap = new Map<number, Playlist[]>();
      for (const device of devices) {
        try {
          const playlists = await playlistService.getDevicePlaylists(device.id);
          playlistMap.set(device.id, playlists);
        } catch (error) {
          console.error(`Failed to fetch playlists for device ${device.id}:`, error);
        }
      }
      setDevicePlaylists(playlistMap);
    };

    if (devices.length > 0) {
      loadDevicePlaylists();
    }
  }, [devices]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingDevice) {
        // Update existing device
        await updateDevice(editingDevice, formData);
        setShowModal(false);
        setEditingDevice(null);
        setFormData({ deviceId: '', name: '', description: '', location: '' });
        fetchDevices();
      } else {
        // Create new device
        const device = await createDevice(formData);
        setShowModal(false);
        setFormData({ deviceId: '', name: '', description: '', location: '' });

        // Show token modal if token was returned
        if (device.token) {
          setDeviceToken(device.token);
          setShowTokenModal(true);
          setCopiedToken(false);
        }

        fetchDevices();
      }
    } catch (error) {
      // Error handled by store
    }
  };

  const handleEdit = (device: any) => {
    setFormData({
      deviceId: device.deviceId,
      name: device.name,
      description: device.description || '',
      location: device.location || '',
    });
    setEditingDevice(device.id);
    setShowModal(true);
  };

  const handleCopyToken = async () => {
    try {
      await navigator.clipboard.writeText(deviceToken);
      setCopiedToken(true);
      setTimeout(() => setCopiedToken(false), 2000);
    } catch (error) {
      console.error('Failed to copy token:', error);
    }
  };

  const handleDelete = async (id: number) => {
    if (confirm('Are you sure you want to delete this device?')) {
      await deleteDevice(id);
    }
  };

  const handleOpenPlaylistModal = (deviceId: number) => {
    setSelectedDeviceForPlaylist(deviceId);
    setShowPlaylistModal(true);
  };

  const handleAssignPlaylist = async (playlistId: number) => {
    if (!selectedDeviceForPlaylist) return;

    try {
      await assignPlaylistToDevice(selectedDeviceForPlaylist, playlistId);
      // Refresh device playlists
      const playlists = await playlistService.getDevicePlaylists(selectedDeviceForPlaylist);
      setDevicePlaylists(prev => new Map(prev).set(selectedDeviceForPlaylist, playlists));
      setShowPlaylistModal(false);
    } catch (error) {
      // Error handled by store
    }
  };

  const handleUnassignPlaylist = async (deviceId: number, playlistId: number) => {
    if (confirm('Are you sure you want to unassign this playlist?')) {
      try {
        await unassignPlaylistFromDevice(deviceId, playlistId);
        // Refresh device playlists
        const playlists = await playlistService.getDevicePlaylists(deviceId);
        setDevicePlaylists(prev => new Map(prev).set(deviceId, playlists));
      } catch (error) {
        // Error handled by store
      }
    }
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Devices</h1>
        <button
          onClick={() => {
            setEditingDevice(null);
            setFormData({ deviceId: '', name: '', description: '', location: '' });
            setShowModal(true);
          }}
          className="btn-primary"
        >
          + Add Device
        </button>
      </div>

      {isLoading ? (
        <div className="text-center py-12">
          <p className="text-gray-600 dark:text-gray-400">Loading devices...</p>
        </div>
      ) : devices.length === 0 ? (
        <div className="card text-center py-12">
          <p className="text-gray-600 dark:text-gray-400 mb-4">No devices registered yet.</p>
          <button
            onClick={() => setShowModal(true)}
            className="btn-primary"
          >
            Add Your First Device
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {devices.map((device) => (
            <div key={device.id} className="card">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h3 className="text-lg font-bold text-gray-900 dark:text-white">{device.name}</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400">{device.deviceId}</p>
                </div>
                <div className="flex items-center gap-2">
                  {isDeviceOnline(device.deviceId) && (
                    <span className="relative flex h-3 w-3">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500"></span>
                    </span>
                  )}
                  <span
                    className={`px-3 py-1 rounded-full text-xs font-medium ${
                      isDeviceOnline(device.deviceId)
                        ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                        : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
                    }`}
                  >
                    {isDeviceOnline(device.deviceId) ? 'online' : 'offline'}
                  </span>
                </div>
              </div>

              {device.description && (
                <p className="text-gray-600 dark:text-gray-400 text-sm mb-3">{device.description}</p>
              )}

              {device.location && (
                <p className="text-gray-600 dark:text-gray-400 text-sm mb-3">
                  <span className="font-medium">Location:</span> {device.location}
                </p>
              )}

              {/* Assigned Playlists */}
              <div className="mt-3">
                <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Playlists:</p>
                {devicePlaylists.get(device.id)?.length ? (
                  <div className="space-y-2">
                    {devicePlaylists.get(device.id)!.map((playlist) => (
                      <div
                        key={playlist.id}
                        className="flex items-center justify-between bg-gray-50 dark:bg-gray-700 rounded px-3 py-2"
                      >
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                            {playlist.name}
                          </p>
                          {playlist.isActive && (
                            <span className="inline-block px-2 py-0.5 text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400 rounded mt-1">
                              Active
                            </span>
                          )}
                        </div>
                        <button
                          onClick={() => handleUnassignPlaylist(device.id, playlist.id)}
                          className="ml-2 text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300 text-sm"
                        >
                          Remove
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-gray-500 dark:text-gray-400">No playlists assigned</p>
                )}
              </div>

              <div className="flex flex-col gap-2 mt-4 pt-4 border-t dark:border-gray-700">
                <button
                  onClick={() => handleOpenPlaylistModal(device.id)}
                  className="btn-secondary text-sm"
                >
                  Assign Playlist
                </button>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleEdit(device)}
                    className="btn-secondary text-sm flex-1"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => setScreenshotDeviceId(device.deviceId)}
                    className="btn-primary text-sm flex-1"
                  >
                    Screenshot
                  </button>
                  <button
                    onClick={() => handleDelete(device.id)}
                    className="btn-danger text-sm flex-1"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add/Edit Device Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-8 max-w-md w-full shadow-xl">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">
              {editingDevice ? 'Edit Device' : 'Add New Device'}
            </h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Device ID
                </label>
                <input
                  type="text"
                  value={formData.deviceId}
                  onChange={(e) => setFormData({ ...formData, deviceId: e.target.value })}
                  className="input"
                  placeholder="e.g., rpi-001"
                  required
                  disabled={!!editingDevice}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Device Name
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="input"
                  placeholder="e.g., Lobby Display"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Description
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="input"
                  rows={3}
                  placeholder="Optional description"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Location
                </label>
                <input
                  type="text"
                  value={formData.location}
                  onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                  className="input"
                  placeholder="e.g., Building A - Floor 1"
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowModal(false);
                    setEditingDevice(null);
                    setFormData({ deviceId: '', name: '', description: '', location: '' });
                  }}
                  className="btn-secondary flex-1"
                >
                  Cancel
                </button>
                <button type="submit" className="btn-primary flex-1">
                  {editingDevice ? 'Update Device' : 'Add Device'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Device Token Modal */}
      {showTokenModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-8 max-w-2xl w-full shadow-xl">
            <div className="mb-6">
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Device Token</h2>
              <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
                <p className="text-yellow-800 dark:text-yellow-200 text-sm font-medium">
                  ⚠️ Important: This token will only be shown once!
                </p>
                <p className="text-yellow-700 dark:text-yellow-300 text-sm mt-1">
                  Copy it now and store it securely. You'll need it to configure your device.
                </p>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Authentication Token
                </label>
                <div className="relative">
                  <textarea
                    value={deviceToken}
                    readOnly
                    className="input font-mono text-sm resize-none"
                    rows={6}
                    onClick={(e) => (e.target as HTMLTextAreaElement).select()}
                  />
                </div>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={handleCopyToken}
                  className={`flex-1 px-4 py-2 rounded-lg font-medium transition-colors ${
                    copiedToken
                      ? 'bg-green-600 text-white'
                      : 'bg-blue-600 hover:bg-blue-700 text-white'
                  }`}
                >
                  {copiedToken ? '✓ Copied!' : 'Copy Token'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowTokenModal(false)}
                  className="btn-secondary flex-1"
                >
                  Close
                </button>
              </div>

              <div className="bg-gray-50 dark:bg-gray-900/50 rounded-lg p-4 text-sm">
                <p className="text-gray-700 dark:text-gray-300 font-medium mb-2">
                  Next Steps:
                </p>
                <ol className="list-decimal list-inside space-y-1 text-gray-600 dark:text-gray-400">
                  <li>Copy the token above</li>
                  <li>Add it to your device's .env file as DEVICE_TOKEN</li>
                  <li>Configure DEVICE_ID in .env to match the device ID</li>
                  <li>Start the device client to connect</li>
                </ol>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Screenshot Viewer Modal */}
      {screenshotDeviceId && (
        <ScreenshotViewer
          deviceId={screenshotDeviceId}
          onClose={() => setScreenshotDeviceId(null)}
        />
      )}

      {/* Playlist Assignment Modal */}
      {showPlaylistModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-8 max-w-md w-full shadow-xl">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">Assign Playlist</h2>

            {playlists.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-gray-600 dark:text-gray-400 mb-4">
                  No playlists available. Create a playlist first.
                </p>
                <button
                  onClick={() => setShowPlaylistModal(false)}
                  className="btn-secondary"
                >
                  Close
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                  Select a playlist to assign to this device:
                </p>

                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {playlists.map((playlist) => {
                    const alreadyAssigned = selectedDeviceForPlaylist
                      ? devicePlaylists.get(selectedDeviceForPlaylist)?.some(p => p.id === playlist.id)
                      : false;

                    return (
                      <button
                        key={playlist.id}
                        onClick={() => handleAssignPlaylist(playlist.id)}
                        disabled={alreadyAssigned}
                        className={`w-full text-left p-4 rounded-lg border transition-colors ${
                          alreadyAssigned
                            ? 'border-gray-300 dark:border-gray-600 bg-gray-100 dark:bg-gray-700 cursor-not-allowed opacity-50'
                            : 'border-gray-300 dark:border-gray-600 hover:border-blue-500 dark:hover:border-blue-400 hover:bg-blue-50 dark:hover:bg-gray-700'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex-1">
                            <p className="font-medium text-gray-900 dark:text-white">
                              {playlist.name}
                            </p>
                            {playlist.description && (
                              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                                {playlist.description}
                              </p>
                            )}
                            <div className="flex gap-2 mt-2">
                              {playlist.isActive && (
                                <span className="inline-block px-2 py-0.5 text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400 rounded">
                                  Active
                                </span>
                              )}
                              {alreadyAssigned && (
                                <span className="inline-block px-2 py-0.5 text-xs font-medium bg-gray-200 text-gray-700 dark:bg-gray-600 dark:text-gray-300 rounded">
                                  Already Assigned
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>

                <div className="flex gap-3 pt-4">
                  <button
                    type="button"
                    onClick={() => setShowPlaylistModal(false)}
                    className="btn-secondary flex-1"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
