import { useEffect, useState } from 'react';
import { useScheduleStore } from '../store/scheduleStore';
import { useContentStore } from '../store/contentStore';
import type { Schedule, CreateScheduleItemDto } from '@kiosk/shared';

export const SchedulesPage = () => {
  const {
    schedules,
    fetchSchedules,
    createSchedule,
    deleteSchedule,
    createScheduleItem,
    deleteScheduleItem,
    isLoading,
  } = useScheduleStore();

  const { content, fetchContent } = useContentStore();

  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [showItemModal, setShowItemModal] = useState(false);
  const [selectedSchedule, setSelectedSchedule] = useState<Schedule | null>(null);
  const [expandedSchedule, setExpandedSchedule] = useState<number | null>(null);

  const [scheduleFormData, setScheduleFormData] = useState({
    name: '',
    description: '',
    isActive: true,
  });

  const [itemFormData, setItemFormData] = useState<Partial<CreateScheduleItemDto>>({
    scheduleId: 0,
    contentId: 0,
    displayDuration: 30,
    orderIndex: 0,
    timeWindowStart: '',
    timeWindowEnd: '',
    daysOfWeek: [],
  });

  useEffect(() => {
    fetchSchedules();
    fetchContent();
  }, [fetchSchedules, fetchContent]);

  const handleCreateSchedule = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await createSchedule(scheduleFormData);
      setShowScheduleModal(false);
      setScheduleFormData({ name: '', description: '', isActive: true });
      fetchSchedules();
    } catch (error) {
      // Error handled by store
    }
  };

  const handleDeleteSchedule = async (id: number) => {
    if (confirm('Are you sure you want to delete this schedule? All items will be removed.')) {
      await deleteSchedule(id);
    }
  };

  const handleOpenItemModal = (schedule: Schedule) => {
    setSelectedSchedule(schedule);
    setItemFormData({
      ...itemFormData,
      scheduleId: schedule.id,
      orderIndex: schedule.items?.length || 0,
    });
    setShowItemModal(true);
  };

  const handleCreateItem = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      // Clean up empty optional fields
      const cleanedData: CreateScheduleItemDto = {
        scheduleId: itemFormData.scheduleId!,
        contentId: itemFormData.contentId!,
        displayDuration: itemFormData.displayDuration!,
        orderIndex: itemFormData.orderIndex!,
      };

      // Only add optional fields if they have values
      if (itemFormData.timeWindowStart && itemFormData.timeWindowStart.trim()) {
        cleanedData.timeWindowStart = itemFormData.timeWindowStart;
      }
      if (itemFormData.timeWindowEnd && itemFormData.timeWindowEnd.trim()) {
        cleanedData.timeWindowEnd = itemFormData.timeWindowEnd;
      }
      if (itemFormData.daysOfWeek && itemFormData.daysOfWeek.length > 0) {
        cleanedData.daysOfWeek = itemFormData.daysOfWeek;
      }

      await createScheduleItem(cleanedData);
      setShowItemModal(false);
      setItemFormData({
        scheduleId: 0,
        contentId: 0,
        displayDuration: 30,
        orderIndex: 0,
        timeWindowStart: '',
        timeWindowEnd: '',
        daysOfWeek: [],
      });
      fetchSchedules();
    } catch (error) {
      // Error handled by store
    }
  };

  const handleDeleteItem = async (itemId: number) => {
    if (confirm('Are you sure you want to remove this item from the schedule?')) {
      await deleteScheduleItem(itemId);
      fetchSchedules();
    }
  };

  const toggleSchedule = (scheduleId: number) => {
    setExpandedSchedule(expandedSchedule === scheduleId ? null : scheduleId);
  };

  const daysOfWeekOptions = [
    { value: 0, label: 'Sun' },
    { value: 1, label: 'Mon' },
    { value: 2, label: 'Tue' },
    { value: 3, label: 'Wed' },
    { value: 4, label: 'Thu' },
    { value: 5, label: 'Fri' },
    { value: 6, label: 'Sat' },
  ];

  const handleDayToggle = (day: number) => {
    const currentDays = itemFormData.daysOfWeek || [];
    const newDays = currentDays.includes(day)
      ? currentDays.filter((d) => d !== day)
      : [...currentDays, day].sort();
    setItemFormData({ ...itemFormData, daysOfWeek: newDays });
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Content Schedules</h1>
        <button onClick={() => setShowScheduleModal(true)} className="btn-primary">
          + Create Schedule
        </button>
      </div>

      {isLoading ? (
        <div className="text-center py-12">
          <p className="text-gray-600">Loading schedules...</p>
        </div>
      ) : schedules.length === 0 ? (
        <div className="card text-center py-12">
          <p className="text-gray-600 mb-4">No schedules created yet.</p>
          <button onClick={() => setShowScheduleModal(true)} className="btn-primary">
            Create Your First Schedule
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {schedules.map((schedule) => (
            <div key={schedule.id} className="card hover:shadow-lg transition-shadow duration-200">
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="text-xl font-bold text-gray-900 dark:text-white">{schedule.name}</h3>
                    <span
                      className={`px-3 py-1 rounded-full text-xs font-medium ${
                        schedule.isActive
                          ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-400'
                          : 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-300'
                      }`}
                    >
                      {schedule.isActive ? '● Active' : '○ Inactive'}
                    </span>
                  </div>
                  {schedule.description && (
                    <p className="text-gray-600 dark:text-gray-400 text-sm mb-3">{schedule.description}</p>
                  )}
                  <div className="flex items-center gap-4 text-sm text-gray-500 dark:text-gray-400">
                    <span className="flex items-center gap-1">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                      </svg>
                      {schedule.items?.length || 0} item{schedule.items?.length !== 1 ? 's' : ''}
                    </span>
                    <span className="flex items-center gap-1">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                      </svg>
                      {schedule.deviceSchedules?.length || 0} device{schedule.deviceSchedules?.length !== 1 ? 's' : ''}
                    </span>
                  </div>
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={() => handleOpenItemModal(schedule)}
                    className="btn-secondary text-sm"
                    title="Add content item to schedule"
                  >
                    + Add Item
                  </button>
                  <button
                    onClick={() => toggleSchedule(schedule.id)}
                    className="btn-secondary text-sm"
                    title={expandedSchedule === schedule.id ? 'Hide items' : 'View items'}
                  >
                    {expandedSchedule === schedule.id ? '▲ Hide' : '▼ View'}
                  </button>
                  <button
                    onClick={() => handleDeleteSchedule(schedule.id)}
                    className="btn-danger text-sm"
                    title="Delete schedule"
                  >
                    Delete
                  </button>
                </div>
              </div>

              {expandedSchedule === schedule.id && schedule.items && schedule.items.length > 0 && (
                <div className="mt-6 pt-6 border-t border-gray-200">
                  <h4 className="font-semibold text-gray-900 dark:text-white mb-4">Schedule Items:</h4>
                  <div className="space-y-3">
                    {schedule.items
                      .sort((a, b) => a.orderIndex - b.orderIndex)
                      .map((item) => (
                        <div
                          key={item.id}
                          className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700 rounded-lg border border-gray-200 dark:border-gray-600"
                        >
                          <div className="flex-1">
                            <div className="flex items-center gap-3 mb-1">
                              <span className="inline-flex items-center justify-center w-8 h-8 text-sm font-medium text-blue-600 dark:text-blue-400 bg-blue-100 dark:bg-blue-900/30 rounded-full">
                                {item.orderIndex + 1}
                              </span>
                              <span className="font-medium text-gray-900 dark:text-white">
                                {item.content?.name || `Content ID: ${item.contentId}`}
                              </span>
                              <span className="px-2 py-1 text-xs font-medium text-gray-700 dark:text-gray-300 bg-gray-200 dark:bg-gray-600 rounded">
                                {item.displayDuration}s
                              </span>
                            </div>
                            {(item.timeWindowStart || item.daysOfWeek) && (
                              <div className="text-sm text-gray-600 dark:text-gray-400 ml-11 mt-1 space-x-4">
                                {item.timeWindowStart && (
                                  <span className="inline-flex items-center">
                                    <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                    {item.timeWindowStart} - {item.timeWindowEnd || 'End of day'}
                                  </span>
                                )}
                                {item.daysOfWeek && (
                                  <span className="inline-flex items-center">
                                    <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                    </svg>
                                    {(JSON.parse(item.daysOfWeek) as number[]).map((d: number) =>
                                      daysOfWeekOptions[d].label
                                    ).join(', ')}
                                  </span>
                                )}
                              </div>
                            )}
                          </div>
                          <button
                            onClick={() => handleDeleteItem(item.id)}
                            className="btn-danger text-sm"
                          >
                            Remove
                          </button>
                        </div>
                      ))}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Create Schedule Modal */}
      {showScheduleModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-8 max-w-md w-full shadow-2xl">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">Create New Schedule</h2>
            <form onSubmit={handleCreateSchedule} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Schedule Name
                </label>
                <input
                  type="text"
                  value={scheduleFormData.name}
                  onChange={(e) =>
                    setScheduleFormData({ ...scheduleFormData, name: e.target.value })
                  }
                  className="input"
                  placeholder="e.g., Main Lobby Rotation"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Description
                </label>
                <textarea
                  value={scheduleFormData.description}
                  onChange={(e) =>
                    setScheduleFormData({ ...scheduleFormData, description: e.target.value })
                  }
                  className="input"
                  rows={3}
                  placeholder="Optional description"
                />
              </div>

              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="isActive"
                  checked={scheduleFormData.isActive}
                  onChange={(e) =>
                    setScheduleFormData({ ...scheduleFormData, isActive: e.target.checked })
                  }
                  className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
                <label htmlFor="isActive" className="ml-2 text-sm text-gray-700">
                  Active
                </label>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowScheduleModal(false)}
                  className="btn-secondary flex-1"
                >
                  Cancel
                </button>
                <button type="submit" className="btn-primary flex-1">
                  Create Schedule
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Item Modal */}
      {showItemModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-8 max-w-lg w-full max-h-[90vh] overflow-y-auto shadow-2xl">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
              Add Item to Schedule
            </h2>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
              {selectedSchedule?.name}
            </p>
            <form onSubmit={handleCreateItem} className="space-y-5">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Content
                </label>
                <select
                  value={itemFormData.contentId}
                  onChange={(e) =>
                    setItemFormData({ ...itemFormData, contentId: Number(e.target.value) })
                  }
                  className="input"
                  required
                >
                  <option value="">Select content...</option>
                  {content.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Display Duration (seconds)
                </label>
                <input
                  type="number"
                  value={itemFormData.displayDuration}
                  onChange={(e) =>
                    setItemFormData({ ...itemFormData, displayDuration: Number(e.target.value) })
                  }
                  className="input"
                  min="1"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Order Index
                </label>
                <input
                  type="number"
                  value={itemFormData.orderIndex}
                  onChange={(e) =>
                    setItemFormData({ ...itemFormData, orderIndex: Number(e.target.value) })
                  }
                  className="input"
                  min="0"
                  required
                />
              </div>

              <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">
                  Time Restrictions (Optional)
                </h3>
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
                  Leave blank to show at any time
                </p>

                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Start Time
                    </label>
                    <input
                      type="time"
                      value={itemFormData.timeWindowStart || ''}
                      onChange={(e) =>
                        setItemFormData({ ...itemFormData, timeWindowStart: e.target.value })
                      }
                      className="input"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      End Time
                    </label>
                    <input
                      type="time"
                      value={itemFormData.timeWindowEnd || ''}
                      onChange={(e) =>
                        setItemFormData({ ...itemFormData, timeWindowEnd: e.target.value })
                      }
                      className="input"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Specific Days
                  </label>
                  <div className="flex gap-2 flex-wrap">
                    {daysOfWeekOptions.map((day) => (
                      <button
                        key={day.value}
                        type="button"
                        onClick={() => handleDayToggle(day.value)}
                        className={`px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                          (itemFormData.daysOfWeek || []).includes(day.value)
                            ? 'bg-blue-600 dark:bg-blue-500 text-white shadow-md'
                            : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
                        }`}
                      >
                        {day.label}
                      </button>
                    ))}
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                    Leave unselected to show every day
                  </p>
                </div>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowItemModal(false)}
                  className="btn-secondary flex-1"
                >
                  Cancel
                </button>
                <button type="submit" className="btn-primary flex-1">
                  Add Item
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
