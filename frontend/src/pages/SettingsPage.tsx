import { useState, useEffect } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { authService } from '../services/auth.service';
import { useAuthStore } from '../store/authStore';
import api from '../services/api';

export const SettingsPage = () => {
  const { user, initialize } = useAuthStore();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  // MFA State
  const [mfaQrCode, setMfaQrCode] = useState('');
  const [mfaCode, setMfaCode] = useState('');
  const [showMfaSetup, setShowMfaSetup] = useState(false);

  // Log Retention State
  const [logRetentionDays, setLogRetentionDays] = useState<string>('7');
  const [loadingLogs, setLoadingLogs] = useState(false);
  const [logSuccess, setLogSuccess] = useState('');

  useEffect(() => {
    // Fetch current log retention setting
    const fetchLogRetention = async () => {
      try {
        const response = await api.get('/settings/LogRetentionDays');
        setLogRetentionDays(response.data.value);
      } catch (err) {
        console.error('Failed to fetch log retention setting:', err);
      }
    };
    fetchLogRetention();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (newPassword !== confirmPassword) {
      setError('New passwords do not match');
      return;
    }

    if (newPassword.length < 6) {
      setError('Password must be at least 6 characters long');
      return;
    }

    setLoading(true);
    try {
      await authService.changePassword({ currentPassword, newPassword });
      setSuccess('Password changed successfully');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to change password');
    } finally {
      setLoading(false);
    }
  };

  const handleSetupMfa = async () => {
    try {
      setError('');
      const res = await authService.setupMfa();
      setMfaQrCode(res.qrCodeUri);
      setShowMfaSetup(true);
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to setup MFA');
    }
  };

  const handleEnableMfa = async () => {
    try {
      setError('');
      await authService.enableMfa(mfaCode);
      setSuccess('MFA enabled successfully');
      setShowMfaSetup(false);
      setMfaCode('');
      setMfaQrCode('');
      initialize(); // Refresh user data
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to enable MFA');
    }
  };

  const handleDisableMfa = async () => {
    if (!confirm('Are you sure you want to disable MFA?')) return;
    try {
      setError('');
      await authService.disableMfa();
      setSuccess('MFA disabled successfully');
      initialize(); // Refresh user data
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to disable MFA');
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-8">
      <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Settings</h1>

      {error && (
        <div className="p-4 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 rounded-lg">
          {error}
        </div>
      )}

      {success && (
        <div className="p-4 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 rounded-lg">
          {success}
        </div>
      )}

      {/* MFA Section */}
      <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">Two-Factor Authentication</h2>
        
        {user?.isMfaEnabled ? (
          <div>
            <div className="flex items-center text-green-600 dark:text-green-400 mb-4">
              <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              MFA is currently enabled
            </div>
            <button onClick={handleDisableMfa} className="btn-secondary text-red-600 hover:text-red-700">
              Disable MFA
            </button>
          </div>
        ) : (
          <div>
            {!showMfaSetup ? (
              <div>
                <p className="text-gray-600 dark:text-gray-400 mb-4">
                  Add an extra layer of security to your account by enabling Two-Factor Authentication.
                </p>
                <button onClick={handleSetupMfa} className="btn-primary">
                  Setup MFA
                </button>
              </div>
            ) : (
              <div className="space-y-6">
                <div className="flex flex-col items-center p-4 bg-white rounded-lg border border-gray-200">
                  <QRCodeSVG value={mfaQrCode} size={200} />
                  <p className="mt-4 text-sm text-gray-500 text-center">
                    Scan this QR code with your authenticator app (e.g. Google Authenticator)
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Verification Code
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={mfaCode}
                      onChange={(e) => setMfaCode(e.target.value)}
                      className="input flex-1"
                      placeholder="Enter 6-digit code"
                      maxLength={6}
                    />
                    <button onClick={handleEnableMfa} className="btn-primary">
                      Verify & Enable
                    </button>
                  </div>
                </div>
                
                <button 
                  onClick={() => setShowMfaSetup(false)} 
                  className="text-sm text-gray-500 hover:text-gray-700"
                >
                  Cancel
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Password Change Section */}
      <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-6">Change Password</h2>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Current Password
            </label>
            <input
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              className="input w-full"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              New Password
            </label>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="input w-full"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Confirm New Password
            </label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="input w-full"
              required
            />
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={loading}
              className="btn-primary"
            >
              {loading ? 'Changing Password...' : 'Change Password'}
            </button>
          </div>
        </form>
      </div>

      {/* Log Retention Settings */}
      <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">Log Retention</h2>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
          Configure how long system logs are kept before automatic cleanup
        </p>

        {logSuccess && (
          <div className="mb-4 p-4 bg-green-100 dark:bg-green-900/30 border border-green-400 dark:border-green-700 text-green-700 dark:text-green-400 rounded">
            {logSuccess}
          </div>
        )}

        <form onSubmit={async (e) => {
          e.preventDefault();
          setLogSuccess('');
          setLoadingLogs(true);
          try {
            await api.put('/settings/LogRetentionDays', { value: logRetentionDays });
            setLogSuccess('Log retention period updated successfully');
          } catch (err) {
            setError('Failed to update log retention setting');
          } finally {
            setLoadingLogs(false);
          }
        }}>
          <div className="max-w-xs">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Retention Period
            </label>
            <select
              value={logRetentionDays}
              onChange={(e) => setLogRetentionDays(e.target.value)}
              className="input w-full"
            >
              <option value="1">1 Day</option>
              <option value="7">7 Days (1 Week)</option>
              <option value="30">30 Days (1 Month)</option>
              <option value="90">90 Days (3 Months)</option>
              <option value="365">365 Days (1 Year)</option>
            </select>
            <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
              Logs older than this period will be automatically deleted
            </p>
          </div>

          <div className="flex justify-end mt-4">
            <button
              type="submit"
              disabled={loadingLogs}
              className="btn-primary"
            >
              {loadingLogs ? 'Saving...' : 'Save Retention Period'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
