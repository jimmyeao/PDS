import { useEffect } from 'react';
import { useDeviceStore } from '../store/deviceStore';
import { useContentStore } from '../store/contentStore';

export const DashboardPage = () => {
  const { devices, fetchDevices } = useDeviceStore();
  const { content, fetchContent } = useContentStore();

  useEffect(() => {
    fetchDevices();
    fetchContent();
  }, [fetchDevices, fetchContent]);

  const onlineDevices = devices.filter((d) => d.status === 'online').length;

  return (
    <div>
      <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-8">Dashboard</h1>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="card">
          <h3 className="text-gray-600 dark:text-gray-400 text-sm font-medium mb-2">Total Devices</h3>
          <p className="text-4xl font-bold text-gray-900 dark:text-white">{devices.length}</p>
        </div>

        <div className="card">
          <h3 className="text-gray-600 dark:text-gray-400 text-sm font-medium mb-2">Online Devices</h3>
          <p className="text-4xl font-bold text-green-600 dark:text-green-400">{onlineDevices}</p>
        </div>

        <div className="card">
          <h3 className="text-gray-600 dark:text-gray-400 text-sm font-medium mb-2">Total Content</h3>
          <p className="text-4xl font-bold text-blue-600 dark:text-blue-400">{content.length}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">Recent Devices</h2>
          {devices.length === 0 ? (
            <p className="text-gray-500 dark:text-gray-400">No devices registered yet.</p>
          ) : (
            <div className="space-y-3">
              {devices.slice(0, 5).map((device) => (
                <div
                  key={device.id}
                  className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg"
                >
                  <div>
                    <p className="font-medium text-gray-900 dark:text-white">{device.name}</p>
                    <p className="text-sm text-gray-600 dark:text-gray-400">{device.location || 'No location'}</p>
                  </div>
                  <span
                    className={`px-3 py-1 rounded-full text-xs font-medium ${
                      device.status === 'online'
                        ? 'bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200'
                        : 'bg-gray-100 dark:bg-gray-600 text-gray-800 dark:text-gray-200'
                    }`}
                  >
                    {device.status}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="card">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">Recent Content</h2>
          {content.length === 0 ? (
            <p className="text-gray-500 dark:text-gray-400">No content added yet.</p>
          ) : (
            <div className="space-y-3">
              {content.slice(0, 5).map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg"
                >
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-900 dark:text-white">{item.name}</p>
                    <p className="text-sm text-gray-600 dark:text-gray-400 truncate">{item.url}</p>
                  </div>
                  {item.requiresInteraction && (
                    <span className="ml-3 px-3 py-1 rounded-full text-xs font-medium bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200">
                      Interactive
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
