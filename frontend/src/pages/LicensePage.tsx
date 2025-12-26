import { useState, useEffect } from 'react';
import { licenseService } from '../services/license.service';
import type { License, LicenseStatus } from '@theiacast/shared';

export const LicensePage = () => {
  const [licenseStatus, setLicenseStatus] = useState<LicenseStatus | null>(null);
  const [licenses, setLicenses] = useState<License[]>([]);
  const [loadingStatus, setLoadingStatus] = useState(false);
  const [loadingLicenses, setLoadingLicenses] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const fetchLicenseStatus = async () => {
    setLoadingStatus(true);
    try {
      const status = await licenseService.getStatus();
      setLicenseStatus(status);
      setError('');
    } catch (err: any) {
      console.error('Failed to fetch license status:', err);
      setError('Failed to load license status');
    } finally {
      setLoadingStatus(false);
    }
  };

  const fetchLicenses = async () => {
    setLoadingLicenses(true);
    try {
      const fetchedLicenses = await licenseService.getAll();
      setLicenses(fetchedLicenses);
      setError('');
    } catch (err: any) {
      console.error('Failed to fetch licenses:', err);
      setError('Failed to load licenses');
    } finally {
      setLoadingLicenses(false);
    }
  };

  const handleRevokeLicense = async (id: number) => {
    if (!confirm('Are you sure you want to revoke this license?')) return;

    try {
      await licenseService.revoke(id);
      setSuccess('License revoked successfully');
      fetchLicenses();
      fetchLicenseStatus();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to revoke license');
    }
  };

  useEffect(() => {
    fetchLicenseStatus();
    fetchLicenses();
  }, []);

  const getStatusColor = () => {
    if (!licenseStatus) return 'gray';
    if (!licenseStatus.isValid && !licenseStatus.isInGracePeriod) return 'red';
    if (licenseStatus.isInGracePeriod) return 'yellow';
    if (licenseStatus.currentDevices >= licenseStatus.maxDevices * 0.8) return 'yellow';
    return 'green';
  };

  const getStatusBadge = () => {
    const color = getStatusColor();
    const bgColors = {
      green: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
      yellow: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
      red: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
      gray: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300',
    };

    return bgColors[color as keyof typeof bgColors];
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">License Management</h1>
      </div>

      {error && (
        <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
          <p className="text-sm text-red-800 dark:text-red-200">{error}</p>
        </div>
      )}

      {success && (
        <div className="p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
          <p className="text-sm text-green-800 dark:text-green-200">{success}</p>
        </div>
      )}

      {/* Current License Status */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">Current License Status</h2>

        {loadingStatus ? (
          <div className="text-center py-8">
            <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-current border-r-transparent align-[-0.125em] motion-reduce:animate-[spin_1.5s_linear_infinite]"></div>
            <p className="mt-2 text-gray-600 dark:text-gray-400">Loading status...</p>
          </div>
        ) : licenseStatus ? (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Tier</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white capitalize">{licenseStatus.tier}</p>
              </div>
              <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${getStatusBadge()}`}>
                {licenseStatus.isValid ? 'Active' : licenseStatus.isInGracePeriod ? 'Grace Period' : 'Exceeded'}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Devices Used</p>
                <p className="text-xl font-semibold text-gray-900 dark:text-white">
                  {licenseStatus.currentDevices} / {licenseStatus.maxDevices}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Available</p>
                <p className="text-xl font-semibold text-gray-900 dark:text-white">
                  {Math.max(0, licenseStatus.maxDevices - licenseStatus.currentDevices)}
                </p>
              </div>
            </div>

            {/* Progress bar */}
            <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2.5">
              <div
                className={`h-2.5 rounded-full ${
                  getStatusColor() === 'green'
                    ? 'bg-green-600'
                    : getStatusColor() === 'yellow'
                    ? 'bg-yellow-500'
                    : 'bg-red-600'
                }`}
                style={{ width: `${(licenseStatus.currentDevices / licenseStatus.maxDevices) * 100}%` }}
              ></div>
            </div>

            {licenseStatus.isInGracePeriod && licenseStatus.gracePeriodEndsAt && (
              <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
                <p className="text-sm text-yellow-800 dark:text-yellow-200">
                  <strong>Warning:</strong> You have exceeded your device limit. Grace period ends on{' '}
                  {new Date(licenseStatus.gracePeriodEndsAt).toLocaleString()}. Please upgrade your license to avoid service interruption.
                </p>
              </div>
            )}

            {!licenseStatus.isValid && !licenseStatus.isInGracePeriod && (
              <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                <p className="text-sm text-red-800 dark:text-red-200">
                  <strong>License Limit Exceeded:</strong> {licenseStatus.reason || 'Cannot add more devices.'}
                </p>
              </div>
            )}
          </div>
        ) : (
          <p className="text-gray-500 dark:text-gray-400">No license information available</p>
        )}
      </div>

      {/* All Licenses Table */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md">
        <div className="p-6">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">All Licenses</h2>

          {loadingLicenses ? (
            <div className="text-center py-12">
              <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-current border-r-transparent align-[-0.125em] motion-reduce:animate-[spin_1.5s_linear_infinite]"></div>
              <p className="mt-2 text-gray-600 dark:text-gray-400">Loading licenses...</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                <thead className="bg-gray-50 dark:bg-gray-700">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      License Key
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Tier
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Devices
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Company
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                  {licenses.map((license) => (
                    <tr key={license.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="text-sm font-mono text-gray-900 dark:text-white">{license.key}</span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="text-sm text-gray-900 dark:text-white capitalize">{license.tier}</span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="text-sm text-gray-900 dark:text-white">
                          {license.currentDeviceCount} / {license.maxDevices}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="text-sm text-gray-500 dark:text-gray-400">{license.companyName || '-'}</span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {license.isActive ? (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                            Active
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200">
                            Inactive
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        {license.tier !== 'free' && (
                          <button
                            onClick={() => handleRevokeLicense(license.id)}
                            className="text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300"
                          >
                            Revoke
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {licenses.length === 0 && !loadingLicenses && (
                <div className="text-center py-12">
                  <p className="text-gray-500 dark:text-gray-400">No licenses found</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
